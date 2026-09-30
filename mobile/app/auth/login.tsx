import { useRouter } from "expo-router";
import { useState } from "react";

import { useAuth } from "../../src/auth/AuthProvider";
import type { AuthErrorCode } from "../../src/auth/errors.ts";
import { AuthScreen, Notice, closeAuth } from "../../src/components/AuthScreen";
import { Button } from "../../src/components/Button";
import { Field } from "../../src/components/Field";
import { useI18n } from "../../src/i18n/i18n";

export default function LoginScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AuthErrorCode | null>(null);

  const submit = async () => {
    if (busy) return;
    /* An empty form is the same answer as a wrong one, without the
       round trip. */
    if (!email.trim() || !password) {
      setError("invalid");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await signIn(email, password);
    setBusy(false);
    if (result.ok) closeAuth(router);
    else setError(result.error);
  };

  return (
    <AuthScreen title={t("auth.login.title")} body={t("auth.login.body")}>
      {error ? <Notice text={t(`auth.error.${error}`)} /> : null}
      <Field
        label={t("auth.email")}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="username"
        returnKeyType="next"
      />
      <Field
        label={t("auth.password")}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <Button label={t("auth.login.submit")} onPress={submit} busy={busy} />
      <Button variant="link" label={t("auth.login.forgot")} onPress={() => router.replace("/auth/forgot")} />
      <Button variant="secondary" label={t("account.create")} onPress={() => router.replace("/auth/signup")} />
    </AuthScreen>
  );
}
