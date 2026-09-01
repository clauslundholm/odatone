"use client";

import { usePlayer } from "./PlayerProvider";
import { player } from "@/lib/content/player";
import { TRIAL_DAYS, resetTrial } from "@/lib/audio/trial";
import { LinkButton, Button } from "@/components/ui/Button";
import { href } from "@/lib/i18n";
import { ui } from "@/lib/content/common";
import { LockIcon } from "./Icons";
import { num } from "@/lib/format";

export default function TrialGate() {
  const p = usePlayer();
  const l = p.locale;
  if (!p.trial.expired) return null;

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center rounded-[var(--radius-xl)] bg-bg/88 p-8 backdrop-blur-xl">
      <div className="flex max-w-md flex-col items-center gap-5 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-surface-2 text-accent">
          <LockIcon size={18} />
        </span>
        <h3 className="u-display text-[clamp(1.6rem,4vw,2.4rem)]">{player.expiredTitle[l]}</h3>
        <p className="u-lede">{player.expiredBody[l].replace("{days}", num(TRIAL_DAYS, l))}</p>
        <div className="mt-1 flex flex-wrap items-center justify-center gap-3">
          <LinkButton href={href(l, "signup")} variant="primary" size="lg">
            {ui.startTrial[l]}
          </LinkButton>
          <Button
            variant="quiet"
            size="lg"
            onClick={() => {
              resetTrial();
              p.refreshTrial();
            }}
          >
            {player.trialReset[l]}
          </Button>
        </div>
      </div>
    </div>
  );
}
