import { useRouter } from "expo-router";
import { useState } from "react";

import { useAuth } from "../../src/auth/AuthProvider";
import { normalizeEmail, type AuthErrorCode } from "../../src/auth/errors.ts";
import { AuthScreen, Notice } from "../../src/components/AuthScreen";
import { Button } from "../../src/components/Button";
import { Field } from "../../src/components/Field";
import { useI18n } from "../../src/i18n/i18n";

export default function ForgotScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { requestReset } = useAuth();

  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AuthErrorCode | "email" | null>(null);

  const submit = async () => {
    if (busy) return;
    const address = normalizeEmail(email);
    if (!/^\S+@\S+\.\S+$/.test(address)) {
      setError("email");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await requestReset(address);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    /* On to the code screen whether or not the address has an account —
       saying "no such account" here would let anyone test addresses. */
    router.replace({ pathname: "/auth/verify", params: { email: address, kind: "recovery" } });
  };

  return (
    <AuthScreen title={t("auth.forgot.title")} body={t("auth.forgot.body")}>
      {error && error !== "email" ? <Notice text={t(`auth.error.${error}`)} /> : null}
      <Field
        label={t("auth.email")}
        value={email}
        onChangeText={setEmail}
        error={error === "email" ? t("auth.error.email") : undefined}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="username"
        returnKeyType="send"
        onSubmitEditing={submit}
      />
      <Button label={t("auth.forgot.submit")} onPress={submit} busy={busy} />
      <Button variant="link" label={t("auth.forgot.back")} onPress={() => router.replace("/auth/login")} />
    </AuthScreen>
  );
}
