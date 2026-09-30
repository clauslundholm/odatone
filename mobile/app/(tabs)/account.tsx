import Ionicons from "@expo/vector-icons/Ionicons";
import { Linking, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";

import { useAuth } from "../../src/auth/AuthProvider";
import { API_URL } from "../../src/auth/supabase";
import { Button } from "../../src/components/Button";

import { Chip } from "../../src/components/Chip";
import { Mark } from "../../src/components/Cover";
import { BOTTOM_INSET, Screen, ScreenTitle, SectionHead } from "../../src/components/Screen";
import { Txt } from "../../src/components/Txt";
import { usePlans } from "../../src/data/plans";
import { TRACKS_ARE_PLACEHOLDER } from "../../src/data/tracks";
import { useI18n } from "../../src/i18n/i18n";
import { STRINGS, type StringKey } from "../../src/i18n/strings";
import { useTheme, type ThemeMode } from "../../src/theme/theme";
import { RADIUS, SPACE } from "../../src/theme/tokens";

export default function AccountTab() {
  const { c, mode, setMode } = useTheme();
  const { t, pref, setPref } = useI18n();
  const { refresh, signedIn } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const pull = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingBottom: BOTTOM_INSET }}
        showsVerticalScrollIndicator={false}
        refreshControl={signedIn ? <RefreshControl refreshing={refreshing} onRefresh={pull} tintColor={c.ink3} /> : undefined}
      >
        <ScreenTitle title={t("account.title")} />

        <AccountCard />

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

/** Who is signed in and what they are on — or, signed out, the way in. */
function AccountCard() {
  const { t } = useI18n();
  const router = useRouter();
  const { ready, signedIn, email, account, entitled, checking, known, signOut } = useAuth();
  const [leaving, setLeaving] = useState(false);
  /* The database's plans, so one created in /admin shows its name here. */
  const plans = usePlans();

  /* Nothing until the stored session has been read: showing "Log in" for
     half a second to someone who is logged in is worse than a gap. */
  if (!ready) return null;

  if (!signedIn) {
    return (
      <Card>
        <Txt variant="section">{t("account.signedOut.title")}</Txt>
        <Txt variant="body" tone="ink2">{t("account.signedOut.body")}</Txt>
        <View style={{ gap: 10, marginTop: 8 }}>
          <Button label={t("account.logIn")} onPress={() => router.push("/auth/login")} />
          <Button variant="secondary" label={t("account.create")} onPress={() => router.push("/auth/signup")} />
        </View>
      </Card>
    );
  }

  const staff = account?.profile.role === "staff_admin" || account?.profile.role === "staff_support";
  const subscription = account?.subscription ?? null;
  const planName = subscription ? plans.find((p) => p.id === subscription.plan_id)?.name ?? subscription.plan_id : null;
  /* An enum value this build has no label for falls back to the raw
     word rather than throwing — the website's statusLabel does the same. */
  const statusKey = `account.status.${subscription?.status ?? ""}`;
  const status = subscription ? (statusKey in STRINGS ? t(statusKey as StringKey) : subscription.status) : null;

  const leave = async () => {
    setLeaving(true);
    await signOut();
    setLeaving(false);
  };

  return (
    <Card>
      <Txt variant="label" tone="ink3">{account?.customer?.name ?? (staff ? t("account.staff") : t("account.title"))}</Txt>
      <Txt variant="section" numberOfLines={1}>{account?.profile.full_name || email}</Txt>
      {account?.profile.full_name ? <Txt variant="body" tone="ink2" numberOfLines={1}>{email}</Txt> : null}

      {/* No account to show. Warn only when the server has answered and
          the answer is "no profile" (`known`); a read that failed is said
          as that, not as a fact about the account. While checking, or
          offline on a valid cached entitlement, show just who is signed
          in. */}
      {account === null ? (
        !checking && !entitled ? (
          known ? (
            <Txt variant="body" tone="warn" style={{ marginTop: 6 }}>{t("account.noAccess")}</Txt>
          ) : (
            <Txt variant="body" tone="ink2" style={{ marginTop: 6 }}>{t("account.unknown")}</Txt>
          )
        ) : null
      ) : staff ? null : (
        <View style={{ marginTop: 10, gap: 2 }}>
          <Txt variant="label" tone="ink3">{t("account.plan")}</Txt>
          <Txt variant="bodyStrong">{planName ?? t("account.noSubscription")}</Txt>
          {status ? <Txt variant="body" tone={subscription?.status === "cancelled" ? "warn" : "ink2"}>{status}</Txt> : null}
        </View>
      )}

      <View style={{ gap: 10, marginTop: 12 }}>
        {!staff && account !== null ? (
          <Button
            variant="secondary"
            label={t("account.manage")}
            onPress={() => Linking.openURL(`${API_URL}/my-odatone`).catch(() => {})}
          />
        ) : null}
        <Button variant="secondary" label={t("account.logOut")} onPress={leave} busy={leaving} />
      </View>
    </Card>
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
