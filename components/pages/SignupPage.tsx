import { Suspense } from "react";

import { Container, Section } from "@/components/ui/Section";
import PageHero from "@/components/ui/PageHero";
import SignupFlow from "@/components/signup/SignupFlow";
import { signup as signupDefaults } from "@/lib/content/signup";
import { serverCopy } from "@/lib/copy-server";
import { activePlans } from "@/lib/plans-server";
import { PROOF } from "@/lib/site";
import type { Locale } from "@/lib/i18n";
import { num } from "@/lib/format";

export default async function SignupPage({ locale: l }: { locale: Locale }) {
  const signup = await serverCopy(signupDefaults, l);
  const plans = await activePlans();
  return (
    <>
      <PageHero
        label={signup.eyebrow[l]}
        title={signup.title[l]}
        lede={
          l === "da"
            ? `${num(PROOF.trialDays, l)} dage gratis. Intet betalingskort. Du kan skifte plan eller stoppe når som helst.`
            : `${num(PROOF.trialDays, l)} days free. No card. Change plan or stop whenever you like.`
        }
      />

      <Section tight className="pt-0">
        <Container wide>
          <Suspense fallback={<div className="u-card h-[520px]" />}>
            <SignupFlow locale={l} plans={plans} />
          </Suspense>
        </Container>
      </Section>
    </>
  );
}
