import { ScrollView, View } from "react-native";

import { MoodTile, PlaylistRow } from "../../src/components/Cards";
import { BOTTOM_INSET, Screen, ScreenTitle, SectionHead } from "../../src/components/Screen";
import { MOODS, PLAYLISTS } from "../../src/data/catalog";
import { useI18n } from "../../src/i18n/i18n";
import { SPACE } from "../../src/theme/tokens";

export default function PlaylistsTab() {
  const { t } = useI18n();

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: BOTTOM_INSET }} showsVerticalScrollIndicator={false}>
        <ScreenTitle title={t("playlists.title")} sub={t("playlists.sub")} />

        <SectionHead title={t("playlists.moods")} />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, paddingHorizontal: SPACE.lg }}>
          {MOODS.map((m) => (
            <MoodTile key={m.id} mood={m} width={162} />
          ))}
        </View>

        <SectionHead title={t("playlists.curated")} />
        {PLAYLISTS.map((p) => (
          <PlaylistRow key={p.id} playlist={p} />
        ))}
      </ScrollView>
    </Screen>
  );
}
