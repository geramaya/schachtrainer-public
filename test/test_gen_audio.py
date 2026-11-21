import importlib.util, json, os, shutil, subprocess, sys, tempfile, unittest, hashlib, struct, math, io, contextlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("gen_audio", ROOT / "tools" / "gen-audio.py")
ga = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ga)

HAVE_FFMPEG = shutil.which("ffmpeg") and shutil.which("ffprobe")


def pcm(seconds_silence_a, seconds_tone, seconds_silence_b, rate=44100):
    out = bytearray()
    out += b"\x00\x00" * int(rate * seconds_silence_a)
    for i in range(int(rate * seconds_tone)):
        out += struct.pack("<h", int(12000 * math.sin(2 * math.pi * 440 * i / rate)))
    out += b"\x00\x00" * int(rate * seconds_silence_b)
    return bytes(out)


class Split(unittest.TestCase):
    def test_parts_respect_limit_and_keep_all_words(self):
        text = "Erster Satz hier. Zweiter Satz ist etwas länger! Dritter? " * 5
        parts = ga.split_text(text, 60)
        self.assertGreater(len(parts), 1)
        self.assertTrue(all(len(p) <= 60 for p in parts))
        self.assertEqual(" ".join(parts).split(), text.split())

    def test_splits_at_sentence_boundaries(self):
        parts = ga.split_text("Eins zwei drei. Vier fünf sechs. Sieben.", 20)
        self.assertEqual(parts, ["Eins zwei drei.", "Vier fünf sechs.", "Sieben."])

    def test_overlong_sentence_splits_at_spaces(self):
        parts = ga.split_text("aaa bbb ccc ddd eee fff", 8)
        self.assertTrue(all(len(p) <= 8 for p in parts))
        self.assertEqual(" ".join(parts), "aaa bbb ccc ddd eee fff")

    def test_short_text_is_one_part(self):
        self.assertEqual(ga.split_text("Kurz.", 600), ["Kurz."])


class Naming(unittest.TestCase):
    def test_file_name_uses_sha256_prefix(self):
        h = hashlib.sha256("Hallo".encode()).hexdigest()[:8]
        self.assertEqual(ga.file_name("scotch", "Hallo"), f"scotch-{h}.mp3")


class Manifest(unittest.TestCase):
    def test_redacts_key_in_error_text(self):
        msg = ga.http_error_message(401, '{"error":"bad key sk-or-SECRET"}', "sk-or-SECRET")
        self.assertIn("401", msg)
        self.assertNotIn("sk-or-SECRET", msg)

    def test_generate_all_skips_existing_removes_old_writes_manifest(self):
        with tempfile.TemporaryDirectory() as d:
            out = Path(d)
            texts = [
                {"id": "a", "kind": "eroeffnung", "refId": "a", "title": "A", "text": "Alt.", "sources": []},
                {"id": "b", "kind": "variante", "refId": "b", "title": "B", "text": ("Neu. " * 3).strip(), "sources": [{"kind": "x", "ref": "y"}]},
            ]
            (out / ga.file_name("a", "Alt.")).write_bytes(b"x")
            (out / "b-deadbeef.mp3").write_bytes(b"old")
            (out / "manifest.json").write_text(json.dumps({"a": {"file": ga.file_name("a", "Alt."), "title": "A", "text": "Alt.", "sources": [], "durationSec": 1.0, "voice": "nadine", "model": "m", "createdAt": "t"}}))
            calls = []

            def tts(chunk):
                calls.append(chunk)
                return b"\x00\x00"

            def convert(pcm_bytes, target):
                Path(target).write_bytes(b"mp3")
                return 2.5

            code = ga.generate_all(texts, out, tts, convert, voice="nadine", model=ga.MODEL, pause=0)
            self.assertEqual(code, 0)
            self.assertEqual(calls, ["Neu. Neu. Neu."])
            self.assertFalse((out / "b-deadbeef.mp3").exists())
            man = json.loads((out / "manifest.json").read_text())
            self.assertEqual(set(man), {"a", "b"})
            self.assertEqual(man["b"]["file"], ga.file_name("b", "Neu. Neu. Neu."))
            self.assertEqual(man["b"]["durationSec"], 2.5)
            self.assertEqual(man["b"]["sources"], [{"kind": "x", "ref": "y"}])

    def test_text_voice_overrides_default_and_is_recorded(self):
        with tempfile.TemporaryDirectory() as d:
            out = Path(d)
            texts = [
                {"id": "q", "kind": "spruch", "refId": "mann", "title": "", "text": "Autsch.", "sources": [], "voice": "stimme-x"},
                {"id": "e", "kind": "variante", "refId": "e", "title": "", "text": "Erklaerung.", "sources": []},
            ]
            used = []

            def tts_for(v):
                return lambda chunk: used.append((v, chunk)) or b"\x00\x00"

            def convert(pcm_bytes, target):
                Path(target).write_bytes(b"mp3")
                return 1.0

            code = ga.generate_all(texts, out, tts_for("nadine"), convert, voice="nadine", model=ga.MODEL, pause=0, tts_for=tts_for)
            self.assertEqual(code, 0)
            self.assertEqual(used, [("stimme-x", "Autsch."), ("nadine", "Erklaerung.")])
            man = json.loads((out / "manifest.json").read_text())
            self.assertEqual(man["q"]["voice"], "stimme-x")
            self.assertEqual(man["e"]["voice"], "nadine")

    def test_speak_text_is_spoken_but_manifest_keeps_plain_text(self):
        with tempfile.TemporaryDirectory() as d:
            out = Path(d)
            texts = [{"id": "q", "kind": "spruch", "refId": "frau", "title": "", "text": "Au weia.", "speakText": "[sarcastic] Au weia.", "sources": [], "voice": "nadine"}]
            seen = []

            def tts(chunk):
                seen.append(chunk)
                return b"\x00\x00"

            def convert(pcm_bytes, target):
                Path(target).write_bytes(b"mp3")
                return 1.0

            ga.generate_all(texts, out, tts, convert, voice="nadine", model=ga.MODEL, pause=0)
            self.assertEqual(seen, ["[sarcastic] Au weia."])
            man = json.loads((out / "manifest.json").read_text())
            self.assertEqual(man["q"]["text"], "Au weia.")
            # a changed tag or voice means: generate again
            texts[0]["speakText"] = "[warm] Au weia."
            ga.generate_all(texts, out, tts, convert, voice="nadine", model=ga.MODEL, pause=0)
            self.assertEqual(seen, ["[sarcastic] Au weia.", "[warm] Au weia."])
            texts[0]["voice"] = "gareth"
            ga.generate_all(texts, out, tts, convert, voice="nadine", model=ga.MODEL, pause=0, tts_for=lambda v: tts)
            self.assertEqual(len(seen), 3)
            ga.generate_all(texts, out, tts, convert, voice="nadine", model=ga.MODEL, pause=0, tts_for=lambda v: tts)
            self.assertEqual(len(seen), 3)

    def test_samples_one_per_voice_skip_existing_and_leave_manifest_alone(self):
        with tempfile.TemporaryDirectory() as d:
            out = Path(d) / "proben"
            made = []

            def tts_for(v):
                return lambda chunk: made.append((v, chunk)) or b"\x00\x00"

            def convert(pcm_bytes, target):
                Path(target).write_bytes(b"mp3")
                return 1.0

            (out).mkdir()
            (out / "bram.mp3").write_bytes(b"x")
            code = ga.make_samples(out, tts_for, convert, pause=0)
            self.assertEqual(code, 0)
            self.assertEqual(sorted(p.name for p in out.glob("*.mp3")), sorted(f"{v}.mp3" for v in ga.VOICES))
            self.assertEqual(len(ga.VOICES), 10)
            self.assertNotIn("bram", [v for v, _ in made])
            self.assertEqual({c for _, c in made}, {ga.SAMPLE_TEXT})
            self.assertFalse((Path(d) / "manifest.json").exists())

    def test_dry_run_reports_per_voice(self):
        with tempfile.TemporaryDirectory() as d:
            texts = Path(d) / "t.json"
            texts.write_text(json.dumps([
                {"id": "a", "kind": "variante", "refId": "a", "title": "", "text": "Eins.", "sources": []},
                {"id": "q1", "kind": "spruch", "refId": "mann", "title": "", "text": "Zwei.", "sources": [], "voice": "weston"},
                {"id": "q2", "kind": "spruch", "refId": "mann", "title": "", "text": "Drei.", "sources": [], "voice": "weston"},
            ]))
            buf = io.StringIO()
            with contextlib.redirect_stdout(buf):
                code = ga.main(["--dry-run", "--texts", str(texts), "--out", str(Path(d) / "out")])
            self.assertEqual(code, 0)
            self.assertIn("voice weston: 2", buf.getvalue())
            self.assertIn("voice nadine: 1", buf.getvalue())

    def test_failure_continues_and_returns_1(self):
        with tempfile.TemporaryDirectory() as d:
            out = Path(d)
            texts = [
                {"id": "bad", "kind": "variante", "refId": "bad", "title": "", "text": "Fehler.", "sources": []},
                {"id": "ok", "kind": "variante", "refId": "ok", "title": "", "text": "Gut.", "sources": []},
            ]

            def tts(chunk):
                if chunk == "Fehler.":
                    raise ga.TtsError("HTTP 500")
                return b"\x00\x00"

            def convert(pcm_bytes, target):
                Path(target).write_bytes(b"mp3")
                return 1.0

            with contextlib.redirect_stderr(io.StringIO()):
                code = ga.generate_all(texts, out, tts, convert, voice="nadine", model=ga.MODEL, pause=0)
            self.assertEqual(code, 1)
            man = json.loads((out / "manifest.json").read_text())
            self.assertEqual(set(man), {"ok"})

    def test_long_text_is_chunked_and_pcm_concatenated(self):
        with tempfile.TemporaryDirectory() as d:
            text = "Ein Satz hier. " * 80
            texts = [{"id": "l", "kind": "variante", "refId": "l", "title": "", "text": text.strip(), "sources": []}]
            seen = []

            def tts(chunk):
                seen.append(chunk)
                return bytes([len(seen)]) * 2

            got = {}

            def convert(pcm_bytes, target):
                got["pcm"] = pcm_bytes
                Path(target).write_bytes(b"mp3")
                return 1.0

            ga.generate_all(texts, Path(d), tts, convert, voice="nadine", model=ga.MODEL, pause=0)
            self.assertGreater(len(seen), 1)
            self.assertTrue(all(len(c) <= 600 for c in seen))
            self.assertEqual(got["pcm"], b"".join(bytes([i + 1]) * 2 for i in range(len(seen))))


@unittest.skipUnless(HAVE_FFMPEG, "ffmpeg missing")
class Ffmpeg(unittest.TestCase):
    def test_trims_silence_at_both_ends(self):
        with tempfile.TemporaryDirectory() as d:
            target = Path(d) / "t.mp3"
            dur = ga.pcm_to_mp3(pcm(1.0, 0.5, 1.0), target)
            self.assertTrue(target.exists())
            self.assertLess(dur, 0.9)
            self.assertGreater(dur, 0.4)


class Cli(unittest.TestCase):
    def test_dry_run_lists_ids_without_network_or_key(self):
        with tempfile.TemporaryDirectory() as d:
            tf = Path(d) / "texts.json"
            tf.write_text(json.dumps([{"id": "q", "kind": "variante", "refId": "q", "title": "Q", "text": "Hallo Welt.", "sources": []}]))
            buf = io.StringIO()
            with contextlib.redirect_stdout(buf):
                code = ga.main(["--dry-run", "--texts", str(tf), "--out", str(Path(d) / "audio")])
            self.assertEqual(code, 0)
            self.assertIn("q", buf.getvalue())
            self.assertIn("11", buf.getvalue())  # characters

    def test_without_dry_run_requires_key_file(self):
        with contextlib.redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit):
                ga.main([])


ELEVEN = "elevenlabs/eleven-v4"


def eleven_text(id_, text, voice="chris", speak=None):
    t = {"id": id_, "kind": "spruch", "refId": "mann", "title": "", "text": text, "sources": [], "voice": voice, "model": ELEVEN, "language": "de"}
    if speak:
        t["speakText"] = speak
    return t


class Provider(unittest.TestCase):
    def test_default_cap_is_4_30_usd_and_price_is_80_per_million_characters(self):
        self.assertEqual(ga.DEFAULT_DECKEL, 4.30)
        self.assertAlmostEqual(ga.PRICE_PER_CHAR[ELEVEN] * 1_000_000, 80.0)
        self.assertEqual(len(ga.ELEVEN_VOICES), 21)

    def test_payload_per_model(self):
        p = ga.build_payload(ELEVEN, "chris", "[cheerful] Hallo.", "de")
        self.assertEqual((p["model"], p["voice"], p["response_format"], p["input"]), (ELEVEN, "chris", "mp3", "[cheerful] Hallo."))
        self.assertEqual(p["provider"], {"options": {"elevenlabs": {"language_code": "de"}}})
        self.assertNotIn("speed", p)
        q = ga.build_payload(ga.MODEL, "nadine", "Hallo.", None)
        self.assertEqual((q["response_format"], "provider" in q), ("pcm", False))
        self.assertNotIn("provider", ga.build_payload(ELEVEN, "chris", "Hallo.", None))

    def test_cost_estimate_is_characters_times_price_per_model(self):
        texts = [eleven_text("a", "x" * 1000), {"id": "h", "kind": "variante", "refId": "h", "title": "", "text": "y" * 5000, "sources": []}]
        est = ga.estimate_cost(texts)
        self.assertEqual(est[ELEVEN]["chars"], 1000)
        self.assertAlmostEqual(est[ELEVEN]["usd"], 0.08)
        self.assertEqual(est[ga.MODEL]["chars"], 5000)
        self.assertEqual(est[ga.MODEL]["usd"], 0.0)


class LedgerTest(unittest.TestCase):
    def test_books_persist_and_fit_check_uses_the_cap(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "lauf.json"
            led = ga.Ledger(path, 0.10, "lauf")
            self.assertTrue(led.fits(0.10))
            led.book("a", 0.06, "geschaetzt")
            self.assertFalse(led.fits(0.05))
            self.assertTrue(led.fits(0.04))
            again = ga.Ledger(path, 0.10, "lauf")
            self.assertAlmostEqual(again.summe, 0.06)
            self.assertEqual(json.loads(path.read_text())["anfragen"][0]["label"], "a")

    def test_run_stops_before_a_request_would_exceed_the_cap(self):
        with tempfile.TemporaryDirectory() as d:
            out = Path(d)
            led = ga.Ledger(out / "l.json", 0.0020, "l")  # 25 characters at 80 USD per million
            texts = [eleven_text("a", "x" * 10), eleven_text("b", "y" * 10), eleven_text("c", "z" * 10)]
            calls = []

            def tts(chunk):
                calls.append(chunk)
                return b"mp3"

            buf = io.StringIO()
            with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(buf):
                code = ga.generate_all(texts, out, tts, None, voice="nadine", model=ga.MODEL, pause=0, ledger=led,
                                       tts_for=lambda v, m=None, l=None: tts, save_mp3=lambda raw, target: Path(target).write_bytes(raw) or 1.0)
            self.assertEqual(code, 3)
            self.assertEqual(len(calls), 2)
            self.assertLessEqual(led.summe, 0.0020)
            self.assertIn("Deckel", buf.getvalue())
            man = json.loads((out / "manifest.json").read_text())
            self.assertEqual(set(man), {"a", "b"})


class ElevenRun(unittest.TestCase):
    def test_mp3_is_saved_directly_without_the_pcm_conversion(self):
        with tempfile.TemporaryDirectory() as d:
            out = Path(d)
            saved = []

            def save(raw, target):
                saved.append(raw)
                Path(target).write_bytes(raw)
                return 2.0

            def convert(*a):
                raise AssertionError("pcm conversion must not run for mp3")

            seen = []
            tts_for = lambda v, m=None, l=None: (lambda chunk: seen.append((v, m, l, chunk)) or b"MP3DATA")
            texts = [eleven_text("q", "Au weia.", voice="alice", speak="[sarcastic] Au weia.")]
            code = ga.generate_all(texts, out, tts_for("nadine"), convert, voice="nadine", model=ga.MODEL, pause=0, tts_for=tts_for, save_mp3=save)
            self.assertEqual(code, 0)
            self.assertEqual(seen, [("alice", ELEVEN, "de", "[sarcastic] Au weia.")])
            self.assertEqual(saved, [b"MP3DATA"])
            man = json.loads((out / "manifest.json").read_text())
            self.assertEqual((man["q"]["voice"], man["q"]["model"], man["q"]["text"]), ("alice", ELEVEN, "Au weia."))

    def test_a_file_made_with_another_model_is_made_again(self):
        with tempfile.TemporaryDirectory() as d:
            out = Path(d)
            t = eleven_text("q", "Au weia.", voice="chris")
            (out / ga.file_name("q", "Au weia.")).write_bytes(b"old")
            (out / "manifest.json").write_text(json.dumps({"q": {"file": ga.file_name("q", "Au weia."), "title": "", "text": "Au weia.", "sources": [], "durationSec": 1.0, "voice": "chris", "model": ga.MODEL, "createdAt": "t"}}))
            self.assertFalse(ga._is_current(t, out, json.loads((out / "manifest.json").read_text())))
            man = json.loads((out / "manifest.json").read_text())
            man["q"]["model"] = ELEVEN
            self.assertTrue(ga._is_current(t, out, man))

    def test_samples_one_per_eleven_voice_into_their_own_folder_and_booked(self):
        with tempfile.TemporaryDirectory() as d:
            out = Path(d) / "proben" / "elevenlabs"
            led = ga.Ledger(Path(d) / "l.json", 4.30, "l")
            made = []
            tts_for = lambda v, m=None, l=None: (lambda chunk: made.append((v, chunk)) or b"MP3")
            code = ga.make_samples_eleven(out, tts_for, lambda raw, target: Path(target).write_bytes(raw) or 1.0, led, pause=0)
            self.assertEqual(code, 0)
            self.assertEqual(sorted(p.name for p in out.glob("*.mp3")), sorted(f"{v}.mp3" for v in ga.ELEVEN_VOICES))
            self.assertTrue(all(c == ga.ELEVEN_SAMPLE_TEXT for _, c in made))
            self.assertTrue(ga.ELEVEN_SAMPLE_TEXT.startswith("["))
            self.assertAlmostEqual(led.summe, 21 * len(ga.ELEVEN_SAMPLE_TEXT) * 80 / 1_000_000)

    def test_dry_run_shows_characters_cost_and_cap(self):
        with tempfile.TemporaryDirectory() as d:
            texts = Path(d) / "t.json"
            texts.write_text(json.dumps([eleven_text("q1", "x" * 100, speak="[cheerful] " + "x" * 100), {"id": "h", "kind": "variante", "refId": "h", "title": "", "text": "Eins.", "sources": []}]))
            buf = io.StringIO()
            with contextlib.redirect_stdout(buf):
                code = ga.main(["--dry-run", "--texts", str(texts), "--out", str(Path(d) / "out"), "--ledger-dir", str(Path(d) / "led")])
            self.assertEqual(code, 0)
            out = buf.getvalue()
            self.assertIn(ELEVEN, out)
            self.assertIn("111 characters", out)
            self.assertIn("0.0089 USD", out)
            self.assertIn("cap 4.30 USD", out)




class UnknownModelTest(unittest.TestCase):
    def test_a_model_without_known_price_stops_the_run_before_any_request(self):
        with tempfile.TemporaryDirectory() as d:
            texts = [eleven_text("a", "x" * 10), {"id": "z", "kind": "spruch", "refId": "mann", "title": "", "text": "Hallo.", "sources": [], "model": "elevenlabs/eleven-v5"}]
            calls = []
            buf = io.StringIO()
            with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(buf):
                code = ga.generate_all(texts, Path(d), lambda c: calls.append(c) or b"mp3", None, voice="nadine", model=ga.MODEL, pause=0, tts_for=lambda v, m=None, l=None: (lambda c: calls.append(c) or b"mp3"), save_mp3=lambda raw, target: Path(target).write_bytes(raw) or 1.0)
            self.assertEqual(code, 2)
            self.assertEqual(calls, [])
            self.assertIn("eleven-v5", buf.getvalue())

    def test_cost_estimate_refuses_an_unknown_model(self):
        with self.assertRaises(ga.UnknownModel):
            ga.estimate_cost([{"id": "z", "kind": "spruch", "refId": "m", "title": "", "text": "Hallo.", "sources": [], "model": "other/model"}])


if __name__ == "__main__":
    unittest.main()
