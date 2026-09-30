import type { ReactNode } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../theme/theme";
import { SPACE } from "../theme/tokens";
import { Txt } from "./Txt";

/** Room for the mini player and the tab bar under every scroll view. */
export const BOTTOM_INSET = 152;

export function Screen({ children }: { children: ReactNode }) {
  const { c } = useTheme();
  return <View style={{ flex: 1, backgroundColor: c.bg }}>{children}</View>;
}

export function ScreenTitle({ title, sub }: { title: string; sub?: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top + SPACE.md, paddingHorizontal: SPACE.lg, paddingBottom: SPACE.md }}>
      <Txt variant="display">{title}</Txt>
      {sub ? (
        <Txt variant="body" tone="ink2" style={{ marginTop: 8, maxWidth: 340 }}>
          {sub}
        </Txt>
      ) : null}
    </View>
  );
}

export function SectionHead({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: SPACE.lg,
        marginTop: SPACE.xl,
        marginBottom: SPACE.sm,
      }}
    >
      <Txt variant="section">{title}</Txt>
      {action}
    </View>
  );
}
