import { ActivityIndicator, Pressable } from "react-native";

import { useTheme } from "../theme/theme";
import { RADIUS } from "../theme/tokens";
import { Txt } from "./Txt";

/** One button for every form. `primary` is the filled accent pill, used
    once per screen; `secondary` is the outlined alternative; `link` is
    text only, for the way out ("Forgot password?"). */
export function Button({
  label,
  onPress,
  variant = "primary",
  busy = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "link";
  busy?: boolean;
  disabled?: boolean;
}) {
  const { c } = useTheme();
  const off = busy || disabled;

  if (variant === "link") {
    return (
      <Pressable
        accessibilityRole="button"
        disabled={off}
        hitSlop={8}
        onPress={onPress}
        style={({ pressed }) => ({ alignSelf: "center", paddingVertical: 8, opacity: off ? 0.5 : pressed ? 0.6 : 1 })}
      >
        <Txt variant="bodyStrong" tone="accent">
          {label}
        </Txt>
      </Pressable>
    );
  }

  const primary = variant === "primary";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 50,
        paddingHorizontal: 20,
        borderRadius: RADIUS.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: primary ? c.accent : c.surface,
        borderWidth: primary ? 0 : 1,
        borderColor: c.line,
        opacity: off ? 0.5 : pressed ? 0.85 : 1,
      })}
    >
      {busy ? (
        <ActivityIndicator color={primary ? c.accentInk : c.ink2} />
      ) : (
        <Txt variant="bodyStrong" tone={primary ? "onAccent" : "ink"}>
          {label}
        </Txt>
      )}
    </Pressable>
  );
}
