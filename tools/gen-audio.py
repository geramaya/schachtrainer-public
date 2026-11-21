#!/usr/bin/env python3
"""Generate spoken explanations via OpenRouter text-to-speech (standard library + ffmpeg only).

Usage: python3 tools/gen-audio.py --key-file <path> [--only <id>] [--voice nadine] [--dry-run] [--proben | --proben-heygen]
                                   [--deckel USD] [--lauf NAME]
Reads tools/.cache/audio-texts.json (npm run audio:texts; a text may carry its own "voice", "model" and "language", e.g. the
teacher quips), writes public/audio/<id>-<hash>.mp3 and public/audio/manifest.json. The key is read from the file and never printed.
Two providers behind the same OpenRouter endpoint: heygen (pcm, converted to mp3, free) and elevenlabs/eleven-v4 (mp3 directly,
80 USD per million characters). Every paid request is booked in a run ledger (tools/laufzeit/<lauf>.json); a request that would
exceed the cap (--deckel, default 4.30 USD for the whole run name, samples included) is not sent.
"""
import argparse
import hashlib
import json
import re
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
URL = "https://openrouter.ai/api/v1/audio/speech"
MODEL = "heygen/heygen-voice-1-turbo:free"
VOICES = ["nadine", "tabitha", "bram", "gareth", "noelle", "meredith", "sabrina", "lucian", "weston", "vincent"]
SAMPLE_TEXT = "Hallo, ich bin dein Schachlehrer. Das war ein starker Zug!"
ELEVEN_MODEL = "elevenlabs/eleven-v4"
ELEVEN_VOICES = ["george", "sarah", "adam", "alice", "bella", "bill", "brian", "callum", "charlie", "chris", "daniel", "eric",
                 "harry", "jessica", "laura", "liam", "lily", "matilda", "river", "roger", "will"]
ELEVEN_SAMPLE_TEXT = "[excited] Hallo, ich bin dein Schachlehrer. Das war ein starker Zug!"
# USD per character (OpenRouter: ElevenLabs 80 USD per million characters, no markup). A model without an entry is refused (fail closed),
# so a changed model name can never slip past the cap.
PRICE_PER_CHAR = {MODEL: 0.0, ELEVEN_MODEL: 80 / 1_000_000}


class UnknownModel(ValueError):
    pass


def price_of(model):
    if model not in PRICE_PER_CHAR:
        raise UnknownModel(f"unknown model {model!r}: no price known, refusing to generate (add it to PRICE_PER_CHAR)")
    return PRICE_PER_CHAR[model]
DEFAULT_DECKEL = 4.30
LEDGER_DIR = Path(__file__).resolve().parent / "laufzeit"
MAX_CHARS = 600
SILENCE = "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.1"


class TtsError(Exception):
    pass


def split_text(text, limit=MAX_CHARS):
    """Split at sentence ends into parts <= limit; an overlong sentence is split at spaces."""
    sentences = re.findall(r"[^.!?]+[.!?]*\s*", text.strip()) or [text.strip()]
    parts, cur = [], ""
    for s in (x.strip() for x in sentences):
        if not s:
            continue
        pieces = [s]
        if len(s) > limit:
            pieces, line = [], ""
            for w in s.split():
                if line and len(line) + 1 + len(w) > limit:
                    pieces.append(line)
                    line = w
                else:
                    line = f"{line} {w}".strip()
            pieces.append(line)
        for p in pieces:
            if cur and len(cur) + 1 + len(p) > limit:
                parts.append(cur)
                cur = p
            else:
                cur = f"{cur} {p}".strip()
    if cur:
        parts.append(cur)
    return parts


def file_name(id_, text):
    return f"{id_}-{hashlib.sha256(text.encode('utf-8')).hexdigest()[:8]}.mp3"


def http_error_message(status, body, key):
    return f"HTTP {status}: {body.replace(key, '***')[:500]}"


def build_payload(model, voice, chunk, language=None):
    """Request body of /audio/speech. ElevenLabs: mp3 directly, optional language via provider options (shown on the model page;
    unrecognized keys are dropped by OpenRouter); HeyGen: pcm (converted to mp3 afterwards)."""
    if model.startswith("elevenlabs/"):
        payload = {"model": model, "input": chunk, "voice": voice, "response_format": "mp3"}
        if language:
            payload["provider"] = {"options": {"elevenlabs": {"language_code": language}}}
        return payload
    return {"model": model, "input": chunk, "voice": voice, "response_format": "pcm"}


def make_tts(key, voice, model=MODEL, language=None):
    def tts(chunk):
        payload = json.dumps(build_payload(model, voice, chunk, language)).encode()
        req = urllib.request.Request(URL, data=payload, method="POST", headers={
            "Authorization": f"Bearer {key}", "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                tts.last_id = r.headers.get("X-Generation-Id")
                return r.read()
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", "replace")
            hint = " (possible length limit - text is already split at 600 characters)" if 400 <= e.code < 500 else ""
            raise TtsError(http_error_message(e.code, body, key) + hint) from None
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            raise TtsError(f"network error: {str(e).replace(key, '***')}") from None
    tts.last_id = None
    return tts


def _duration(target):
    p = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(target)],
                       capture_output=True, text=True)
    return round(float(p.stdout.strip()), 1)


def save_mp3(raw, target):
    """mp3 from the provider is written as it is; returns the duration in seconds (ffprobe)."""
    Path(target).write_bytes(raw)
    return _duration(target)


def estimate_cost(texts):
    """{model: {"chars", "usd"}} for the texts (what is spoken, tags included)."""
    out = {}
    for t in texts:
        m = t.get("model") or MODEL
        e = out.setdefault(m, {"chars": 0, "usd": 0.0})
        e["chars"] += len(spoken(t))
        e["usd"] += len(spoken(t)) * price_of(m)
    return out


class Ledger:
    """Run ledger like bildgen's: sum of the booked costs of this run name; `fits` is the cap check before a request."""

    def __init__(self, path, deckel, name):
        self.path, self.deckel = Path(path), deckel
        data = json.loads(self.path.read_text()) if self.path.exists() else {"lauf": name, "summe": 0.0, "anfragen": []}
        self.name, self.summe, self.anfragen = data.get("lauf", name), data["summe"], data["anfragen"]

    def fits(self, cost):
        return self.summe + cost <= self.deckel + 1e-9

    def book(self, label, cost, source, generation_id=None):
        self.summe = round(self.summe + cost, 6)
        self.anfragen.append({"label": label, "kosten_usd": round(cost, 6), "quelle": source, "generation": generation_id})
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".json.tmp")
        tmp.write_text(json.dumps({"lauf": self.name, "summe": self.summe, "anfragen": self.anfragen}, ensure_ascii=False, indent=1))
        tmp.replace(self.path)


def pcm_to_mp3(pcm, target):
    """16 bit / 44.1 kHz mono PCM -> trimmed 96 kbps MP3; returns the duration in seconds."""
    af = f"{SILENCE},areverse,{SILENCE},areverse"
    cmd = ["ffmpeg", "-v", "error", "-y", "-f", "s16le", "-ar", "44100", "-ac", "1", "-i", "pipe:0",
           "-af", af, "-b:a", "96k", "-f", "mp3", str(target)]
    r = subprocess.run(cmd, input=pcm, capture_output=True)
    if r.returncode != 0:
        raise TtsError("ffmpeg failed: " + r.stderr.decode("utf-8", "replace")[:300])
    return _duration(target)


def _load_manifest(path):
    return json.loads(path.read_text()) if path.exists() else {}


def _write_manifest(path, manifest):
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    tmp.replace(path)


def spoken(t):
    """What the voice says: the text with an optional expression tag in front (the manifest keeps the plain text)."""
    return t.get("speakText") or t["text"]


def _is_current(t, out, manifest, voice=None):
    name = file_name(t["id"], spoken(t))
    entry = manifest.get(t["id"], {})
    return ((out / name).exists() and entry.get("file") == name and (not t.get("voice") or entry.get("voice") == t["voice"])
            and (not t.get("model") or entry.get("model") == t["model"]))


def generate_all(texts, out, tts, convert, voice, model, pause=1.0, tts_for=None, ledger=None, save_mp3=save_mp3):
    """A text may carry its own `voice`, `model` and `language` (quips); `tts_for(voice[, model, language])` then builds its tts.
    Paid models are booked in `ledger`; a request that would exceed the cap is not sent (exit code 3)."""
    out.mkdir(parents=True, exist_ok=True)
    mpath = out / "manifest.json"
    manifest = _load_manifest(mpath)
    failed, made, skipped, capped = [], 0, 0, False
    try:
        for t in texts:
            price_of(t.get("model") or model)
    except UnknownModel as e:
        print(f"STOP: {e}; no request sent", file=sys.stderr)
        return 2
    for t in texts:
        if _is_current(t, out, manifest):
            manifest[t["id"]].update(title=t["title"], sources=t["sources"])
            skipped += 1
            continue
        name = file_name(t["id"], spoken(t))
        t_voice = t.get("voice") or voice
        t_model = t.get("model") or model
        direct_mp3 = t_model.startswith("elevenlabs/")
        if tts_for and t.get("model"):
            speak = tts_for(t_voice, t_model, t.get("language"))
        elif tts_for and t.get("voice"):
            speak = tts_for(t_voice)
        else:
            speak = tts
        price = price_of(t_model)
        try:
            audio = b""
            for i, chunk in enumerate(split_text(spoken(t))):
                cost = len(chunk) * price
                if ledger and cost and not ledger.fits(cost):
                    print(f"STOP: cap reached ({ledger.summe:.4f} of {ledger.deckel:.2f} USD): the next request ({cost:.4f} USD) "
                          f"would exceed the Deckel; no request sent for {t['id']}", file=sys.stderr)
                    capped = True
                    break
                if i or made:
                    time.sleep(pause)
                audio += speak(chunk)
                if ledger and cost:
                    ledger.book(t["id"], cost, "estimate: characters x price", getattr(speak, "last_id", None))
            if capped:
                break
            duration = save_mp3(audio, out / name) if direct_mp3 else convert(audio, out / name)
        except TtsError as e:
            print(f"FAILED {t['id']}: {e}", file=sys.stderr)
            failed.append(t["id"])
            continue
        for old in out.glob(f"{t['id']}-*.mp3"):
            if old.name != name:
                old.unlink()
        manifest[t["id"]] = {"file": name, "title": t["title"], "text": t["text"], "sources": t["sources"],
                             "durationSec": duration, "voice": t_voice, "model": t_model,
                             "createdAt": datetime.now(timezone.utc).isoformat(timespec="seconds")}
        _write_manifest(mpath, manifest)
        made += 1
        print(f"ok {t['id']} ({duration}s)")
    _write_manifest(mpath, manifest)
    print(f"Summary: {made} generated, {skipped} up to date, {len(failed)} failed" + (f": {', '.join(failed)}" if failed else "")
          + (f"; stopped at the cap ({ledger.summe:.4f}/{ledger.deckel:.2f} USD)" if capped else ""))
    return 3 if capped else (1 if failed else 0)


def make_samples(out, tts_for, convert, pause=1.0):
    """One short German sample per voice (not in the manifest) so the owner can choose; existing files stay."""
    out.mkdir(parents=True, exist_ok=True)
    failed = []
    for v in VOICES:
        target = out / f"{v}.mp3"
        if target.exists():
            continue
        try:
            convert(tts_for(v)(SAMPLE_TEXT), target)
        except TtsError as e:
            print(f"FAILED {v}: {e}", file=sys.stderr)
            failed.append(v)
            continue
        print(f"ok {v}")
        time.sleep(pause)
    print(f"Samples in {out}: {len(VOICES) - len(failed)} of {len(VOICES)}" + (f", failed: {', '.join(failed)}" if failed else ""))
    return 1 if failed else 0


def make_samples_eleven(out, tts_for, save, ledger, pause=1.0):
    """One German sample with an expression tag per ElevenLabs voice (21), booked in the ledger; existing files stay."""
    out.mkdir(parents=True, exist_ok=True)
    price = PRICE_PER_CHAR[ELEVEN_MODEL]
    failed = []
    for v in ELEVEN_VOICES:
        target = out / f"{v}.mp3"
        if target.exists():
            continue
        cost = len(ELEVEN_SAMPLE_TEXT) * price
        if not ledger.fits(cost):
            print(f"STOP: cap reached ({ledger.summe:.4f} of {ledger.deckel:.2f} USD), sample {v} not sent", file=sys.stderr)
            return 3
        speak = tts_for(v, ELEVEN_MODEL, "de")
        try:
            save(speak(ELEVEN_SAMPLE_TEXT), target)
        except TtsError as e:
            print(f"FAILED {v}: {e}", file=sys.stderr)
            failed.append(v)
            continue
        ledger.book(f"probe-{v}", cost, "estimate: characters x price", getattr(speak, "last_id", None))
        print(f"ok {v}")
        time.sleep(pause)
    print(f"Samples in {out}: {len(ELEVEN_VOICES) - len(failed)} of {len(ELEVEN_VOICES)}" + (f", failed: {', '.join(failed)}" if failed else ""))
    return 1 if failed else 0


def _read_key(path):
    for line in Path(path).read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            return line.split("=", 1)[1].strip().strip("\"'") if "=" in line else line
    raise SystemExit("key file is empty")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--key-file")
    ap.add_argument("--only")
    ap.add_argument("--voice", default="nadine")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--proben", action="store_true", help="one short sample per ElevenLabs voice into <out>/proben/elevenlabs/ (counts against the cap)")
    ap.add_argument("--proben-heygen", action="store_true", help="one short sample per HeyGen voice into <out>/proben/")
    ap.add_argument("--deckel", type=float, default=DEFAULT_DECKEL, help="cap in USD for the whole run name (default %(default)s)")
    ap.add_argument("--lauf", default="lehrer-audio", help="ledger name")
    ap.add_argument("--ledger-dir", default=str(LEDGER_DIR))
    ap.add_argument("--texts", default=str(ROOT / "tools/.cache/audio-texts.json"))
    ap.add_argument("--out", default=str(ROOT / "public/audio"))
    a = ap.parse_args(argv)
    if not a.dry_run and not a.key_file:
        ap.error("--key-file is required (except with --dry-run)")
    ledger = Ledger(Path(a.ledger_dir) / f"{a.lauf}.json", a.deckel, a.lauf)
    if a.proben_heygen:
        return make_samples(Path(a.out) / "proben", lambda v: make_tts(_read_key(a.key_file), v), pcm_to_mp3)
    if a.proben:
        key = _read_key(a.key_file)
        cost = len(ELEVEN_VOICES) * len(ELEVEN_SAMPLE_TEXT) * PRICE_PER_CHAR[ELEVEN_MODEL]
        print(f"Samples: {len(ELEVEN_VOICES)} voices, {len(ELEVEN_VOICES) * len(ELEVEN_SAMPLE_TEXT)} characters, about {cost:.4f} USD "
              f"(ledger {ledger.summe:.4f} of cap {ledger.deckel:.2f} USD)")
        return make_samples_eleven(Path(a.out) / "proben" / "elevenlabs", lambda v, m=ELEVEN_MODEL, l="de": make_tts(key, v, m, l), save_mp3, ledger)
    texts = json.loads(Path(a.texts).read_text())
    if a.only:
        texts = [t for t in texts if t["id"] == a.only]
        if not texts:
            ap.error(f"unknown id: {a.only}")
    out = Path(a.out)
    manifest = _load_manifest(out / "manifest.json")
    todo = [t for t in texts if not _is_current(t, out, manifest)]
    est = estimate_cost(todo)
    total = sum(e["usd"] for e in est.values())
    left = a.deckel - ledger.summe
    if a.dry_run:
        print(f"Dry run: {len(todo)} of {len(texts)} texts to generate, {sum(len(spoken(t)) for t in todo)} characters, "
              f"{sum(len(split_text(spoken(t))) for t in todo)} requests")
        for m, e in sorted(est.items()):
            n = sum(1 for t in todo if (t.get("model") or MODEL) == m)
            print(f"  model {m}: {n} texts, {e['chars']} characters, {e['usd']:.4f} USD" + ("" if PRICE_PER_CHAR.get(m) else " (free)"))
        print(f"Estimated cost {total:.4f} USD; ledger '{a.lauf}' {ledger.summe:.4f} USD booked, cap {a.deckel:.2f} USD, {left:.4f} USD left"
              + ("" if total <= left else " - NOT ENOUGH: the run stops at the cap"))
        for v in sorted({t.get("voice") or a.voice for t in todo}):
            mine = [t for t in todo if (t.get("voice") or a.voice) == v]
            print(f"  voice {v}: {len(mine)} texts, {sum(len(split_text(spoken(t))) for t in mine)} requests")
        for t in todo:
            print(f"  {t['id']}  {len(spoken(t))} chars  {len(split_text(spoken(t)))} part(s)")
        return 0
    key = _read_key(a.key_file)
    print(f"Estimated cost {total:.4f} USD; ledger '{a.lauf}' {ledger.summe:.4f} USD booked, cap {a.deckel:.2f} USD, {left:.4f} USD left")
    return generate_all(texts, out, make_tts(key, a.voice), pcm_to_mp3, a.voice, MODEL,
                        tts_for=lambda v, m=MODEL, l=None: make_tts(key, v, m, l), ledger=ledger)


if __name__ == "__main__":
    sys.exit(main())
