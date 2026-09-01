"use client";

import { useEffect, useState } from "react";

import { usePlayer } from "./PlayerProvider";
import Cover from "./Cover";
import ProgressRail from "./ProgressRail";
import Waveform from "./Waveform";
import Spectrum from "./Spectrum";
import Queue from "./Queue";
import FilterRail from "./FilterRail";
import {
  PlayIcon,
  PauseIcon,
  NextIcon,
  PrevIcon,
  ShuffleIcon,
  VolumeIcon,
  LockIcon,
} from "./Icons";
import { player, dock } from "@/lib/content/player";
import { TRIAL_DAYS, resetTrial } from "@/lib/audio/trial";
import { MOODS, TRACKS_ARE_PLACEHOLDER } from "@/lib/tracks";
import { clockTime, num } from "@/lib/format";
import { href } from "@/lib/i18n";
import { LinkButton } from "@/components/ui/Button";

/**
 * The site-wide player. Mounted once in the root layout, above the footer
 * and below everything else, so audio keeps running across navigation.
 * Translucent rather than solid — the page runs underneath it.
 */
export default function PlayerDock() {
  const p = usePlayer();
  const l = p.locale;
  const t = p.current;
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<"queue" | "library">("queue");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const expired = p.trial.expired;
  const started = p.trial.started;

  const idleLabel = dock.idleSub[l].replace("{n}", num(TRIAL_DAYS, l));
  const trialLabel =
    p.trial.daysLeft <= 1
      ? dock.trialShortLast[l]
      : dock.trialShort[l].replace("{n}", num(p.trial.daysLeft, l));

  const iconButton =
    "grid place-items-center rounded-full text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink";

  return (
    <>
      {/* ------------------------- expanded panel ------------------------- */}
      <div
        className={`fixed inset-x-0 bottom-[var(--dock-h)] z-[60] border-t border-line bg-bg/85 backdrop-blur-2xl backdrop-saturate-150 transition-[transform,opacity] duration-500 ease-[cubic-bezier(.32,.72,0,1)] ${
          open
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none translate-y-8 opacity-0"
        }`}
        style={{ height: "min(68vh, 600px)" }}
        aria-hidden={!open}
      >
        <div className="mx-auto flex h-full w-full max-w-[1320px] flex-col px-6 sm:px-8">
          <div className="flex items-center gap-3 py-4">
            <div className="flex gap-0.5 rounded-full bg-surface-2 p-0.5">
              {(["queue", "library"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setPanel(k)}
                  aria-pressed={panel === k}
                  className={`rounded-full px-4 py-1.5 text-[0.8125rem] font-medium transition-colors ${
                    panel === k ? "bg-surface text-ink shadow-sm" : "text-ink-3 hover:text-ink"
                  }`}
                >
                  {k === "queue" ? dock.queueToggle[l] : dock.library[l]}
                </button>
              ))}
            </div>
            <p className="u-label hidden sm:block">{dock.dismissHint[l]}</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="ml-auto rounded-full bg-surface-2 px-4 py-1.5 text-[0.8125rem] font-medium text-ink-2 transition-colors hover:text-ink"
            >
              {dock.collapse[l]}
            </button>
          </div>

          <div className="grid min-h-0 flex-1 gap-8 pb-6 lg:grid-cols-[300px_minmax(0,1fr)]">
            <div className="hidden min-w-0 flex-col gap-5 lg:flex">
              <p className="u-label">{dock.nowPlayingPanel[l]}</p>
              <div className="rounded-[var(--radius-lg)] bg-surface p-4">
                <Spectrum levels={p.levels} height={88} />
              </div>
              <Waveform
                peaks={t?.peaks ?? []}
                progress={p.progress}
                onSeek={p.seek}
                height={40}
                label={l === "da" ? "Spol i nummeret" : "Seek within the track"}
              />
              <div className="flex items-start gap-4">
                <Cover track={t} size={52} />
                <div className="min-w-0">
                  <p className="u-title truncate text-[1.0625rem]">{t ? t.title[l] : "—"}</p>
                  <p className="mt-0.5 truncate text-[0.875rem] text-ink-2">{t?.artist ?? ""}</p>
                  <p className="u-tabular mt-1.5 text-[0.75rem] text-ink-3">
                    {t ? `${t.bpm} ${t.vox ? dock.bpmVox[l] : dock.bpmInst[l]}` : ""}
                  </p>
                </div>
              </div>
              {TRACKS_ARE_PLACEHOLDER && (
                <p className="u-label mt-auto text-[0.6875rem]">{player.placeholderNote[l]}</p>
              )}
            </div>

            <div className="oda-scroll min-h-0 overflow-y-auto pr-1">
              {panel === "queue" ? <Queue /> : <FilterRail compact />}
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------ the bar ------------------------------ */}
      <div className="fixed inset-x-0 bottom-0 z-[70] h-[var(--dock-h)] border-t border-line bg-bg/80 backdrop-blur-2xl backdrop-saturate-150">
        <div className="mx-auto flex h-full w-full max-w-[1320px] items-center gap-4 px-4 sm:px-8">
          {/* left: what's on */}
          <div
            className={`flex min-w-0 flex-1 items-center gap-3 md:flex-none ${
              started && !expired ? "md:w-[280px]" : "md:w-[420px]"
            }`}
          >
            {started && !expired ? (
              <>
                <Cover track={t} size={40} className="hidden sm:block" />
                <button
                  type="button"
                  onClick={() => setOpen((v) => !v)}
                  aria-expanded={open}
                  className="min-w-0 text-left"
                >
                  <span className="block truncate text-[0.875rem] font-medium text-ink">
                    {t ? t.title[l] : "—"}
                  </span>
                  <span className="block truncate text-[0.8125rem] text-ink-3">
                    {t?.artist ?? ""}
                  </span>
                </button>
              </>
            ) : expired ? (
              <>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2 text-warn">
                  <LockIcon size={15} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[0.875rem] font-medium text-ink">
                    {dock.lockedTitle[l]}
                  </p>
                  <p className="truncate text-[0.8125rem] text-ink-3">
                    {player.expiredBody[l].split(".")[0]}.
                  </p>
                </div>
              </>
            ) : (
              <div className="min-w-0">
                <p className="truncate text-[0.875rem] font-medium text-ink">
                  {dock.idleTitle[l]}
                </p>
                <p className="truncate text-[0.8125rem] text-accent">{idleLabel}</p>
              </div>
            )}
          </div>

          {expired ? (
            <div className="ml-auto flex items-center gap-4">
              <LinkButton href={href(l, "signup")} variant="primary" size="sm">
                {dock.lockedCta[l]}
              </LinkButton>
              <button
                type="button"
                onClick={() => {
                  resetTrial();
                  p.refreshTrial();
                }}
                className="hidden text-[0.8125rem] text-ink-3 underline-offset-4 transition-colors hover:text-ink hover:underline sm:block"
              >
                {player.trialReset[l]}
              </button>
            </div>
          ) : (
            <>
              {/* centre: transport */}
              <div className="flex flex-none flex-col items-center gap-1 md:flex-1">
                <div className="flex items-center gap-1 sm:gap-2">
                  <button
                    type="button"
                    onClick={p.toggleShuffle}
                    aria-pressed={p.shuffle}
                    aria-label={player.shuffle[l]}
                    className={`hidden h-8 w-8 sm:grid ${iconButton} ${
                      p.shuffle ? "text-accent hover:text-accent" : ""
                    }`}
                  >
                    <ShuffleIcon size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={p.prev}
                    aria-label={l === "da" ? "Forrige" : "Previous"}
                    className={`hidden h-8 w-8 sm:grid ${iconButton}`}
                  >
                    <PrevIcon size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => p.toggle()}
                    disabled={!t}
                    aria-label={p.playing ? "Pause" : "Play"}
                    className="grid h-9 w-9 place-items-center rounded-full bg-ink text-bg transition-opacity hover:opacity-85 disabled:opacity-30"
                  >
                    {p.playing ? <PauseIcon size={15} /> : <PlayIcon size={15} />}
                  </button>
                  <button
                    type="button"
                    onClick={p.next}
                    aria-label={l === "da" ? "Næste" : "Next"}
                    className={`h-8 w-8 ${iconButton} grid`}
                  >
                    <NextIcon size={16} />
                  </button>
                </div>

                <div className="hidden w-full max-w-[520px] items-center gap-3 md:flex">
                  <span className="u-tabular w-9 shrink-0 text-right text-[0.6875rem] text-ink-3">
                    {clockTime(p.elapsed)}
                  </span>
                  <ProgressRail
                    progress={p.progress}
                    onSeek={p.seek}
                    label={l === "da" ? "Spol i nummeret" : "Seek within the track"}
                    className="flex-1"
                  />
                  <span className="u-tabular w-9 shrink-0 text-[0.6875rem] text-ink-3">
                    {clockTime(p.duration)}
                  </span>
                </div>
              </div>

              {/* right: moods, volume, trial, expand */}
              <div className="flex flex-none shrink-0 items-center justify-end gap-3">
                {!started && (
                  <div className="hidden items-center gap-1.5 xl:flex">
                    {MOODS.slice(0, 3).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          p.setFilters({ mood: m.id });
                          p.play();
                        }}
                        className="rounded-full bg-surface-2 px-3.5 py-1.5 text-[0.8125rem] font-medium text-ink-2 transition-colors hover:text-ink"
                      >
                        {m.label[l]}
                      </button>
                    ))}
                  </div>
                )}

                {started && (
                  <p className="u-label hidden whitespace-nowrap xl:block">{trialLabel}</p>
                )}

                <div className="hidden shrink-0 items-center gap-2 lg:flex">
                  <button
                    type="button"
                    onClick={p.toggleMute}
                    aria-label={player.volume[l]}
                    className={`h-8 w-8 ${iconButton} grid`}
                  >
                    <VolumeIcon muted={p.muted} size={16} />
                  </button>
                  <input
                    type="range"
                    className="oda-range w-24 shrink-0"
                    min={0}
                    max={100}
                    value={Math.round((p.muted ? 0 : p.volume) * 100)}
                    aria-label={player.volume[l]}
                    style={{
                      ["--fill" as string]: `${Math.round((p.muted ? 0 : p.volume) * 100)}%`,
                    }}
                    onChange={(e) => p.setVolume(Number(e.target.value) / 100)}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setOpen((v) => !v)}
                  aria-expanded={open}
                  aria-label={open ? dock.collapse[l] : dock.expand[l]}
                  title={open ? dock.collapse[l] : dock.expand[l]}
                  className={`h-8 w-8 ${iconButton} grid ${open ? "bg-surface-2 text-ink" : ""}`}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                    className={`transition-transform duration-300 ${open ? "rotate-180" : ""}`}
                  >
                    <path
                      d="m3 10 5-5 5 5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </>
          )}
        </div>

        {/* hairline progress for the compact layouts */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px md:hidden">
          <div
            className="h-px bg-accent transition-[width] duration-300"
            style={{ width: `${Math.min(100, p.progress * 100)}%` }}
          />
        </div>
      </div>

      {p.blocked && (
        <p
          role="status"
          className="fixed inset-x-0 bottom-[calc(var(--dock-h)+10px)] z-[71] mx-auto w-fit rounded-full bg-surface px-4 py-2 text-[0.8125rem] text-warn shadow-lg"
        >
          {player.blocked[l]}
        </p>
      )}
    </>
  );
}

/** Anything that would otherwise sit under the dock. */
export function DockSpacer() {
  return <div aria-hidden="true" style={{ height: "var(--dock-h)" }} />;
}
