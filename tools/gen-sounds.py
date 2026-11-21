#!/usr/bin/env python3
"""Synthesises the chess sounds (own work, no samples): wooden knocks by modal synthesis.

Each knock is a short noise burst plus a few damped sine modes. Deterministic (fixed seeds), Python stdlib only.
Usage: python3 tools/gen-sounds.py [outdir]   -> WAV files; then ffmpeg -> public/sounds/*.mp3 (see tools/gen-sounds.sh).
"""
import math
import os
import random
import struct
import sys
import wave

RATE = 44100
PEAK = 10 ** (-3 / 20)  # -3 dBFS


def knock(f0, tau_ms, dur_ms, seed, noise=0.6, modes=((1.0, 1.0), (2.76, 0.5), (5.40, 0.25))):
    """One wooden strike: damped modes (ratio, amplitude) plus a lowpassed noise transient."""
    rnd = random.Random(seed)
    n = int(RATE * dur_ms / 1000)
    out = [0.0] * n
    for ratio, amp in modes:
        w = 2 * math.pi * f0 * ratio / RATE
        tau = tau_ms / 1000 * RATE / (1 + 0.6 * (ratio - 1))  # higher modes die faster
        phase = rnd.uniform(0, 0.4)
        for i in range(n):
            out[i] += amp * math.exp(-i / tau) * math.sin(w * i + phase)
    lp = 0.0
    for i in range(int(RATE * 0.006)):
        lp += 0.35 * (rnd.uniform(-1, 1) - lp)
        out[i] += noise * lp * math.exp(-i / (RATE * 0.0012))
    return out


def mix(events, dur_ms):
    n = int(RATE * dur_ms / 1000)
    buf = [0.0] * n
    for offset_ms, gain, sig in events:
        o = int(RATE * offset_ms / 1000)
        for i, v in enumerate(sig):
            if o + i < n:
                buf[o + i] += gain * v
    return buf


def finish(buf):
    """Short fade in/out (no clicks), normalised to -3 dBFS."""
    fi, fo = int(RATE * 0.0004), int(RATE * 0.012)
    for i in range(fi):
        buf[i] *= i / fi
    for i in range(fo):
        buf[-1 - i] *= i / fo
    peak = max(abs(x) for x in buf) or 1.0
    return [x * PEAK / peak for x in buf]


def tone(freqs, tau_ms, dur_ms, partials=((1, 1.0), (2, 0.3))):
    n = int(RATE * dur_ms / 1000)
    out = [0.0] * n
    for f in freqs:
        for k, a in partials:
            w = 2 * math.pi * f * k / RATE
            for i in range(n):
                out[i] += a * math.exp(-i / (tau_ms / 1000 * RATE)) * math.sin(w * i)
    return out


SOUNDS = {
    'move': lambda: mix([(0, 1, knock(520, 14, 85, 1))], 85),
    'capture': lambda: mix([(0, 1, knock(380, 22, 125, 2, noise=0.9)), (28, 0.8, knock(300, 18, 97, 3, noise=0.5))], 125),
    'check': lambda: mix([(0, 1, knock(520, 14, 100, 4)), (55, 0.7, tone([1568], 30, 120))], 175),
    'castle': lambda: mix([(0, 1, knock(480, 14, 85, 5)), (110, 0.9, knock(560, 14, 85, 6))], 195),
    'promote': lambda: mix([(0, 0.8, knock(520, 12, 70, 7)), (45, 0.7, tone([784], 35, 110)), (110, 0.7, tone([1175], 40, 150))], 260),
    'wrong': lambda: mix([(0, 1, knock(150, 16, 110, 8, noise=0.4, modes=((1.0, 1.0), (1.9, 0.4))))], 110),
    'end': lambda: mix([(0, 0.8, tone([392, 494, 587], 160, 600, ((1, 1.0), (2.01, 0.25), (3.02, 0.1))))], 600),
    'correct': lambda: mix([(0, 0.7, tone([1047], 28, 90)), (70, 0.8, tone([1319], 45, 170))], 240),
}


def synth(name):
    return finish(SOUNDS[name]())


# --- Set "Brett": wooden piece with a felt base set on a wooden board (own synthesis, three varied takes per event) ---

def thud(seed, variant, f0=210, level=1.0, dur_ms=110):
    """Felt on wood: dull board resonance (150-300 Hz), a short wooden tick, felt-damped noise."""
    rnd = random.Random(seed * 10 + variant)
    pitch = (0.93, 1.0, 1.08)[variant - 1] * rnd.uniform(0.98, 1.02)
    damp = (1.1, 1.0, 0.85)[variant - 1]
    hit = (0.9, 1.0, 1.1)[variant - 1]
    n = int(RATE * dur_ms / 1000)
    out = [0.0] * n
    for ratio, amp, tau_ms in ((1.0, 1.0, 26), (2.1, 0.45, 14), (3.3, 0.18, 8)):
        w = 2 * math.pi * f0 * pitch * ratio / RATE
        tau = tau_ms * damp / 1000 * RATE
        for i in range(n):
            out[i] += amp * math.exp(-i / tau) * math.sin(w * i)
    lp = 0.0
    for i in range(min(n, int(RATE * 0.010))):  # felt: heavy lowpass on the noise
        lp += 0.07 * (rnd.uniform(-1, 1) - lp)
        out[i] += 2.2 * lp * math.exp(-i / (RATE * 0.0025))
    w = 2 * math.pi * 880 * pitch / RATE  # short, quiet wood tick
    for i in range(min(n, int(RATE * 0.012))):
        out[i] += 0.12 * math.exp(-i / (RATE * 0.0025)) * math.sin(w * i)
    return [x * level * hit for x in out]


def slide(seed, variant, dur_ms=60):
    """Soft gliding of the felt over the board before the piece is set down."""
    rnd = random.Random(seed * 10 + variant + 500)
    n = int(RATE * dur_ms / 1000)
    lp = 0.0
    out = []
    for i in range(n):
        lp += 0.05 * (rnd.uniform(-1, 1) - lp)
        out.append(0.5 * lp * math.sin(math.pi * i / n) ** 2)
    return out


def _move(v):
    d = (0, 40, 60)[v - 1]  # takes 2 and 3 are longer moves with a soft glide before the piece is set down
    glide = [(0, 0.35, slide(1, v, d))] if d else []
    return mix(glide + [(d, 1, thud(1, v))], 110 + d)


BRETT = {
    'move': _move,
    'capture': lambda v: mix([(0, 0.5, knock(700, 6, 40, 20 + v, noise=0.3, modes=((1.0, 1.0), (1.7, 0.5)))), (35, 1.1, thud(2, v, f0=190, level=1.0, dur_ms=120))], 160),
    'check': lambda v: mix([(0, 1.35, thud(3, v, f0=240, dur_ms=120))], 120),
    'castle': lambda v: mix([(0, 1, thud(4, v, f0=200)), (150, 0.85, thud(5, v, f0=230))], 260),
    'promote': lambda v: mix([(0, 1, thud(6, v, f0=220)), (70, 0.5, tone([1760 * (0.97, 1.0, 1.03)[v - 1]], 40, 160))], 240),
    'wrong': lambda v: mix([(0, 1, thud(7, v, f0=130, dur_ms=130))], 130),
    'end': lambda v: mix([(0, 1, thud(8, v, f0=170, dur_ms=130)), (110, 0.55, thud(9, v, f0=150, dur_ms=300)), (260, 0.3, tone([196 * (0.99, 1.0, 1.01)[v - 1]], 160, 450))], 700),
    'correct': lambda v: mix([(0, 0.9, thud(10, v, f0=250, dur_ms=100)), (60, 0.5, tone([1319 * (0.98, 1.0, 1.02)[v - 1]], 45, 200))], 260),
}


def synth_brett(name, variant):
    return finish(BRETT[name](variant))


def write_wav(path, samples):
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(b''.join(struct.pack('<h', int(round(max(-1.0, min(1.0, x)) * 32767))) for x in samples))


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'public/sounds'
    os.makedirs(out, exist_ok=True)
    for name in SOUNDS:
        write_wav(os.path.join(out, name + '.wav'), synth(name))
        print(name)
    os.makedirs(os.path.join(out, 'brett'), exist_ok=True)
    for name in BRETT:
        for v in (1, 2, 3):
            write_wav(os.path.join(out, 'brett', f'{name}-{v}.wav'), synth_brett(name, v))
