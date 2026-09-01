#!/usr/bin/env python3
"""
Generates the placeholder audio that ships with this repo.

These are NOT Odatone tracks. They are short, synthesised, royalty-free
loops so the web player is demonstrable before the real catalogue is
wired up. Replace public/audio/*.mp3 and the `src` fields in
lib/tracks.ts with real files and this script becomes unnecessary.

    python3 tools/generate-placeholder-audio.py

Requires numpy and ffmpeg.
"""

import json
import math
import os
import subprocess
import sys

import numpy as np

SR = 44100
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "audio")
BARS = 8

rng_global = np.random.default_rng(20260831)


def note(semitone, octave=0):
    """MIDI-ish semitone offset from A2 (110 Hz) -> frequency."""
    return 110.0 * (2 ** ((semitone + 12 * octave) / 12.0))


def env(n, a, d, s, r, sustain=0.7):
    """Simple ADSR over n samples, times in seconds."""
    a_n, d_n, r_n = int(a * SR), int(d * SR), int(r * SR)
    s_n = max(0, n - a_n - d_n - r_n)
    parts = [
        np.linspace(0, 1, a_n, endpoint=False) if a_n else np.zeros(0),
        np.linspace(1, sustain, d_n, endpoint=False) if d_n else np.zeros(0),
        np.full(s_n, sustain),
        np.linspace(sustain, 0, r_n) if r_n else np.zeros(0),
    ]
    out = np.concatenate(parts)
    if len(out) < n:
        out = np.concatenate([out, np.zeros(n - len(out))])
    return out[:n]


def osc(freq, n, kind="sine", detune=0.0, phase=0.0):
    t = np.arange(n) / SR
    f = freq * (1 + detune)
    ph = 2 * np.pi * f * t + phase
    if kind == "sine":
        return np.sin(ph)
    if kind == "tri":
        return 2 / np.pi * np.arcsin(np.sin(ph))
    if kind == "saw":
        # band-limited-ish: sum of a few harmonics, cheap and clean
        out = np.zeros(n)
        h = 1
        while h * f < 9000 and h <= 14:
            out += np.sin(h * ph) / h
            h += 1
        return out * 0.6
    if kind == "square":
        out = np.zeros(n)
        h = 1
        while h * f < 9000 and h <= 15:
            out += np.sin(h * ph) / h
            h += 2
        return out * 0.7
    raise ValueError(kind)


def onepole_lp(x, cutoff):
    """Cheap one-pole low pass."""
    a = math.exp(-2 * math.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc = (1 - a) * x[i] + a * acc
        y[i] = acc
    return y


def lp_fast(x, cutoff):
    """Frequency-domain low pass — far quicker than the sample loop."""
    n = len(x)
    spec = np.fft.rfft(x)
    freqs = np.fft.rfftfreq(n, 1 / SR)
    spec *= 1.0 / (1.0 + (freqs / max(cutoff, 1.0)) ** 2)
    return np.fft.irfft(spec, n)


def hp_fast(x, cutoff):
    n = len(x)
    spec = np.fft.rfft(x)
    freqs = np.fft.rfftfreq(n, 1 / SR)
    r = (freqs / max(cutoff, 1.0)) ** 2
    spec *= r / (1.0 + r)
    return np.fft.irfft(spec, n)


def place(buf, sig, at):
    i = int(at * SR)
    j = min(len(buf), i + len(sig))
    if i >= len(buf):
        return
    buf[i:j] += sig[: j - i]


def kick(dur=0.42, f0=110, f1=44, gain=0.9):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t * 26)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t * 8.5)
    click = rng_global.normal(0, 1, n) * np.exp(-t * 240) * 0.25
    return (body + click) * gain


def snare(dur=0.28, gain=0.42, tone=190):
    n = int(dur * SR)
    t = np.arange(n) / SR
    noise = hp_fast(rng_global.normal(0, 1, n), 900) * np.exp(-t * 22)
    body = np.sin(2 * np.pi * tone * t) * np.exp(-t * 30) * 0.5
    return (noise + body) * gain


def clap(dur=0.3, gain=0.34):
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for off, amp in ((0.0, 0.7), (0.011, 0.9), (0.023, 1.0)):
        i = int(off * SR)
        seg = hp_fast(rng_global.normal(0, 1, n - i), 1300) * np.exp(-t[: n - i] * 34) * amp
        out[i:] += seg
    return out * gain


def hat(dur=0.09, gain=0.16, open_=False):
    n = int(dur * (4 if open_ else 1) * SR)
    t = np.arange(n) / SR
    return hp_fast(rng_global.normal(0, 1, n), 6500) * np.exp(-t * (14 if open_ else 62)) * gain


def rim(dur=0.12, gain=0.22):
    n = int(dur * SR)
    t = np.arange(n) / SR
    return (np.sin(2 * np.pi * 1700 * t) * np.exp(-t * 90)) * gain


def brush(dur=0.5, gain=0.12):
    n = int(dur * SR)
    t = np.arange(n) / SR
    return lp_fast(hp_fast(rng_global.normal(0, 1, n), 2200), 8000) * np.exp(-t * 7) * gain


def pluck(freq, dur, gain=0.3, kind="tri", cutoff=3200):
    n = int(dur * SR)
    sig = osc(freq, n, kind) * env(n, 0.004, 0.09, 0, dur * 0.6, 0.25)
    return lp_fast(sig, cutoff) * gain


def pad(freqs, dur, gain=0.18, kind="saw", cutoff=1500, detune=0.006):
    n = int(dur * SR)
    out = np.zeros(n)
    for f in freqs:
        out += osc(f, n, kind, detune=+detune)
        out += osc(f, n, kind, detune=-detune)
    out /= max(1, len(freqs) * 2)
    out *= env(n, dur * 0.22, dur * 0.2, 0, dur * 0.42, 0.75)
    return lp_fast(out, cutoff) * gain


def bass(freq, dur, gain=0.34, kind="sine", cutoff=420):
    n = int(dur * SR)
    sig = osc(freq, n, kind) * 0.8 + osc(freq, n, "tri") * 0.2
    sig *= env(n, 0.008, 0.06, 0, dur * 0.5, 0.6)
    return lp_fast(sig, cutoff) * gain


def keys(freqs, dur, gain=0.2, cutoff=2600):
    n = int(dur * SR)
    out = np.zeros(n)
    for i, f in enumerate(freqs):
        out += osc(f, n, "sine") + 0.35 * osc(f * 2, n, "sine") + 0.14 * osc(f * 3, n, "tri")
        out[: int(0.002 * SR * i)] = 0  # tiny roll
    out /= max(1, len(freqs))
    out *= env(n, 0.006, 0.35, 0, dur * 0.5, 0.3)
    return lp_fast(out, cutoff) * gain


def reverb(x, amount=0.24, decay=1.7):
    """Cheap Schroeder-ish tail with a few delay taps."""
    out = x.copy()
    for delay_ms, g in ((37, 0.5), (61, 0.42), (89, 0.35), (131, 0.28), (191, 0.2)):
        d = int(delay_ms * SR / 1000)
        tail = np.zeros_like(x)
        tail[d:] = x[:-d] * g
        # feedback smear
        tail = lp_fast(tail, 4200)
        out += tail * amount * decay * 0.5
    return out


def formant(x, freqs, qs=None, gain=1.0):
    """Boost a few formant bands so a saw pad reads as a voice."""
    n = len(x)
    spec = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1 / SR)
    shape = np.full(len(f), 0.08)
    qs = qs or [9.0] * len(freqs)
    for fc, q in zip(freqs, qs):
        bw = fc / q
        shape += np.exp(-0.5 * ((f - fc) / bw) ** 2)
    shape *= 1.0 / (1.0 + (f / 4200.0) ** 2)
    return np.fft.irfft(spec * shape, n) * gain


def choir(freqs, dur, gain=0.16, vowel="ah"):
    """A wordless vocal layer: detuned saws through vowel formants plus breath."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    vib = 1 + 0.006 * np.sin(2 * np.pi * 5.1 * t + 0.6)
    out = np.zeros(n)
    for i, base in enumerate(freqs[:3]):
        f = base * 2.0
        ph = 2 * np.pi * np.cumsum(f * vib * (1 + (i - 1) * 0.004)) / SR
        saw = np.zeros(n)
        h = 1
        while h * f < 5200 and h <= 22:
            saw += np.sin(h * ph + i * 1.7) / h
            h += 1
        out += saw
    out /= max(1, len(freqs[:3]))
    bands = [730, 1090, 2440] if vowel == "ah" else [320, 900, 2300]
    out = formant(out, bands, [11, 13, 16])
    breath = lp_fast(hp_fast(rng_global.normal(0, 1, n), 1800), 5200) * 0.10
    out = out + breath * env(n, dur * 0.3, 0.1, 0, dur * 0.4, 0.6)
    out *= env(n, dur * 0.3, dur * 0.22, 0, dur * 0.42, 0.8)
    peak = np.max(np.abs(out)) or 1.0
    return out / peak * gain


MAJ = [0, 2, 4, 5, 7, 9, 11]
MIN = [0, 2, 3, 5, 7, 8, 10]


def chord(root, quality, octave=0):
    if quality == "maj7":
        iv = [0, 4, 7, 11]
    elif quality == "min7":
        iv = [0, 3, 7, 10]
    elif quality == "min9":
        iv = [0, 3, 7, 10, 14]
    elif quality == "maj9":
        iv = [0, 4, 7, 11, 14]
    elif quality == "dom7":
        iv = [0, 4, 7, 10]
    elif quality == "min":
        iv = [0, 3, 7]
    else:
        iv = [0, 4, 7]
    return [note(root + i, octave) for i in iv]


# --------------------------------------------------------------------- #
#  Track recipes
# --------------------------------------------------------------------- #

def build(recipe):
    bpm = recipe["bpm"]
    beat = 60.0 / bpm
    bar = beat * 4
    total = bar * BARS
    n = int(total * SR) + SR // 2
    L = np.zeros(n)
    R = np.zeros(n)

    prog = recipe["prog"]  # list of (root, quality) per bar-pair
    style = recipe["style"]
    swing = recipe.get("swing", 0.0)

    def sw(step):
        """swing offset for odd 8ths"""
        return swing * beat * 0.5 if step % 2 == 1 else 0.0

    for b in range(BARS):
        t0 = b * bar
        root, qual = prog[b % len(prog)]
        ch = chord(root, qual, octave=1)
        low = note(root, 0)

        # --- harmony ------------------------------------------------- #
        if style in ("ambient", "classical"):
            p = pad(ch, bar * 1.02, gain=recipe.get("padGain", 0.2),
                    kind="saw", cutoff=recipe.get("padCut", 1500))
            place(L, p, t0)
            place(R, np.roll(p, 220), t0)
        elif style in ("electronic", "pop"):
            p = pad(ch, bar * 1.02, gain=0.13, kind="saw", cutoff=2000)
            place(L, p, t0)
            place(R, np.roll(p, 160), t0)
            for s in range(8):
                f = ch[s % len(ch)] * (2 if s >= 4 else 1)
                pl = pluck(f, beat * 0.48, gain=0.16, cutoff=4200)
                place(L if s % 2 == 0 else R, pl, t0 + s * beat * 0.5 + sw(s))
        elif style in ("jazz", "rnb"):
            k = keys(ch, bar * 0.55, gain=0.19, cutoff=2400)
            place(L, k, t0 + beat * 0.02)
            place(R, np.roll(k, 300), t0 + beat * 0.02)
            k2 = keys([f * 1.0 for f in ch[1:]], bar * 0.3, gain=0.13, cutoff=2200)
            place(L, k2, t0 + beat * 2.5)
            place(R, np.roll(k2, 260), t0 + beat * 2.5)
        elif style == "acoustic":
            for s in range(6):
                f = ch[s % len(ch)] * (2 if s >= 3 else 1)
                pl = pluck(f, beat * 0.9, gain=0.2, kind="tri", cutoff=3600)
                place(L if s % 2 == 0 else R, pl, t0 + s * beat * 0.66)
            p = pad(ch, bar, gain=0.07, kind="tri", cutoff=1200)
            place(L, p, t0)
            place(R, p, t0)
        elif style == "hiphop":
            k = keys(ch, bar * 0.4, gain=0.17, cutoff=1800)
            place(L, k, t0)
            place(R, np.roll(k, 380), t0)
            p = pad(ch, bar, gain=0.08, kind="saw", cutoff=900)
            place(L, p, t0)
            place(R, p, t0)

        # --- bass ---------------------------------------------------- #
        if style == "ambient":
            b1 = bass(low, bar * 0.9, gain=0.22, cutoff=260)
            place(L, b1, t0)
            place(R, b1, t0)
        elif style == "classical":
            pass
        elif style == "jazz":
            walk = [0, 7, 5, 9]
            for s in range(4):
                b1 = bass(note(root + walk[s % 4], 0), beat * 0.85, gain=0.3, cutoff=500)
                place(L, b1, t0 + s * beat)
                place(R, b1, t0 + s * beat)
        elif style == "hiphop":
            for s, off in ((0, 0.0), (1, 1.5), (2, 2.0), (3, 3.5)):
                b1 = bass(low, beat * 0.7, gain=0.4, cutoff=300)
                place(L, b1, t0 + off * beat)
                place(R, b1, t0 + off * beat)
        else:
            for s in range(8):
                if s % 2 == 0 or s == 5:
                    b1 = bass(low * (2 if s == 5 else 1), beat * 0.45, gain=0.3, cutoff=420)
                    place(L, b1, t0 + s * beat * 0.5)
                    place(R, b1, t0 + s * beat * 0.5)

        # --- drums --------------------------------------------------- #
        if b == 0 and recipe.get("dropIntro", True) and style in ("electronic", "pop", "hiphop"):
            pass  # let bar 1 breathe
        elif style in ("electronic", "pop"):
            for s in range(4):
                place(L, kick(gain=0.85), t0 + s * beat)
                place(R, kick(gain=0.85), t0 + s * beat)
            for s in (1, 3):
                c = clap()
                place(L, c, t0 + s * beat)
                place(R, np.roll(c, 120), t0 + s * beat)
            for s in range(8):
                h = hat(gain=0.13 if s % 2 else 0.09, open_=(s == 7))
                place(L if s % 2 else R, h, t0 + s * beat * 0.5 + sw(s))
        elif style == "hiphop":
            for off in (0.0, 1.75, 2.5):
                place(L, kick(gain=0.95, f0=120, f1=48), t0 + off * beat)
                place(R, kick(gain=0.95, f0=120, f1=48), t0 + off * beat)
            for off in (1.0, 3.0):
                s_ = snare(gain=0.4)
                place(L, s_, t0 + off * beat)
                place(R, np.roll(s_, 90), t0 + off * beat)
            for s in range(8):
                h = hat(gain=0.1)
                place(L if s % 2 else R, h, t0 + s * beat * 0.5 + sw(s))
        elif style == "jazz":
            for s in range(4):
                place(L, brush(gain=0.1), t0 + s * beat)
                place(R, brush(gain=0.09), t0 + s * beat + beat * 0.66)
            for off in (1.0, 3.0):
                place(R, rim(gain=0.2), t0 + off * beat)
        elif style == "rnb":
            for off in (0.0, 2.5):
                place(L, kick(gain=0.7), t0 + off * beat)
                place(R, kick(gain=0.7), t0 + off * beat)
            for off in (1.0, 3.0):
                c = clap(gain=0.26)
                place(L, c, t0 + off * beat)
                place(R, np.roll(c, 140), t0 + off * beat)
            for s in range(16):
                if s % 4 != 2:
                    place(L if s % 2 else R, hat(gain=0.06), t0 + s * beat * 0.25)
        elif style == "acoustic":
            for off in (0.0, 2.0):
                place(L, kick(gain=0.4, f0=90, f1=52), t0 + off * beat)
                place(R, kick(gain=0.4, f0=90, f1=52), t0 + off * beat)
            for off in (1.0, 3.0):
                place(L, brush(gain=0.13), t0 + off * beat)
                place(R, brush(gain=0.12), t0 + off * beat)

        # --- wordless vocal ------------------------------------------ #
        if recipe.get("vox") and b >= 1:
            v = choir(ch, bar * 1.02, gain=recipe.get("voxGain", 0.17),
                      vowel=recipe.get("vowel", "ah"))
            place(L, v, t0)
            place(R, np.roll(v, 340), t0)

        # --- top line ------------------------------------------------ #
        if recipe.get("lead") and b >= 2:
            scale = MIN if "min" in qual else MAJ
            steps = recipe["lead"]
            for i, (pos, deg, dur) in enumerate(steps):
                f = note(root + scale[deg % 7] + 12 * (deg // 7), 2)
                sig = pluck(f, beat * dur, gain=0.13,
                            kind="sine" if style in ("ambient", "classical") else "tri",
                            cutoff=5200)
                place(L if i % 2 == 0 else R, sig, t0 + pos * beat)

    mix = np.vstack([L, R])
    wet = recipe.get("reverb", 0.22)
    mix = np.vstack([reverb(mix[0], wet), reverb(mix[1], wet)])

    # gentle master: soft clip + normalise + fades
    mix = np.tanh(mix * 1.25) * 0.85
    peak = np.max(np.abs(mix))
    if peak > 0:
        mix = mix / peak * 0.86
    fade = int(0.06 * SR)
    mix[:, :fade] *= np.linspace(0, 1, fade)
    mix[:, -fade:] *= np.linspace(1, 0, fade)
    return mix


def peaks_of(mono, count=180):
    step = max(1, len(mono) // count)
    out = []
    for i in range(count):
        seg = mono[i * step : (i + 1) * step]
        out.append(float(np.max(np.abs(seg))) if len(seg) else 0.0)
    m = max(out) or 1.0
    return [round(v / m, 3) for v in out]


RECIPES = [
    dict(slug="soft-open", vox=True, vowel="oo", voxGain=0.15, style="ambient", bpm=72, reverb=0.34, padGain=0.24, padCut=1100,
         prog=[(0, "min9"), (8, "maj7"), (5, "maj7"), (3, "maj9")],
         lead=[(0.0, 4, 1.6), (2.0, 2, 1.2), (3.0, 0, 1.0)]),
    dict(slug="grey-light", style="ambient", bpm=66, reverb=0.4, padGain=0.22, padCut=900,
         prog=[(5, "maj9"), (0, "min7"), (7, "maj7"), (3, "maj7")],
         lead=[(0.5, 6, 1.8), (2.5, 4, 1.4)]),
    dict(slug="counter-run", style="electronic", bpm=112, reverb=0.18, swing=0.06,
         prog=[(0, "min7"), (10, "maj7"), (5, "maj7"), (7, "min7")],
         lead=[(0.0, 4, 0.5), (1.0, 5, 0.5), (2.5, 7, 0.8)]),
    dict(slug="night-shift", vox=True, vowel="oo", voxGain=0.14, style="electronic", bpm=124, reverb=0.16, swing=0.04,
         prog=[(3, "min7"), (10, "maj7"), (8, "maj7"), (3, "min7")],
         lead=[(0.5, 3, 0.5), (1.5, 5, 0.5), (3.0, 2, 0.9)]),
    dict(slug="corner-table", vox=True, vowel="ah", voxGain=0.14, style="jazz", bpm=96, reverb=0.26, swing=0.16,
         prog=[(0, "min9"), (5, "dom7"), (10, "maj7"), (3, "maj7")],
         lead=[(0.5, 4, 0.7), (1.5, 6, 0.6), (3.0, 3, 0.9)]),
    dict(slug="late-service", style="jazz", bpm=88, reverb=0.3, swing=0.18,
         prog=[(7, "min7"), (0, "dom7"), (5, "maj7"), (2, "min7")],
         lead=[(1.0, 5, 0.8), (2.5, 2, 1.0)]),
    dict(slug="linen-and-oak", vox=True, vowel="ah", voxGain=0.15, style="acoustic", bpm=94, reverb=0.24,
         prog=[(0, "maj"), (7, "maj"), (9, "min"), (5, "maj")],
         lead=[(0.0, 2, 0.8), (1.5, 4, 0.7), (3.0, 0, 1.0)]),
    dict(slug="market-morning", style="acoustic", bpm=104, reverb=0.2,
         prog=[(5, "maj"), (0, "maj"), (7, "maj"), (9, "min")],
         lead=[(0.5, 4, 0.6), (2.0, 6, 0.7)]),
    dict(slug="slow-counter", style="hiphop", bpm=84, reverb=0.22, swing=0.14,
         prog=[(0, "min9"), (0, "min9"), (8, "maj7"), (5, "min7")],
         lead=[(1.0, 3, 0.6), (2.5, 5, 0.8)]),
    dict(slug="back-room", vox=True, vowel="oo", voxGain=0.16, style="hiphop", bpm=78, reverb=0.26, swing=0.16,
         prog=[(3, "min7"), (10, "maj7"), (3, "min7"), (8, "maj7")],
         lead=[(0.5, 2, 0.7), (2.0, 4, 0.9)]),
    dict(slug="velvet-hours", vox=True, vowel="ah", voxGain=0.2, style="rnb", bpm=92, reverb=0.28,
         prog=[(0, "min9"), (5, "min7"), (10, "maj9"), (3, "maj7")],
         lead=[(0.5, 4, 0.9), (2.5, 6, 0.8)]),
    dict(slug="high-street", vox=True, vowel="ah", voxGain=0.18, style="pop", bpm=108, reverb=0.18,
         prog=[(9, "min7"), (5, "maj"), (0, "maj"), (7, "maj")],
         lead=[(0.0, 4, 0.5), (1.0, 2, 0.5), (2.0, 0, 0.9)]),
    dict(slug="reading-room", style="classical", bpm=76, reverb=0.4, padGain=0.2, padCut=1300,
         prog=[(0, "maj7"), (7, "maj7"), (9, "min7"), (5, "maj9")],
         lead=[(0.0, 4, 1.4), (2.0, 6, 1.2), (3.0, 7, 1.0)]),
    dict(slug="second-set", style="rnb", bpm=86, reverb=0.3,
         prog=[(7, "min9"), (0, "maj7"), (5, "min7"), (10, "maj9")],
         lead=[(1.0, 3, 0.8), (2.5, 5, 0.9)]),
    dict(slug="closing-time", vox=True, vowel="oo", voxGain=0.19, style="rnb", bpm=74, reverb=0.34,
         prog=[(3, "min9"), (8, "maj7"), (10, "maj7"), (5, "min7")],
         lead=[(0.5, 5, 1.1), (2.5, 2, 1.0)]),
    dict(slug="front-window", vox=True, vowel="ah", voxGain=0.17, style="pop", bpm=118, reverb=0.16,
         prog=[(0, "maj"), (9, "min7"), (5, "maj"), (7, "maj")],
         lead=[(0.0, 2, 0.5), (1.0, 4, 0.5), (2.5, 6, 0.8)]),
    dict(slug="saturday-rush", style="pop", bpm=126, reverb=0.15,
         prog=[(5, "maj"), (7, "maj"), (9, "min7"), (0, "maj")],
         lead=[(0.5, 4, 0.5), (1.5, 6, 0.5), (3.0, 4, 0.9)]),
    dict(slug="marble-floor", style="classical", bpm=68, reverb=0.42, padGain=0.21, padCut=1200,
         prog=[(9, "min7"), (5, "maj7"), (0, "maj7"), (7, "maj9")],
         lead=[(0.0, 2, 1.5), (2.0, 4, 1.3)]),
    dict(slug="quiet-hall", vox=True, vowel="ah", voxGain=0.16, style="classical", bpm=60, reverb=0.45, padGain=0.19, padCut=1000,
         prog=[(2, "min7"), (7, "maj7"), (3, "maj9"), (10, "maj7")],
         lead=[(0.5, 6, 1.8), (2.5, 3, 1.4)]),
    dict(slug="low-ceiling", style="electronic", bpm=100, reverb=0.2, swing=0.08,
         prog=[(8, "maj7"), (3, "min7"), (10, "maj7"), (5, "min9")],
         lead=[(0.0, 3, 0.6), (1.5, 5, 0.6), (3.0, 0, 0.9)]),
    dict(slug="paper-lanterns", style="acoustic", bpm=86, reverb=0.26,
         prog=[(2, "min"), (9, "maj"), (7, "maj"), (0, "maj")],
         lead=[(0.5, 3, 0.8), (2.0, 5, 0.8)]),
    dict(slug="steam-and-tin", style="hiphop", bpm=90, reverb=0.2, swing=0.12,
         prog=[(5, "min9"), (0, "maj7"), (7, "min7"), (10, "maj7")],
         lead=[(1.0, 4, 0.6), (2.5, 2, 0.9)]),
    dict(slug="open-water", vox=True, vowel="oo", voxGain=0.18, style="ambient", bpm=58, reverb=0.46, padGain=0.23, padCut=850,
         prog=[(7, "maj9"), (2, "min7"), (9, "maj7"), (4, "min9")],
         lead=[(1.0, 4, 2.0)]),
    dict(slug="brass-hour", vox=True, vowel="ah", voxGain=0.13, style="jazz", bpm=104, reverb=0.24, swing=0.17,
         prog=[(2, "min7"), (7, "dom7"), (0, "maj7"), (5, "maj7")],
         lead=[(0.5, 6, 0.6), (1.5, 4, 0.7), (3.0, 1, 0.9)]),
]


def main():
    os.makedirs(OUT, exist_ok=True)
    manifest = []
    for r in RECIPES:
        mix = build(r)
        raw = (np.clip(mix.T.reshape(-1), -1, 1) * 32767).astype("<i2").tobytes()
        path = os.path.join(OUT, r["slug"] + ".mp3")
        proc = subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-f", "s16le", "-ar", str(SR),
             "-ac", "2", "-i", "pipe:0", "-codec:a", "libmp3lame", "-b:a", "88k",
             "-write_xing", "1", path],
            input=raw, capture_output=True,
        )
        if proc.returncode != 0:
            sys.exit(proc.stderr.decode()[:2000])
        mono = mix.mean(axis=0)
        manifest.append({
            "slug": r["slug"],
            "style": r["style"],
            "bpm": r["bpm"],
            "duration": round(len(mono) / SR, 2),
            "peaks": peaks_of(mono),
            "bytes": os.path.getsize(path),
        })
        print(f'{r["slug"]:16} {r["style"]:10} {r["bpm"]:3} bpm  '
              f'{manifest[-1]["duration"]:5.1f}s  {manifest[-1]["bytes"]/1024:6.0f} kB')

    with open(os.path.join(OUT, "..", "..", "tools", "audio-manifest.json"), "w") as f:
        json.dump(manifest, f, indent=1)
    total = sum(m["bytes"] for m in manifest)
    print(f"\n{len(manifest)} files, {total/1024/1024:.2f} MB total")


if __name__ == "__main__":
    main()
