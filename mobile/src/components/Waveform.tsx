import { useRef, useState } from "react";
import { PanResponder, View } from "react-native";

import { useTheme } from "../theme/theme";

/**
 * The scrubber. Drawing 64 bars and letting the finger land anywhere on
 * them beats a 3 px line on a touch screen — and the shape is the one
 * piece of the track you can read before you hear it.
 *
 * Dragging updates a local ghost position so the bars follow the finger
 * without waiting for the audio session to report back.
 */
export function Waveform({
  peaks,
  progress,
  onSeek,
  height = 56,
}: {
  peaks: number[];
  /** 0–1 */
  progress: number;
  onSeek: (fraction: number) => void;
  height?: number;
}) {
  const { c } = useTheme();
  const [width, setWidth] = useState(0);
  const [ghost, setGhost] = useState<number | null>(null);
  const widthRef = useRef(0);
  widthRef.current = width;

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        if (!widthRef.current) return;
        setGhost(Math.min(1, Math.max(0, e.nativeEvent.locationX / widthRef.current)));
      },
      onPanResponderMove: (e) => {
        if (!widthRef.current) return;
        setGhost(Math.min(1, Math.max(0, e.nativeEvent.locationX / widthRef.current)));
      },
      onPanResponderRelease: (e) => {
        if (!widthRef.current) return;
        const f = Math.min(1, Math.max(0, e.nativeEvent.locationX / widthRef.current));
        setGhost(null);
        onSeek(f);
      },
      onPanResponderTerminate: () => setGhost(null),
    }),
  ).current;

  const at = ghost ?? progress;
  /* 64 buckets across a phone: any bigger a gap and the bars turn to lint. */
  const gap = 2;
  const barWidth = width > 0 ? Math.max(2, (width - gap * (peaks.length - 1)) / peaks.length) : 2;

  return (
    <View
      {...responder.panHandlers}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ height, justifyContent: "center" }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap, height }}>
        {peaks.map((p, i) => {
          const played = peaks.length > 0 && i / peaks.length <= at;
          return (
            <View
              key={i}
              style={{
                width: barWidth,
                height: Math.max(3, height * (0.12 + p * 0.88)),
                borderRadius: barWidth,
                backgroundColor: played ? c.accent : c.surface3,
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

/** The thin version, for the mini player. */
export function ProgressRail({ progress }: { progress: number }) {
  const { c } = useTheme();
  return (
    <View style={{ height: 3, borderRadius: 3, backgroundColor: c.surface3, overflow: "hidden" }}>
      <View
        style={{
          height: 3,
          borderRadius: 3,
          width: `${Math.min(100, Math.max(0, progress * 100))}%`,
          backgroundColor: c.accent,
        }}
      />
    </View>
  );
}
