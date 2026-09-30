import { Tabs } from "expo-router";
import type { ComponentProps } from "react";

import { TabBar } from "../../src/components/TabBar";
import { useTheme } from "../../src/theme/theme";

export default function TabsLayout() {
  const { c } = useTheme();

  return (
    <Tabs
      /* expo-router's navigator props are wider than what the bar uses;
         the cast keeps the bar's own contract small and readable. */
      tabBar={(props) => <TabBar {...(props as unknown as ComponentProps<typeof TabBar>)} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.bg } }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="playlists" />
      <Tabs.Screen name="search" />
      <Tabs.Screen name="account" />
    </Tabs>
  );
}
