import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SystemUI from "expo-system-ui";

import { PlayerProvider } from "../src/audio/PlayerProvider";
import { AuthProvider } from "../src/auth/AuthProvider";
import { I18nProvider } from "../src/i18n/i18n";
import { ThemeProvider, useTheme } from "../src/theme/theme";

/* Every auth screen is a modal over whatever the customer was looking at,
   so closing it puts them back there. */
const AUTH_MODAL = { presentation: "modal", animation: "slide_from_bottom" } as const;

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <I18nProvider>
          <AuthProvider>
            <PlayerProvider>
              <Shell />
            </PlayerProvider>
          </AuthProvider>
        </I18nProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function Shell() {
  const { c, scheme } = useTheme();

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(c.bg).catch(() => {});
  }, [c.bg]);

  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: c.bg },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="now-playing"
          options={{ presentation: "modal", animation: "slide_from_bottom" }}
        />
        <Stack.Screen name="playlist/[id]" />
        <Stack.Screen name="auth/login" options={AUTH_MODAL} />
        <Stack.Screen name="auth/forgot" options={AUTH_MODAL} />
        <Stack.Screen name="auth/verify" options={AUTH_MODAL} />
        <Stack.Screen name="auth/signup" options={AUTH_MODAL} />
        <Stack.Screen
          name="auth/gate"
          options={{
            presentation: "formSheet",
            sheetAllowedDetents: [0.45],
            sheetGrabberVisible: true,
            sheetCornerRadius: 28,
          }}
        />
      </Stack>
    </>
  );
}
