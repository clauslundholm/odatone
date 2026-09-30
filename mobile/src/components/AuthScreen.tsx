import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useI18n } from "../i18n/i18n";
import { useTheme } from "../theme/theme";
import { RADIUS, SPACE } from "../theme/tokens";
import { Txt } from "./Txt";

type Router = ReturnType<typeof useRouter>;

/** Leave the auth flow. Every auth screen replaces the one before it, so
    there is exactly one of them on the stack and one step back is the
    screen the customer came from. The fallback covers an auth screen
    opened cold from a link, with nothing underneath it. */
export function closeAuth(router: Router) {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}

/** The frame every auth screen shares: a close button, a title, and a
    scroll view that moves out of the keyboard's way. */
export function AuthScreen({ title, body, children }: { title: string; body?: string; children: ReactNode }) {
  const { c } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + SPACE.md,
          paddingHorizontal: SPACE.lg,
          paddingBottom: insets.bottom + SPACE.xl,
          gap: SPACE.md,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("auth.close")}
          hitSlop={12}
          onPress={() => closeAuth(router)}
          style={{ alignSelf: "flex-end" }}
        >
          <Ionicons name="close" size={26} color={c.ink2} />
        </Pressable>
        <View style={{ gap: 8 }}>
          <Txt variant="title">{title}</Txt>
          {body ? (
            <Txt variant="body" tone="ink2">
              {body}
            </Txt>
          ) : null}
        </View>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** A message about the whole form rather than one field. */
export function Notice({ text, tone = "warn" }: { text: string; tone?: "warn" | "ink2" }) {
  const { c } = useTheme();
  return (
    <View
      accessibilityRole="alert"
      style={{
        padding: SPACE.md,
        borderRadius: RADIUS.lg,
        borderWidth: 1,
        borderColor: c.line,
        backgroundColor: c.surface,
      }}
    >
      <Txt variant="body" tone={tone}>
        {text}
      </Txt>
    </View>
  );
}
