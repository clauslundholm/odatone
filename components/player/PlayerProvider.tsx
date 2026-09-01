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
  trial: TrialState;
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
  const audioRef = useRef<HTMLAudioElement | null>(null);
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

  /* ---------------- queue ---------------- */

  const matching = useMemo(() => filterTracks(filters), [filters]);

  const queue = useMemo(() => {
    const pos = new Map(order.map((id, i) => [id, i]));
    return [...matching].sort((a, b) => (pos.get(a.id) ?? 0) - (pos.get(b.id) ?? 0));
  }, [matching, order]);

  const current = queue.length ? (queue[Math.min(index, queue.length - 1)] ?? null) : null;

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
        wantsPlay.current = restored.playing;
      }
    }

    const el = new Audio();
    el.preload = "metadata";
    el.crossOrigin = "anonymous";
    audioRef.current = el;
    setReady(true);

    const onTime = () => setElapsed(el.currentTime);
    const onMeta = () => setDuration(el.duration || 0);
    const onEnd = () => setIndex((i) => (queueLen.current ? (i + 1) % queueLen.current : 0));
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);

    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("ended", onEnd);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);

    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("ended", onEnd);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      // Save before tearing down: a language switch remounts this whole
      // tree, and this is the only hook that runs in that case.
      if (snapshot.current) {
        saveSnapshot({ ...snapshot.current, time: el.currentTime, playing: !el.paused });
      }
      el.pause();
      el.src = "";
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
    const url = current.src;
    if (el.getAttribute("data-src") !== url) {
      el.setAttribute("data-src", url);
      el.src = url;
      setElapsed(0);
      setDuration(current.duration);
      const restore = pending.current;
      if (restore && restore.trackId === current.id) {
        pending.current = null;
        const seek = () => {
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
    }
    setIndex((i) => (queue.length === 0 ? 0 : Math.min(i, queue.length - 1)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue.length]);

  useEffect(() => {
    const el = audioRef.current;
    if (el) {
      el.volume = muted ? 0 : volume;
      el.muted = muted;
    }
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
      const src = ac.createMediaElementSource(el);
      const analyser = ac.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.78;
      src.connect(analyser);
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
        if (el.getAttribute("data-src") !== track.src) {
          el.setAttribute("data-src", track.src);
          el.src = track.src;
          setElapsed(0);
        }
      }
      el.play()
        .then(() => setBlocked(false))
        .catch(() => setBlocked(true));
    },
    [queue, ensureGraph],
  );

  const pause = useCallback(() => {
    wantsPlay.current = false;
    audioRef.current?.pause();
  }, []);

  const toggle = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) play();
    else pause();
  }, [play, pause]);

  const next = useCallback(() => {
    if (!queue.length) return;
    setIndex((i) => (shuffle ? randomOther(i, queue.length) : (i + 1) % queue.length));
  }, [queue.length, shuffle]);

  const prev = useCallback(() => {
    const el = audioRef.current;
    if (el && el.currentTime > 3) {
      el.currentTime = 0;
      return;
    }
    if (!queue.length) return;
    setIndex((i) => (shuffle ? randomOther(i, queue.length) : (i - 1 + queue.length) % queue.length));
  }, [queue.length, shuffle]);

  const seek = useCallback((fraction: number) => {
    const el = audioRef.current;
    if (!el || !Number.isFinite(el.duration)) return;
    el.currentTime = Math.max(0, Math.min(1, fraction)) * el.duration;
    setElapsed(el.currentTime);
  }, []);

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

  /* Trial expiry stops playback. */
  useEffect(() => {
    if (trial.expired) {
      wantsPlay.current = false;
      if (playing) pause();
    }
  }, [trial.expired, playing, pause]);

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
    trial,
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
