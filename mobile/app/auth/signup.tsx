import Ionicons from "@expo/vector-icons/Ionicons";
import { ANNUAL_DISCOUNT_PCT, quote, type Plan } from "@web/pricing";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Linking, Pressable, View } from "react-native";

import { postSignup } from "../../src/auth/api";
import { normalizeEmail } from "../../src/auth/errors.ts";
import {
  EMPTY_DRAFT,
  MAX_LOCATIONS,
  MIN_LOCATIONS,
  errorKey,
  stepForErrors,
  toPayload,
  validateAccount,
  validatePlan,
  visibleErrors,
  type FieldErrors,
  type SignupDraft,
} from "../../src/auth/signup-form.ts";
import { API_URL } from "../../src/auth/supabase";
import { AuthScreen, Notice, closeAuth } from "../../src/components/AuthScreen";
import { Button } from "../../src/components/Button";
import { Chip } from "../../src/components/Chip";
import { Field } from "../../src/components/Field";
import { Txt } from "../../src/components/Txt";
import { usePlans } from "../../src/data/plans";
import { useI18n } from "../../src/i18n/i18n";
import { kr } from "../../src/lib/format";
import { useTheme } from "../../src/theme/theme";
import { RADIUS, SPACE } from "../../src/theme/tokens";

const STEPS = ["signup.step.plan", "signup.step.account"] as const;

/** The website's order, in two steps: plan, then account. There is no
    payment step: the app collects no payment details (App Store and card
    rules), and the trial is free. The order itself is placed by the
    website (POST /api/app/signup), which runs the same code as its own
    form. */
export default function SignupScreen() {
  const { c } = useTheme();
  const { t, l, locale } = useI18n();
  const router = useRouter();
  const plans = usePlans();

  const [draft, setDraft] = useState<SignupDraft>(EMPTY_DRAFT);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [unreachable, setUnreachable] = useState(false);
  const [noInvite, setNoInvite] = useState(false);

  const set = <K extends keyof SignupDraft>(key: K, value: SignupDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const message = (field: string) =>
    errors[field] ? t(`signup.error.${errorKey(field, errors[field])}`) : undefined;

  /* The database can stop selling a plan the draft started on; fall back
     to the first one on offer rather than pricing a plan that is gone. */
  const selected: Plan = plans.find((p) => p.id === draft.planId) ?? plans[0];
  const q = quote(selected, draft.billing, draft.locations);

  const next = () => {
    const found = validatePlan({ ...draft, planId: selected.id });
    setErrors(found);
    if (Object.keys(found).length === 0) setStep(1);
  };

  const submit = async () => {
    if (busy) return;
    const found = validateAccount(draft);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    setUnreachable(false);
    const result = await postSignup(toPayload({ ...draft, planId: selected.id }));
    setBusy(false);

    if (result.kind === "unreachable") {
      setUnreachable(true);
      return;
    }
    if (result.kind === "errors") {
      const shown = visibleErrors(result.errors);
      setErrors(shown);
      setStep(stepForErrors(shown));
      return;
    }
    if (!result.invited) {
      setNoInvite(true);
      return;
    }
    router.replace({ pathname: "/auth/verify", params: { email: normalizeEmail(draft.email), kind: "invite" } });
  };

  if (noInvite) {
    return (
      <AuthScreen
        title={t("signup.noInvite.title")}
        body={t("signup.noInvite.body").replace("{email}", normalizeEmail(draft.email))}
      >
        <Button label={t("auth.close")} onPress={() => closeAuth(router)} />
      </AuthScreen>
    );
  }

  return (
    <AuthScreen title={t("signup.title")}>
      <Txt variant="label" tone="ink3">
        {step + 1} / {STEPS.length} · {t(STEPS[step])}
      </Txt>

      {step === 0 && (
        <>
          <Txt variant="section">{t("signup.plan.heading")}</Txt>
          <Txt variant="body" tone="ink2">{t("signup.plan.body")}</Txt>

          {plans.map((p) => {
            const active = p.id === selected.id;
            return (
              <Pressable
                key={p.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                onPress={() => set("planId", p.id)}
                style={{
                  padding: SPACE.md,
                  borderRadius: RADIUS.lg,
                  borderWidth: active ? 2 : 1,
                  borderColor: active ? c.accent : c.line,
                  backgroundColor: c.surface,
                  gap: 4,
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
                  <Txt variant="bodyStrong">{p.name}</Txt>
                  <Txt variant="num">{kr(p.monthly, locale)}</Txt>
                </View>
                <Txt variant="small" tone="ink2">{l(p.tagline)}</Txt>
              </Pressable>
            );
          })}
          {message("plan") ? <Txt variant="label" tone="warn">{message("plan")}</Txt> : null}

          <View style={{ flexDirection: "row", gap: 8 }}>
            <Chip
              label={t("signup.billing.monthly")}
              active={draft.billing === "monthly"}
              onPress={() => set("billing", "monthly")}
            />
            <Chip
              label={`${t("signup.billing.annual")} −${ANNUAL_DISCOUNT_PCT}%`}
              active={draft.billing === "annual"}
              onPress={() => set("billing", "annual")}
            />
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Txt variant="bodyStrong">{t("signup.locations")}</Txt>
            <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.md }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("signup.locations.fewer")}
                hitSlop={10}
                disabled={draft.locations <= MIN_LOCATIONS}
                onPress={() => set("locations", Math.max(MIN_LOCATIONS, draft.locations - 1))}
              >
                <Ionicons
                  name="remove-circle-outline"
                  size={30}
                  color={draft.locations <= MIN_LOCATIONS ? c.ink3 : c.ink}
                />
              </Pressable>
              <Txt variant="title" style={{ minWidth: 36, textAlign: "center" }}>{draft.locations}</Txt>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("signup.locations.more")}
                hitSlop={10}
                disabled={draft.locations >= MAX_LOCATIONS}
                onPress={() => set("locations", Math.min(MAX_LOCATIONS, draft.locations + 1))}
              >
                <Ionicons
                  name="add-circle-outline"
                  size={30}
                  color={draft.locations >= MAX_LOCATIONS ? c.ink3 : c.ink}
                />
              </Pressable>
            </View>
          </View>
          {message("locations") ? <Txt variant="label" tone="warn">{message("locations")}</Txt> : null}

          <View
            style={{
              padding: SPACE.md,
              borderRadius: RADIUS.lg,
              backgroundColor: c.surface2,
              gap: 8,
            }}
          >
            <Row label={t("signup.perLocation")} value={`${kr(q.perLocation, locale)} ${t("signup.perMonth")}`} />
            {q.volumeDiscountPct > 0 ? (
              <Row label={t("signup.volumeDiscount")} value={`−${q.volumeDiscountPct}%`} />
            ) : null}
            {q.annualDiscountPct > 0 ? (
              <Row label={t("signup.annualDiscount")} value={`−${q.annualDiscountPct}%`} />
            ) : null}
            <Row label={t("signup.dueToday")} value={t("signup.freeTrial")} strong />
            <Row
              label={t("signup.then")}
              value={`${kr(q.chargeExVat, locale)} ${t(draft.billing === "annual" ? "signup.perYear" : "signup.perMonth")}`}
            />
            <Txt variant="label" tone="ink3" style={{ textAlign: "right" }}>{t("signup.exVat")}</Txt>
          </View>
        </>
      )}

      {step === 1 && (
        <>
          <Txt variant="section">{t("signup.account.heading")}</Txt>
          <Txt variant="body" tone="ink2">{t("signup.account.body")}</Txt>

          {errors.email === "exists" ? (
            <View style={{ gap: 10 }}>
              <Notice text={t("signup.error.exists")} />
              {/* The order may already be placed and its code already in
                  the customer's inbox: the request timed out after the
                  server committed, or the app was closed on the code
                  screen. This is the way back to that screen. */}
              <Button
                variant="secondary"
                label={t("signup.exists.code")}
                onPress={() =>
                  router.replace({ pathname: "/auth/verify", params: { email: normalizeEmail(draft.email), kind: "invite" } })
                }
              />
              <Button variant="secondary" label={t("account.logIn")} onPress={() => router.replace("/auth/login")} />
              <Button variant="link" label={t("signup.exists.reset")} onPress={() => router.replace("/auth/forgot")} />
            </View>
          ) : null}

          <Field
            label={t("signup.field.name")}
            value={draft.name}
            onChangeText={(v) => set("name", v)}
            error={message("name")}
            autoComplete="name"
            textContentType="name"
            autoCapitalize="words"
          />
          <Field
            label={t("signup.field.company")}
            value={draft.company}
            onChangeText={(v) => set("company", v)}
            error={message("company")}
            autoComplete="organization"
            textContentType="organizationName"
          />
          <Field
            label={t("signup.field.cvr")}
            value={draft.cvr}
            onChangeText={(v) => set("cvr", v)}
            error={message("cvr")}
            keyboardType="number-pad"
          />
          <Field
            label={t("signup.field.email")}
            value={draft.email}
            onChangeText={(v) => set("email", v)}
            error={errors.email === "exists" ? undefined : message("email")}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
          />
          <Field
            label={t("signup.field.phone")}
            hint={t("signup.optional")}
            value={draft.phone}
            onChangeText={(v) => set("phone", v)}
            error={message("phone")}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
          />
          <Field
            label={t("signup.field.address")}
            value={draft.address}
            onChangeText={(v) => set("address", v)}
            error={message("address")}
            autoComplete="street-address"
            textContentType="streetAddressLine1"
          />
          <View style={{ flexDirection: "row", gap: SPACE.sm }}>
            <View style={{ flex: 1 }}>
              <Field
                label={t("signup.field.postcode")}
                value={draft.postcode}
                onChangeText={(v) => set("postcode", v)}
                error={message("postcode")}
                keyboardType="number-pad"
                autoComplete="postal-code"
                textContentType="postalCode"
              />
            </View>
            <View style={{ flex: 2 }}>
              <Field
                label={t("signup.field.city")}
                value={draft.city}
                onChangeText={(v) => set("city", v)}
                error={message("city")}
                textContentType="addressCity"
              />
            </View>
          </View>

          <Txt variant="bodyStrong">{t("signup.payment.subheading")}</Txt>
          <Txt variant="body" tone="ink2">{t("signup.payment.body")}</Txt>

          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: draft.terms }}
            onPress={() => set("terms", !draft.terms)}
            style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}
          >
            <Ionicons
              name={draft.terms ? "checkbox" : "square-outline"}
              size={24}
              color={draft.terms ? c.accent : c.ink3}
            />
            <Txt variant="body" tone="ink2" style={{ flex: 1 }}>{t("signup.terms")}</Txt>
          </Pressable>
          {message("terms") ? <Txt variant="label" tone="warn">{message("terms")}</Txt> : null}
          <Button
            variant="link"
            label={t("signup.termsRead")}
            onPress={() =>
              Linking.openURL(`${API_URL}/${locale}/${locale === "da" ? "betingelser" : "terms"}`).catch(() => {})
            }
          />

          {unreachable ? <Notice text={t("signup.unreachable")} /> : null}
          {errors.form ? <Notice text={t(`signup.error.${errorKey("form", errors.form)}`)} /> : null}
        </>
      )}

      <View style={{ gap: 10, marginTop: SPACE.sm }}>
        {step < STEPS.length - 1 ? (
          <Button label={t("signup.next")} onPress={next} />
        ) : (
          <Button label={t("signup.submit")} onPress={submit} busy={busy} />
        )}
        {step > 0 ? (
          <Button variant="secondary" label={t("signup.back")} onPress={() => setStep(step - 1)} disabled={busy} />
        ) : (
          <Button variant="link" label={t("signup.haveAccount")} onPress={() => router.replace("/auth/login")} />
        )}
      </View>
    </AuthScreen>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: SPACE.md }}>
      <Txt variant="body" tone="ink2">{label}</Txt>
      <Txt variant={strong ? "bodyStrong" : "body"} style={{ flexShrink: 1, textAlign: "right" }}>{value}</Txt>
    </View>
  );
}
