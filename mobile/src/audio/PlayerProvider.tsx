import { setAudioModeAsync, useAudioPlayer, type AudioPlayer } from "expo-audio";
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

import { router } from "expo-router";

import { useAuth } from "../auth/AuthProvider";
import { gateFor } from "../auth/entitlement.ts";
import { TRACKS, type Track } from "../data/tracks";
import { AUDIO } from "./assets";

export type RepeatMode = "off" | "all" | "one";

type PlayerValue = {
  /** The expo-audio instance. Screens that need the play head subscribe
   *  to it themselves with useAudioPlayerStatus, so a 4 Hz status tick
   *  does not re-render the whole tree. */
  player: AudioPlayer;
  track: Track | null;
  queue: Track[];
  /** Where the queue came from — "Rolig", "Frokostpuls", "Søgning". */
  source: string | null;
  playing: boolean;
  shuffle: boolean;
  repeat: RepeatMode;

  playTrack: (track: Track, queue?: Track[], source?: string) => void;
  playList: (queue: Track[], source: string, opts?: { shuffle?: boolean }) => void;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  seekTo: (seconds: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
};

const Ctx = createContext<PlayerValue | null>(null);

/** Fisher–Yates, seeded by nothing in particular — shuffle should feel
 *  arbitrary, and the queue is short enough that bias does not show. */
function shuffled<T>(list: T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const player = useAudioPlayer(null, { updateInterval: 250 });

  const [queue, setQueue] = useState<Track[]>(TRACKS);
  const [index, setIndex] = useState(-1);
  const [source, setSource] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>("all");

  /* The track can change in the same tick as the play request — picking a
     mood swaps the queue and the track at once — so the load effect asks
     this ref rather than `playing`, which has not updated yet. Same fix as
     the website's PlayerProvider. */
  const wantsPlay = useRef(false);
  const queueRef = useRef(queue);
  const indexRef = useRef(index);
  const repeatRef = useRef(repeat);
  queueRef.current = queue;
  indexRef.current = index;
  repeatRef.current = repeat;

  /* Refs, not state in the callbacks' dependency lists: every play
     control would otherwise be rebuilt each time the account refreshes. */
  const { ready, entitled, signedIn, checking } = useAuth();
  const readyRef = useRef(ready);
  const entitledRef = useRef(entitled);
  const signedInRef = useRef(signedIn);
  const checkingRef = useRef(checking);
  readyRef.current = ready;
  entitledRef.current = entitled;
  signedInRef.current = signedIn;
  checkingRef.current = checking;
  const lastGate = useRef(0);

  /** May playback start? If not, says why — once, however many times
      the button is tapped. Pausing never asks. */
  const guard = useCallback(() => {
    if (entitledRef.current) return true;
    /* The stored session has not been read yet, or someone is signed in
       and their account has not been read yet. Telling a customer who is
       logged in to log in, or that their subscription is not active,
       because they tapped in that first moment, would be wrong; doing
       nothing for that moment is not. */
    if (!readyRef.current || checkingRef.current) return false;
    const now = Date.now();
    if (now - lastGate.current > 1000) {
      lastGate.current = now;
      router.push({ pathname: "/auth/gate", params: { kind: gateFor(signedInRef.current) } });
    }
    return false;
  }, []);

  const track = index >= 0 && index < queue.length ? queue[index] : null;

  /* ---- audio session: keep playing when the app goes to the background,
         and do not go silent because the ringer switch is off ---- */
  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: "duckOthers",
      allowsRecording: false,
      shouldRouteThroughEarpiece: false,
    }).catch(() => {
      /* not fatal — playback still works, it just stops in the background */
    });
  }, []);

  /* ---- load whatever track is current ---- */
  useEffect(() => {
    if (!track) return;
    const asset = AUDIO[track.id];
    if (asset === undefined) return; // catalogue entry without a bundled file
    player.replace(asset);
    /* Not entitled (and not merely waiting for an answer): do not arm the
       lock screen, whose play button reaches the native player directly. */
    if (entitledRef.current || checkingRef.current) {
      try {
        player.setActiveForLockScreen(true, {
          title: track.title.da,
          artist: track.artist,
          albumTitle: "Odatone",
        });
      } catch {
        /* lock-screen controls need a dev build; Expo Go just plays */
      }
    }
    if (wantsPlay.current && entitledRef.current) player.play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track?.id]);

  /* ---- advance at the end of a track ---- */
  useEffect(() => {
    const sub = player.addListener("playbackStatusUpdate", (status) => {
      setPlaying((was) => (was === status.playing ? was : status.playing));
      /* Any resume that did not come through guard() — lock screen,
         Control Center, a headphone button, an interruption ending —
         is stopped here. Like the effect below, leave it alone while an
         account read is in flight. */
      if (status.playing && !entitledRef.current && !checkingRef.current) {
        wantsPlay.current = false;
        player.pause();
        return;
      }
      if (!status.didJustFinish) return;

      const q = queueRef.current;
      const i = indexRef.current;
      if (repeatRef.current === "one" && entitledRef.current) {
        player.seekTo(0).then(() => player.play()).catch(() => {});
        return;
      }
      if (i + 1 < q.length) {
        setIndex(i + 1);
        return;
      }
      if (repeatRef.current === "all" && q.length) {
        setIndex(0);
        return;
      }
      wantsPlay.current = false;
      setPlaying(false);
    });
    return () => sub.remove();
  }, [player]);

  /* ---- entitlement lost while playing: a subscription cancelled in
         /admin, found out when the app came back to the foreground.
         While `checking` there is no answer yet (and never a cached yes,
         see isChecking), so nothing is paused on that alone. ---- */
  useEffect(() => {
    if (entitled || checking) return;
    wantsPlay.current = false;
    player.pause();
    try {
      player.setActiveForLockScreen(false);
    } catch {
      /* lock-screen controls need a dev build */
    }
  }, [entitled, checking, player]);

  /* ---- signed out: the next person at this phone starts from nothing,
         not from the last customer's queue ---- */
  useEffect(() => {
    if (signedIn) return;
    setIndex(-1);
    setSource(null);
    setQueue(TRACKS);
    setShuffle(false);
    try {
      player.setActiveForLockScreen(false);
    } catch {
      /* lock-screen controls need a dev build; nothing to clear in Expo Go */
    }
  }, [signedIn, player]);

  const playTrack = useCallback(
    (next: Track, nextQueue?: Track[], nextSource?: string) => {
      if (!guard()) return;
      const q = nextQueue?.length ? nextQueue : queueRef.current;
      const at = q.findIndex((t) => t.id === next.id);
      wantsPlay.current = true;
      if (nextQueue?.length) setQueue(q);
      if (nextSource !== undefined) setSource(nextSource);
      if (at === indexRef.current && q === queueRef.current) {
        player.play();
        return;
      }
      setIndex(at >= 0 ? at : 0);
    },
    [guard, player],
  );

  const playList = useCallback(
    (list: Track[], label: string, opts?: { shuffle?: boolean }) => {
      if (!list.length || !guard()) return;
      const q = opts?.shuffle ? shuffled(list) : list;
      if (opts?.shuffle) setShuffle(true);
      wantsPlay.current = true;
      setQueue(q);
      setSource(label);
      setIndex(0);
    },
    [guard],
  );

  const toggle = useCallback(() => {
    if (!track) {
      playList(TRACKS, "Odatone");
      return;
    }
    if (player.playing) {
      wantsPlay.current = false;
      player.pause();
    } else {
      if (!guard()) return;
      wantsPlay.current = true;
      player.play();
    }
  }, [guard, playList, player, track]);

  const next = useCallback(() => {
    const q = queueRef.current;
    if (!q.length || !guard()) return;
    wantsPlay.current = true;
    setIndex((i) => (i + 1 < q.length ? i + 1 : 0));
  }, [guard]);

  const previous = useCallback(() => {
    if (!guard()) return;
    /* Standard player behaviour: the first press restarts the track. */
    if (player.currentTime > 3) {
      player.seekTo(0).catch(() => {});
      return;
    }
    const q = queueRef.current;
    wantsPlay.current = true;
    setIndex((i) => (i - 1 >= 0 ? i - 1 : Math.max(0, q.length - 1)));
  }, [guard, player]);

  const seekTo = useCallback(
    (seconds: number) => {
      player.seekTo(Math.max(0, seconds)).catch(() => {});
    },
    [player],
  );

  const toggleShuffle = useCallback(() => {
    setShuffle((on) => {
      const nowOn = !on;
      setQueue((q) => {
        if (!q.length) return q;
        const current = indexRef.current >= 0 ? q[indexRef.current] : null;
        const reordered = nowOn ? shuffled(q) : [...q].sort((a, b) => a.id.localeCompare(b.id));
        if (current) {
          const at = reordered.findIndex((t) => t.id === current.id);
          if (at > 0) {
            reordered.splice(at, 1);
            reordered.unshift(current);
          }
          setIndex(0);
        }
        return reordered;
      });
      return nowOn;
    });
  }, []);

  const cycleRepeat = useCallback(() => {
    setRepeat((r) => (r === "all" ? "one" : r === "one" ? "off" : "all"));
  }, []);

  const value = useMemo<PlayerValue>(
    () => ({
      player,
      track,
      queue,
      source,
      playing,
      shuffle,
      repeat,
      playTrack,
      playList,
      toggle,
      next,
      previous,
      seekTo,
      toggleShuffle,
      cycleRepeat,
    }),
    [
      player, track, queue, source, playing, shuffle, repeat,
      playTrack, playList, toggle, next, previous, seekTo, toggleShuffle, cycleRepeat,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlayer(): PlayerValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePlayer must be used inside <PlayerProvider>");
  return v;
}
