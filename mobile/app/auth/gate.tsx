import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Linking, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../../src/auth/AuthProvider";
import { API_URL } from "../../src/auth/supabase";
import { closeAuth } from "../../src/components/AuthScreen";
import { Button } from "../../src/components/Button";
import { Txt } from "../../src/components/Txt";
import { useI18n } from "../../src/i18n/i18n";
import { useTheme } from "../../src/theme/theme";
import { SPACE } from "../../src/theme/tokens";

/** What pressing play shows someone who may not play: a way in for a
    visitor, or the state of things for a customer whose subscription is
    not live. A route rather than a view over the app, so it also shows
    above the Now Playing modal. */
export default function GateScreen() {
  const { c } = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { refresh } = useAuth();
  const { kind } = useLocalSearchParams<{ kind?: string }>();
  const [checking, setChecking] = useState(false);

  const ended = kind === "ended";

  /* "Not active" is also what a customer sees when their phone was
     offline for longer than the offline allowance. Asking again is the
     fix for that, so it is a button and not advice. */
  const retry = async () => {
    setChecking(true);
    await refresh();
    setChecking(false);
    closeAuth(router);
  };

  return (
    /* No flex: 1 — a form sheet sizes to its detent, and a flexed child
       inside one collapses on Android. */
    <View
      style={{
        backgroundColor: c.bg,
        paddingTop: SPACE.xl,
        paddingHorizontal: SPACE.lg,
        paddingBottom: insets.bottom + SPACE.lg,
        gap: SPACE.md,
      }}
    >
      <Txt variant="title">{t(ended ? "gate.ended.title" : "gate.login.title")}</Txt>
      <Txt variant="body" tone="ink2">{t(ended ? "gate.ended.body" : "gate.login.body")}</Txt>

      {ended ? (
        <View style={{ gap: 10 }}>
          <Button label={t("gate.ended.retry")} onPress={retry} busy={checking} />
          <Button
            variant="secondary"
            label={t("account.manage")}
            onPress={() => Linking.openURL(`${API_URL}/my-odatone`).catch(() => {})}
          />
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          <Button label={t("account.logIn")} onPress={() => router.replace("/auth/login")} />
          <Button variant="secondary" label={t("account.create")} onPress={() => router.replace("/auth/signup")} />
        </View>
      )}
    </View>
  );
}
