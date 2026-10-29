"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  DEFAULT_FILTERS,
  TRACKS,
  filterTracks,
  type Filters,
  type Track,
} from "@/lib/tracks";
import { sourceFor } from "@/lib/catalogue/trax";
import { trialState, startTrial, type TrialState } from "@/lib/audio/trial";
import { loadSnapshot, saveSnapshot, type PlaybackSnapshot } from "@/lib/audio/session";
import type { Locale } from "@/lib/i18n";

type Ctx = {
  locale: Locale;
  /** Tracks matching the current filters, in play order. */
  queue: Track[];
  current: Track | null;
  index: number;
  playing: boolean;
  /** 0–1 */
  progress: number;
  elapsed: number;
  duration: number;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  filters: Filters;
  /** For a signed-in customer this never expires — see `setSignedIn`. */
  trial: TrialState;
  /** Whether the person at the keyboard has an Odatone account. */
  signedIn: boolean;
  /** Live analyser magnitudes, 0–1, updated on rAF while playing. */
  levels: number[];
  ready: boolean;
  blocked: boolean;

  toggle: () => void;
  play: (track?: Track) => void;
  pause: () => void;
  next: () => void;
  prev: () => void;
  seek: (fraction: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  setFilters: (update: Partial<Filters> | ((f: Filters) => Filters)) => void;
  resetFilters: () => void;
  refreshTrial: () => void;
  /** Set by components/v4/Shell when it renders for a signed-in
      customer. It lives here rather than being read from the session,
      because this provider is mounted in app/[locale]/layout.tsx and a
      session read there would take the twenty-five prerendered
      marketing pages dynamic along with it. */
  setSignedIn: (value: boolean) => void;
};

const PlayerContext = createContext<Ctx | null>(null);

const BANDS = 40;

export function usePlayer(): Ctx {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used inside <PlayerProvider>");
  return ctx;
}

export default function PlayerProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  /** The deck currently being heard. Always one of `decks`, and swapped
      at the end of a crossfade — everything else in this file reads the
      active deck through this ref, so the rest of the transport did not
      have to learn that there are now two of them. */
  const audioRef = useRef<HTMLAudioElement | null>(null);
  /** Two elements, because a crossfade is two tracks audible at once and
      one element can only hold one. The idle one is silent and paused
      except during a fade. */
  const decks = useRef<HTMLAudioElement[]>([]);
  /** The fade in flight, or null. `from` is the outgoing deck (still the
      active one until the fade lands), `to` the incoming. */
  const fade = useRef<{
    from: HTMLAudioElement;
    to: HTMLAudioElement;
    toIndex: number;
    start: number;
    seconds: number;
    raf: number;
  } | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataRef = useRef<Uint8Array | null>(null);
  const rafRef = useRef<number>(0);
  /** Set the moment playback is asked for, cleared on pause. The track can
      change between the request and the element actually having a src —
      picking a mood filters the queue and swaps the track in the same
      tick — so the load effect below consults this rather than `playing`. */
  const wantsPlay = useRef(false);
  /** Playback restored from sessionStorage, waiting for the element to
      have the right src before the position and play state are applied. */
  const pending = useRef<{ trackId: string; time: number; playing: boolean } | null>(null);
  /** Bumped whenever the listener takes control. A restore that is
      still waiting on `loadedmetadata` compares the token it was
      issued with against this before it plays, so pressing Pause in
      that window is not undone a second later by a resume nobody
      asked for. */
  const restoreToken = useRef(0);
  const snapshot = useRef<PlaybackSnapshot | null>(null);

  const [filters, setFiltersState] = useState<Filters>(DEFAULT_FILTERS);
  const [shuffle, setShuffle] = useState(false);
  const [order, setOrder] = useState<string[]>(() => TRACKS.map((t) => t.id));
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [levels, setLevels] = useState<number[]>(() => new Array(BANDS).fill(0));
  const [trial, setTrial] = useState<TrialState>(() => ({
    started: false,
    startedAt: null,
    daysLeft: 7,
    expired: false,
  }));
  const [ready, setReady] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  /* Read when a track loads rather than depended on, so that signing in
     upgrades the next track instead of interrupting this one. */
  const signedInRef = useRef(signedIn);
  signedInRef.current = signedIn;

  /* The crossfade is driven from a `timeupdate` handler bound once on
     mount, so everything it needs has to be reachable through a ref
     rather than through a closure that would be stale by the second
     track. */
  const liveRef = useRef({ queue: [] as Track[], index: 0, shuffle: false, volume: 0.8, muted: false });

  /* ---------------- queue ---------------- */

  const matching = useMemo(() => filterTracks(filters), [filters]);

  const queue = useMemo(() => {
    const pos = new Map(order.map((id, i) => [id, i]));
    return [...matching].sort((a, b) => (pos.get(a.id) ?? 0) - (pos.get(b.id) ?? 0));
  }, [matching, order]);

  const current = queue.length ? (queue[Math.min(index, queue.length - 1)] ?? null) : null;

  liveRef.current = { queue, index, shuffle, volume, muted };

  /* ---------------- crossfade ---------------- */

  /** How long the two tracks overlap. Short enough that a listener
      hears one room rather than a mashup, long enough that nothing
      reads as a cut. Capped against the outgoing track's own length
      because the demo tier serves 60-second cuts, and a six-second
      fade out of sixty is a tenth of the track. */
  const fadeSecondsFor = (d: number) => Math.max(1.5, Math.min(6, d * 0.12));

  /** The target element volume for whoever is being heard. The fade
      scales this rather than replacing it, so turning the volume down
      mid-crossfade does what it says. */
  const userVolume = () => (liveRef.current.muted ? 0 : liveRef.current.volume);

  /**
   * Abandon a fade in flight.
   *
   * Always by reverting: the incoming deck is stopped and the outgoing
   * one — which is still the active deck, since the swap only happens
   * when a fade completes — is returned to full volume and keeps
   * playing from where it is. That makes every interruption behave the
   * same way, whether it came from Pause, from a skip, or from a seek
   * back out of the fade window, and it means nothing can leave the two
   * decks in a state where both are audible.
   */
  const stopFade = useCallback((_reason: "revert" | "done") => {
    const f = fade.current;
    if (!f) return;
    cancelAnimationFrame(f.raf);
    fade.current = null;
    if (_reason === "revert") {
      f.to.pause();
      f.to.currentTime = 0;
      f.to.volume = 0;
      f.from.volume = userVolume();
    }
  }, []);

  /** The index the queue would move to on its own. Mirrors `next` —
      shuffle included — because a crossfade has to arrive at the same
      track the Next button would. */
  const upcomingIndex = () => {
    const { queue: q, index: i, shuffle: sh } = liveRef.current;
    if (q.length < 2) return -1;
    return sh ? randomOther(i, q.length) : (i + 1) % q.length;
  };

  /**
   * Begin overlapping the next track, if this is the moment for it.
   *
   * Called from the active deck's own `timeupdate`, which fires about
   * four times a second — often enough to catch the window, cheap
   * enough to run unconditionally.
   */
  const maybeStartFade = useCallback(
    (from: HTMLAudioElement) => {
      if (fade.current) return;
      if (from.paused || !wantsPlay.current) return;
      const d = from.duration;
      if (!Number.isFinite(d) || d <= 0) return;

      const full = fadeSecondsFor(d);
      const remaining = d - from.currentTime;
      if (remaining > full) return;
      /* Clamped to what is actually left rather than the nominal
         length. `timeupdate` only fires about four times a second, so
         the window is entered a fraction late; without this the fade
         would still be rising after the outgoing track had finished,
         and the overlap would end in silence instead of in the next
         track. */
      const seconds = Math.max(0.4, Math.min(full, remaining));

      const toIndex = upcomingIndex();
      if (toIndex < 0) return;
      const nextTrack = liveRef.current.queue[toIndex];
      const to = decks.current.find((a) => a !== from);
      if (!nextTrack || !to) return;

      to.setAttribute("data-track", nextTrack.id);
      to.preload = "auto";
      to.src = sourceFor(nextTrack.src, signedInRef.current);
      to.currentTime = 0;
      to.volume = 0;
      void to.play().catch(() => {
        /* Autoplay refused on the second deck — rare, since the first
           one is already playing off a gesture. Leave it: the outgoing
           track plays to its end and `ended` advances as it always
           did. */
        stopFade("revert");
      });

      const start = performance.now();
      const step = () => {
        const f = fade.current;
        if (!f) return;
        const t = Math.min(1, (performance.now() - f.start) / (f.seconds * 1000));
        const v = userVolume();
        /* Equal-power rather than linear. Two linear ramps crossing at
           half volume sum to a dip in the middle, which is the gap this
           is meant to remove. */
        f.from.volume = Math.max(0, Math.min(1, Math.cos((t * Math.PI) / 2) * v));
        f.to.volume = Math.max(0, Math.min(1, Math.sin((t * Math.PI) / 2) * v));
        if (t < 1) {
          f.raf = requestAnimationFrame(step);
          return;
        }
        /* Landed. The incoming deck becomes the active one before the
           index moves, so the load effect finds its `data-track`
           already matching and leaves the source alone. */
        f.from.pause();
        f.from.currentTime = 0;
        f.from.volume = v;
        audioRef.current = f.to;
        fade.current = null;
        setElapsed(f.to.currentTime);
        setDuration(f.to.duration || nextTrack.duration);
        /* The incoming deck started playing while it was still the idle
           one, so its own `play` event was ignored — the handlers only
           listen to whichever deck is active. Without this the dock
           offers a Play button over music that is already playing. */
        setPlaying(!f.to.paused);
        setIndex(f.toIndex);
      };

      fade.current = { from, to, toIndex, start, seconds, raf: requestAnimationFrame(step) };
    },
    [stopFade],
  );

  /* ---------------- element ---------------- */

  useEffect(() => {
    setTrial(trialState());

    const restored = loadSnapshot();
    if (restored) {
      setFiltersState(restored.filters);
      setVolumeState(restored.volume);
      setMuted(restored.muted);
      if (restored.shuffle) {
        setShuffle(true);
        setOrder(shuffled(TRACKS.map((t) => t.id)));
      }
      if (restored.trackId) {
        pending.current = {
          trackId: restored.trackId,
          time: restored.time,
          playing: restored.playing,
        };
        /* `wantsPlay` is deliberately NOT set from the snapshot.
           It used to be, and that is what made the player start on
           its own: the load effect falls back to `playing ||
           wantsPlay.current` whenever the restored track is not the
           one being loaded, and plays it FROM THE START. That became
           reachable on every visit the moment the catalogue changed —
           every saved snapshot names a placeholder id that no longer
           exists, so the restore never matches and the fallback
           always fires.

           Chrome is why this was invisible here and loud for anyone
           using the site: autoplay is refused for a new profile, and
           allowed for an origin you have engaged with before. A clean
           headless browser is exactly the wrong place to notice it.

           The restore below still resumes, because it has a track to
           resume INTO. What is gone is resuming into whatever happens
           to be first. */
      }
    }

    const made = [0, 1].map(() => {
      const a = new Audio();
      /* "metadata" until something is actually wanted. "auto" here —
         which is what the crossfade first shipped with — had every
         visitor download a megabyte of audio on page load whether or
         not they ever pressed play, and five megabytes once signed in
         and on full-length files. The incoming deck is switched to
         "auto" at the moment a fade is set up instead, which is the
         only point at which the bytes are genuinely needed. */
      a.preload = "metadata";
      a.crossOrigin = "anonymous";
      return a;
    });
    decks.current = made;
    const [el] = made;
    audioRef.current = el;
    setReady(true);

    /* Only the deck being heard drives the interface. The other one is
       either silent or half-way through a fade, and letting it set the
       clock would make the scrubber jump mid-crossfade. */
    const isActive = (a: HTMLAudioElement) => a === audioRef.current;

    const onTime = (e: Event) => {
      const a = e.currentTarget as HTMLAudioElement;
      if (!isActive(a)) return;
      setElapsed(a.currentTime);
      maybeStartFade(a);
    };
    const onMeta = (e: Event) => {
      const a = e.currentTarget as HTMLAudioElement;
      if (isActive(a)) setDuration(a.duration || 0);
    };
    const onEnd = (e: Event) => {
      const a = e.currentTarget as HTMLAudioElement;
      /* The outgoing deck ends during every successful fade, and the
         index has already moved — advancing again would skip a track.
         This is the fallback for when no fade ran at all: a duration
         the browser never reported, a queue of one, a track shorter
         than the fade. */
      if (!isActive(a) || fade.current) return;
      setIndex((i) => (queueLen.current ? (i + 1) % queueLen.current : 0));
    };
    const onPlay = (e: Event) => { if (isActive(e.currentTarget as HTMLAudioElement)) setPlaying(true); };
    const onPause = (e: Event) => {
      const a = e.currentTarget as HTMLAudioElement;
      if (!isActive(a)) return;
      /* Reaching the end of a track sets `paused` and fires this, by
         spec — which during a crossfade is the outgoing deck running
         out while the incoming one is still coming up. Treating that
         as "the listener stopped" would put a Play button over music
         that is audibly still playing, on every single track change. */
      if (fade.current && a === fade.current.from) return;
      setPlaying(false);
    };

    for (const a of made) {
      a.addEventListener("timeupdate", onTime);
      a.addEventListener("loadedmetadata", onMeta);
      a.addEventListener("ended", onEnd);
      a.addEventListener("play", onPlay);
      a.addEventListener("pause", onPause);
    }

    return () => {
      stopFade("revert");
      for (const a of made) {
        a.removeEventListener("timeupdate", onTime);
        a.removeEventListener("loadedmetadata", onMeta);
        a.removeEventListener("ended", onEnd);
        a.removeEventListener("play", onPlay);
        a.removeEventListener("pause", onPause);
      }
      // Save before tearing down: a language switch remounts this whole
      // tree, and this is the only hook that runs in that case.
      if (snapshot.current) {
        saveSnapshot({ ...snapshot.current, time: el.currentTime, playing: !el.paused });
      }
      for (const a of made) {
        a.pause();
        a.src = "";
      }
      cancelAnimationFrame(rafRef.current);
      void ctxRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const queueLen = useRef(0);
  queueLen.current = queue.length;

  /* Load the current track whenever it changes. */
  const currentId = current?.id ?? null;
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !current) return;
    /* Keyed on the track, not on the resolved URL. The URL depends on
       whether the listener is signed in, and keying on it would make
       signing in mid-track swap the source and restart the song under
       them. Keyed on the id, the track playing now plays out as it
       loaded and the next one arrives full length. */
    const url = sourceFor(current.src, signedInRef.current);
    if (el.getAttribute("data-track") !== current.id) {
      /* The track changed for a reason that is not a landed fade — a
         new mood, a filter, a track picked out of the queue. Writing a
         src onto a deck that is half-way through fading out would
         leave the incoming one playing underneath it with nothing to
         fade into. */
      stopFade("revert");
      el.setAttribute("data-track", current.id);
      el.src = url;
      setElapsed(0);
      setDuration(current.duration);
      const restore = pending.current;
      if (restore && restore.trackId === current.id) {
        pending.current = null;
        const token = ++restoreToken.current;
        const seek = () => {
          /* Metadata can arrive a second or two after the src is set,
             and the listener may have pressed Pause in between. */
          if (restoreToken.current !== token) return;
          if (Number.isFinite(el.duration)) {
            el.currentTime = Math.min(restore.time, Math.max(0, el.duration - 0.5));
          }
          if (restore.playing) {
            el.play()
              .then(() => setBlocked(false))
              .catch(() => setBlocked(true));
          }
        };
        el.readyState >= 1 ? seek() : el.addEventListener("loadedmetadata", seek, { once: true });
      } else if (playing || wantsPlay.current) {
        el.play()
          .then(() => setBlocked(false))
          .catch(() => setBlocked(true));
      }
    }
    if ("mediaSession" in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: current.title[locale],
          artist: current.artist,
          album: "Odatone",
        });
      } catch {
        /* not supported */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId, locale]);

  /* Upgrade the first track to full length once the shell reports a
     session.

     The queue exists from the first render, so a track is loaded into
     the element before Shell's effect has had a chance to call
     setSignedIn — which means a customer's FIRST track would otherwise
     always be the 60-second cut, and only the second would be whole.
     Re-resolving here fixes that, and the guard is what keeps it safe:
     only while the element is still paused at zero, so this can never
     restart something already playing. The route makes the same call
     independently and will redirect us back down to the short cut if
     the session is not real. */
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !signedIn || !current) return;
    if (!el.paused || el.currentTime > 0) return;
    const wanted = sourceFor(current.src, true);
    if (new URL(el.src || "http://x/", "http://x/").pathname === wanted) return;
    el.src = wanted;
  }, [signedIn, current]);

  /* Keep the index inside the queue when filters change. */
  useEffect(() => {
    if (queue.length === 0) wantsPlay.current = false;
    const restore = pending.current;
    if (restore) {
      const at = queue.findIndex((t) => t.id === restore.trackId);
      if (at >= 0) {
        setIndex(at);
        return;
      }
      /* The saved track is not in this queue — a different filter, or
         a catalogue that has been replaced under it. Forget it rather
         than leaving it armed against whatever lands at this index. */
      pending.current = null;
      wantsPlay.current = false;
    }
    setIndex((i) => (queue.length === 0 ? 0 : Math.min(i, queue.length - 1)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue.length]);

  useEffect(() => {
    /* `muted` goes on both decks so an incoming track cannot arrive
       loud. The volume itself is only written to the active deck when
       no fade is running — during one, the ramp owns both volumes and
       is already scaling them by this value. */
    for (const a of decks.current) a.muted = muted;
    const el = audioRef.current;
    if (el && !fade.current) el.volume = muted ? 0 : volume;
  }, [volume, muted]);

  /* ---------------- analyser ---------------- */

  const ensureGraph = useCallback(() => {
    const el = audioRef.current;
    if (!el || ctxRef.current) return;
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    try {
      const ac = new AC();
      const analyser = ac.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.78;
      /* Both decks, or the spectrum would fall to nothing for the
         length of every crossfade and then snap back. createMediaElement
         Source may only be called once per element, which is why the
         decks are made once on mount and never replaced. */
      for (const a of decks.current) ac.createMediaElementSource(a).connect(analyser);
      analyser.connect(ac.destination);
      ctxRef.current = ac;
      analyserRef.current = analyser;
      dataRef.current = new Uint8Array(analyser.frequencyBinCount);
    } catch {
      /* Safari can refuse a second source on the same element — the
         player still works, it just loses the spectrum. */
    }
  }, []);

  useEffect(() => {
    if (!playing) {
      cancelAnimationFrame(rafRef.current);
      const decay = () =>
        setLevels((prev) => {
          const nextLevels = prev.map((v) => v * 0.82);
          if (nextLevels.some((v) => v > 0.01)) rafRef.current = requestAnimationFrame(decay);
          return nextLevels;
        });
      rafRef.current = requestAnimationFrame(decay);
      return () => cancelAnimationFrame(rafRef.current);
    }

    const tick = () => {
      const analyser = analyserRef.current;
      const data = dataRef.current;
      if (analyser && data) {
        analyser.getByteFrequencyData(data as Uint8Array<ArrayBuffer>);
        const out = new Array(BANDS).fill(0);
        // log-ish grouping so the low end doesn't swamp the display
        for (let i = 0; i < BANDS; i++) {
          const lo = Math.floor(Math.pow(i / BANDS, 1.7) * data.length);
          const hi = Math.max(lo + 1, Math.floor(Math.pow((i + 1) / BANDS, 1.7) * data.length));
          let sum = 0;
          for (let j = lo; j < hi; j++) sum += data[j];
          const avg = sum / (hi - lo) / 255;
          // Slope compensation: acoustic energy falls off with frequency,
          // so without a rising gain the right-hand half of the display
          // sits flat and the whole thing looks broken.
          const tilt = 1 + (i / BANDS) * 1.9;
          out[i] = Math.min(1, Math.pow(avg, 0.72) * 1.25 * tilt);
        }
        setLevels(out);
      } else {
        // No analyser (blocked graph): fall back to a gentle synthetic bounce
        const t = performance.now() / 1000;
        setLevels(
          new Array(BANDS)
            .fill(0)
            .map((_, i) => 0.25 + 0.35 * Math.abs(Math.sin(t * 1.7 + i * 0.42))),
        );
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing]);

  /* ---------------- transport ---------------- */

  const play = useCallback(
    (track?: Track) => {
      const el = audioRef.current;
      if (!el) return;
      setTrial(startTrial());
      wantsPlay.current = true;
      ensureGraph();
      void ctxRef.current?.resume();
      if (track) {
        const i = queue.findIndex((t) => t.id === track.id);
        if (i >= 0) setIndex(i);
        if (el.getAttribute("data-track") !== track.id) {
          stopFade("revert");
          el.setAttribute("data-track", track.id);
          el.src = sourceFor(track.src, signedInRef.current);
          setElapsed(0);
        }
      }
      el.play()
        .then(() => setBlocked(false))
        .catch(() => setBlocked(true));
    },
    [queue, ensureGraph, stopFade],
  );

  const pause = useCallback(() => {
    wantsPlay.current = false;
    /* Cancels a restore that has not landed yet, as well as the one
       that is mid-flight — a pause means this listener is driving. */
    restoreToken.current += 1;
    pending.current = null;
    /* Before pausing, not after: reverting hands the active deck back
       its full volume, and pausing a deck that is half-way through
       fading out would otherwise resume at whatever level it had
       reached. */
    stopFade("revert");
    audioRef.current?.pause();
  }, [stopFade]);

  const toggle = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) play();
    else pause();
  }, [play, pause]);

  const next = useCallback(() => {
    if (!queue.length) return;
    /* A deliberate skip is a cut, not a fade: somebody who presses Next
       wants the next track now, and letting the overlap finish would
       hold them on the one they are leaving. */
    stopFade("revert");
    setIndex((i) => (shuffle ? randomOther(i, queue.length) : (i + 1) % queue.length));
  }, [queue.length, shuffle, stopFade]);

  const prev = useCallback(() => {
    stopFade("revert");
    const el = audioRef.current;
    if (el && el.currentTime > 3) {
      el.currentTime = 0;
      return;
    }
    if (!queue.length) return;
    setIndex((i) => (shuffle ? randomOther(i, queue.length) : (i - 1 + queue.length) % queue.length));
  }, [queue.length, shuffle, stopFade]);

  const seek = useCallback(
    (fraction: number) => {
      /* Scrubbing out of the tail cancels the overlap. Without this,
         dragging back to the middle of a track would leave the next one
         already playing underneath it. */
      stopFade("revert");
      const el = audioRef.current;
      if (!el || !Number.isFinite(el.duration)) return;
      el.currentTime = Math.max(0, Math.min(1, fraction)) * el.duration;
      setElapsed(el.currentTime);
    },
    [stopFade],
  );

  const setVolume = useCallback((v: number) => {
    setVolumeState(Math.max(0, Math.min(1, v)));
    setMuted(false);
  }, []);

  const toggleShuffle = useCallback(() => {
    setShuffle((s) => {
      const nextOn = !s;
      setOrder(nextOn ? shuffled(TRACKS.map((t) => t.id)) : TRACKS.map((t) => t.id));
      return nextOn;
    });
  }, []);

  const setFilters = useCallback((update: Partial<Filters> | ((f: Filters) => Filters)) => {
    setFiltersState((prev) =>
      typeof update === "function" ? update(prev) : { ...prev, ...update },
    );
    setIndex(0);
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState(DEFAULT_FILTERS);
    setIndex(0);
  }, []);

  const refreshTrial = useCallback(() => setTrial(trialState()), []);

  /* Keyboard transport, but never while the visitor is typing. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (el?.isContentEditable) return;
      if (e.code === "Space") {
        e.preventDefault();
        toggle();
      } else if (e.code === "ArrowRight" && e.shiftKey) {
        e.preventDefault();
        next();
      } else if (e.code === "ArrowLeft" && e.shiftKey) {
        e.preventDefault();
        prev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, next, prev]);

  /* A customer is not on a trial, so theirs never runs out. The demo
     window is stored per browser (lib/audio/trial.ts), which means a
     paying customer who happened to try the demo before signing up
     would otherwise have the music stopped under them on day eight —
     on their own account, in their own shop. Forced here rather than
     at each reader so there is one answer to "is this expired". */
  const effectiveTrial: TrialState = useMemo(
    () => (signedIn ? { ...trial, expired: false } : trial),
    [signedIn, trial],
  );

  /* Trial expiry stops playback. */
  useEffect(() => {
    if (effectiveTrial.expired) {
      wantsPlay.current = false;
      if (playing) pause();
    }
  }, [effectiveTrial.expired, playing, pause]);

  useEffect(() => {
    const id = window.setInterval(() => setTrial(trialState()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  /* What would be restored if this tree went away right now. */
  useEffect(() => {
    snapshot.current = {
      trackId: current?.id ?? null,
      time: elapsed,
      playing,
      volume,
      muted,
      shuffle,
      filters,
    };
  }, [current?.id, elapsed, playing, volume, muted, shuffle, filters]);

  /* A hard reload or a closed tab gets no unmount, so persist there too. */
  useEffect(() => {
    const persist = () => {
      if (snapshot.current) saveSnapshot(snapshot.current);
    };
    window.addEventListener("pagehide", persist);
    document.addEventListener("visibilitychange", persist);
    const id = window.setInterval(persist, 5000);
    return () => {
      window.removeEventListener("pagehide", persist);
      document.removeEventListener("visibilitychange", persist);
      window.clearInterval(id);
    };
  }, []);

  const value: Ctx = {
    locale,
    queue,
    current,
    index,
    playing,
    progress: duration > 0 ? elapsed / duration : 0,
    elapsed,
    duration: duration || current?.duration || 0,
    volume,
    muted,
    shuffle,
    filters,
    trial: effectiveTrial,
    signedIn,
    levels,
    ready,
    blocked,
    toggle,
    play,
    pause,
    next,
    prev,
    seek,
    setVolume,
    toggleMute: () => setMuted((m) => !m),
    toggleShuffle,
    setFilters,
    resetFilters,
    refreshTrial,
    setSignedIn,
  };

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

function randomOther(current: number, length: number): number {
  if (length <= 1) return 0;
  let n = current;
  while (n === current) n = Math.floor(Math.random() * length);
  return n;
}

function shuffled<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
