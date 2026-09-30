import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Keyboard, Pressable, ScrollView, TextInput, View } from "react-native";

import { usePlayer } from "../../src/audio/PlayerProvider";
import { Chip } from "../../src/components/Chip";
import { BOTTOM_INSET, Screen, ScreenTitle } from "../../src/components/Screen";
import { TrackRow } from "../../src/components/TrackRow";
import { Txt } from "../../src/components/Txt";
import { GENRES, MOODS } from "../../src/data/catalog";
import { TRACKS, type Track } from "../../src/data/tracks";
import { useI18n } from "../../src/i18n/i18n";
import { trackCount } from "../../src/lib/format";
import { useTheme } from "../../src/theme/theme";
import { RADIUS, SPACE } from "../../src/theme/tokens";
import type { Genre, Mood } from "../../src/types";

const RECENTS_KEY = "odatone.search.recent.v1";
const MAX_RECENTS = 6;

type Vox = "any" | "with" | "without";

export default function SearchTab() {
  const { c } = useTheme();
  const { t, l, locale } = useI18n();
  const { playTrack } = usePlayer();

  const [query, setQuery] = useState("");
  const [genres, setGenres] = useState<Genre[]>([]);
  const [mood, setMood] = useState<Mood | null>(null);
  const [vox, setVox] = useState<Vox>("any");
  const [recents, setRecents] = useState<string[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(RECENTS_KEY)
      .then((v) => {
        if (!v) return;
        const parsed: unknown = JSON.parse(v);
        if (Array.isArray(parsed)) setRecents(parsed.filter((x): x is string => typeof x === "string"));
      })
      .catch(() => {});
  }, []);

  const remember = useCallback((term: string) => {
    const clean = term.trim();
    if (clean.length < 2) return;
    setRecents((prev) => {
      const next = [clean, ...prev.filter((r) => r.toLowerCase() !== clean.toLowerCase())].slice(0, MAX_RECENTS);
      AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const clearRecents = useCallback(() => {
    setRecents([]);
    AsyncStorage.removeItem(RECENTS_KEY).catch(() => {});
  }, []);

  /* Search runs over both languages at once, so "calm" finds the same
     tracks as "rolig" whichever language the app is in. */
  const results = useMemo<Track[]>(() => {
    const q = query.trim().toLowerCase();
    return TRACKS.filter((track) => {
      if (genres.length && !genres.includes(track.genre)) return false;
      if (mood && track.mood !== mood) return false;
      if (vox === "with" && !track.vox) return false;
      if (vox === "without" && track.vox) return false;
      if (!q) return true;
      const genre = GENRES.find((g) => g.id === track.genre);
      const m = MOODS.find((x) => x.id === track.mood);
      const haystack = [
        track.title.da, track.title.en, track.artist,
        genre?.label.da, genre?.label.en, m?.label.da, m?.label.en,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [genres, mood, query, vox]);

  const filtered = genres.length > 0 || mood !== null || vox !== "any";
  const idle = query.trim().length === 0 && !filtered;

  return (
    <Screen>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: BOTTOM_INSET }}
        showsVerticalScrollIndicator={false}
      >
        <ScreenTitle title={t("search.title")} />

        <View style={{ paddingHorizontal: SPACE.lg }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              paddingHorizontal: 14,
              height: 46,
              borderRadius: RADIUS.pill,
              backgroundColor: c.surface,
              borderWidth: 1,
              borderColor: c.line,
            }}
          >
            <Ionicons name="search" size={17} color={c.ink3} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => {
                remember(query);
                Keyboard.dismiss();
              }}
              placeholder={t("search.placeholder")}
              placeholderTextColor={c.ink3}
              returnKeyType="search"
              autoCorrect={false}
              style={{ flex: 1, color: c.ink, fontSize: 15, letterSpacing: -0.1 }}
            />
            {query.length > 0 && (
              <Pressable accessibilityRole="button" hitSlop={10} onPress={() => setQuery("")}>
                <Ionicons name="close-circle" size={17} color={c.ink3} />
              </Pressable>
            )}
          </View>
        </View>

        {/* filters */}
        <FilterRow title={t("search.mood")}>
          {MOODS.map((m) => (
            <Chip
              key={m.id}
              label={l(m.label)}
              active={mood === m.id}
              onPress={() => setMood((cur) => (cur === m.id ? null : m.id))}
            />
          ))}
        </FilterRow>

        <FilterRow title={t("search.genre")}>
          {GENRES.map((g) => (
            <Chip
              key={g.id}
              label={l(g.label)}
              active={genres.includes(g.id)}
              onPress={() =>
                setGenres((cur) => (cur.includes(g.id) ? cur.filter((x) => x !== g.id) : [...cur, g.id]))
              }
            />
          ))}
        </FilterRow>

        <FilterRow title={t("search.vocals")}>
          {(
            [
              ["any", t("search.vocalsAny")],
              ["without", t("search.vocalsWithout")],
              ["with", t("search.vocalsWith")],
            ] as [Vox, string][]
          ).map(([value, label]) => (
            <Chip key={value} label={label} active={vox === value} onPress={() => setVox(value)} />
          ))}
        </FilterRow>

        {filtered && (
          <Pressable
            onPress={() => {
              setGenres([]);
              setMood(null);
              setVox("any");
            }}
            style={{ paddingHorizontal: SPACE.lg, paddingTop: SPACE.md }}
          >
            <Txt variant="label" tone="accent">{t("search.reset")}</Txt>
          </Pressable>
        )}

        {/* recents */}
        {idle && recents.length > 0 && (
          <>
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
              <Txt variant="section">{t("search.recent")}</Txt>
              <Pressable onPress={clearRecents} hitSlop={8}>
                <Txt variant="label" tone="accent">{t("search.clear")}</Txt>
              </Pressable>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: SPACE.lg }}>
              {recents.map((r) => (
                <Chip key={r} label={r} onPress={() => setQuery(r)} />
              ))}
            </View>
          </>
        )}

        {/* results */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: SPACE.lg,
            marginTop: SPACE.xl,
            marginBottom: SPACE.xs,
          }}
        >
          <Txt variant="section">{idle ? t("search.browse") : trackCount(results.length, locale)}</Txt>
        </View>

        {results.length === 0 ? (
          <View style={{ paddingHorizontal: SPACE.lg, paddingTop: SPACE.md, gap: 6 }}>
            <Txt variant="bodyStrong">{t("search.noResults")}</Txt>
            <Txt variant="body" tone="ink2">{t("search.noResultsBody")}</Txt>
          </View>
        ) : (
          results.map((item) => (
            <TrackRow
              key={item.id}
              track={item}
              onPress={() => {
                remember(query);
                playTrack(item, results, t("search.title"));
              }}
            />
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

function FilterRow({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: SPACE.lg }}>
      <Txt variant="label" tone="ink3" style={{ paddingHorizontal: SPACE.lg, marginBottom: 8 }}>
        {title}
      </Txt>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: SPACE.lg, gap: 8 }}
      >
        {children}
      </ScrollView>
    </View>
  );
}
