import { Text, type TextProps, type TextStyle } from "react-native";

import { useTheme } from "../theme/theme";
import { TYPE } from "../theme/tokens";

type Variant = keyof typeof TYPE;
type Tone = "ink" | "ink2" | "ink3" | "accent" | "warn" | "onAccent";

/**
 * Every piece of text in the app goes through here, so a variant and a
 * tone are the only two decisions a screen has to make.
 */
export function Txt({
  variant = "body",
  tone = "ink",
  style,
  ...rest
}: TextProps & { variant?: Variant; tone?: Tone }) {
  const { c } = useTheme();
  const colour =
    tone === "ink2" ? c.ink2
    : tone === "ink3" ? c.ink3
    : tone === "accent" ? c.accent
    : tone === "warn" ? c.warn
    : tone === "onAccent" ? c.accentInk
    : c.ink;

  return <Text {...rest} style={[TYPE[variant] as TextStyle, { color: colour }, style]} />;
}
