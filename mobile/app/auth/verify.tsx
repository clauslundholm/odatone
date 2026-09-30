import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";

import { useAuth } from "../../src/auth/AuthProvider";
import type { AuthErrorCode, CodeKind } from "../../src/auth/errors.ts";
import { AuthScreen, Notice, closeAuth } from "../../src/components/AuthScreen";
import { Button } from "../../src/components/Button";
import { Field } from "../../src/components/Field";
import { useI18n } from "../../src/i18n/i18n";

/** Where a new customer (after signup) and a customer resetting a
    password both end up: type the 6-digit code from the email, choose a
    password. */
export default function VerifyScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { verifyCode, resendCode, requestReset } = useAuth();
  const params = useLocalSearchParams<{ email?: string; kind?: string }>();

  const email = String(params.email ?? "");
  const recovery = params.kind === "recovery";
  /* Starts as the email that was actually sent. A resend from the signup
     path goes out as the sign-in-code email instead, whose code verifies
     under a different type — so the kind follows the last email sent. */
  const [kind, setKind] = useState<CodeKind>(recovery ? "recovery" : "invite");

  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState<AuthErrorCode | null>(null);

  if (!email) return <Redirect href="/auth/login" />;

  const submit = async () => {
    if (busy) return;
    if (code.trim().length !== 6) {
      setError("code");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await verifyCode(email, code, password, kind);
    setBusy(false);
    if (result.ok) closeAuth(router);
    else setError(result.error);
  };

  const resend = async () => {
    if (sending) return;
    setSending(true);
    setError(null);
    setResent(false);
    const result = recovery ? await requestReset(email) : await resendCode(email);
    setSending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (!recovery) setKind("email");
    setCode("");
    setResent(true);
  };

  return (
    <AuthScreen
      title={t(recovery ? "auth.verify.titleRecovery" : "auth.verify.titleInvite")}
      body={t("auth.verify.body").replace("{email}", email)}
    >
      {error ? <Notice text={t(`auth.error.${error}`)} /> : null}
      {resent && !error ? <Notice tone="ink2" text={t("auth.verify.resent")} /> : null}
      <Field
        label={t("auth.code")}
        value={code}
        onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={6}
      />
      <Field
        label={t("auth.newPassword")}
        hint={t("auth.passwordHint")}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <Button label={t("auth.verify.submit")} onPress={submit} busy={busy} />
      <Button variant="link" label={t("auth.verify.resend")} onPress={resend} busy={sending} />
    </AuthScreen>
  );
}
