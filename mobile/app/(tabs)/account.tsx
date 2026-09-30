import Ionicons from "@expo/vector-icons/Ionicons";
import { Linking, Pressable, ScrollView, View } from "react-native";

import { Chip } from "../../src/components/Chip";
import { Mark } from "../../src/components/Cover";
import { BOTTOM_INSET, Screen, ScreenTitle, SectionHead } from "../../src/components/Screen";
import { Txt } from "../../src/components/Txt";
import { TRACKS_ARE_PLACEHOLDER } from "../../src/data/tracks";
import { useI18n } from "../../src/i18n/i18n";
import { useTheme, type ThemeMode } from "../../src/theme/theme";
import { RADIUS, SPACE } from "../../src/theme/tokens";

export default function AccountTab() {
  const { c, mode, setMode } = useTheme();
  const { t, pref, setPref } = useI18n();

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: BOTTOM_INSET }} showsVerticalScrollIndicator={false}>
        <ScreenTitle title={t("account.title")} />

        <Card>
          <Txt variant="label" tone="ink3">{t("account.plan")}</Txt>
          <Txt variant="section">{t("account.planName")}</Txt>
          <Txt variant="body" tone="ink2">{t("account.planPrice")}</Txt>
        </Card>

        <SectionHead title={t("account.preferences")} />

        <Card>
          <Txt variant="label" tone="ink3">{t("account.language")}</Txt>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
            <Chip label={t("account.system")} active={pref === "system"} onPress={() => setPref("system")} />
            <Chip label="Dansk" active={pref === "da"} onPress={() => setPref("da")} />
            <Chip label="English" active={pref === "en"} onPress={() => setPref("en")} />
          </View>
        </Card>

        <Card>
          <Txt variant="label" tone="ink3">{t("account.appearance")}</Txt>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
            {(
              [
                ["system", t("account.system")],
                ["light", t("account.light")],
                ["dark", t("account.dark")],
              ] as [ThemeMode, string][]
            ).map(([value, label]) => (
              <Chip key={value} label={label} active={mode === value} onPress={() => setMode(value)} />
            ))}
          </View>
        </Card>

        <SectionHead title={t("account.about")} />

        {TRACKS_ARE_PLACEHOLDER && (
          <Card>
            <Txt variant="label" tone="warn">{t("account.prototype")}</Txt>
            <Txt variant="body" tone="ink2">{t("account.prototypeBody")}</Txt>
          </Card>
        )}

        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Mark size={18} />
              <Txt variant="bodyStrong">{t("account.web")}</Txt>
            </View>
            <Pressable
              accessibilityRole="link"
              hitSlop={10}
              onPress={() => Linking.openURL("https://odatone.com").catch(() => {})}
            >
              <Ionicons name="open-outline" size={18} color={c.ink3} />
            </Pressable>
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <View
      style={{
        marginHorizontal: SPACE.lg,
        marginTop: SPACE.md,
        padding: SPACE.md,
        borderRadius: RADIUS.xl,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.line,
        gap: 6,
      }}
    >
      {children}
    </View>
  );
}
