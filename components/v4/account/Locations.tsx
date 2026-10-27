import { v4 as t } from "@/lib/content/v4";
import { m2 as formatM2 } from "@/lib/format";
import { href, type Locale } from "@/lib/i18n";
import { venueType, type VenueTypeId } from "@/lib/rates";
import type { Fallback } from "@/lib/schedule";
import { overPlan, type Account } from "@/lib/v4/account";
import { Empty, Fit, Pill, QuietLink, Stat, TablePanel, Td, Th, Tr } from "./Parts";

/**
 * Lokationer: the rooms this account pays for, read-only.
 *
 * Read-only on purpose, and not for want of a form. A location is a
 * priced thing — `quote()` multiplies by how many there are, and m² picks
 * the plan — so "add a location" is a change to the agreement, not a row
 * a customer can insert. The page says so at the foot rather than
 * offering a button that would have to be refused.
 *
 * The second panel is what plays when the week has nothing planned:
 * `locations.fallback`, from 0016_schedule_per_location.sql. It is
 * omitted entirely when that column cannot be read, which is the honest
 * rendering on a database that has not had 0016 applied yet — a panel
 * claiming silence everywhere would be worse than no panel.
 */
export function Locations({
  locale: l,
  account,
  fallbacks,
}: {
  locale: Locale;
  account: Account;
  /** Per location id. Null when the column is not there to read. */
  fallbacks: Record<string, Fallback> | null;
}) {
  const a = t.account;
  const { locations, plan } = account;
  const maxM2 = plan?.maxM2 ?? null;
  const over = overPlan(account);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row">
        <Stat
          label={a.stats.locations[l]}
          value={
            locations.length === 1
              ? a.stats.activeOne[l]
              : a.stats.active[l].replace("{n}", String(locations.length))
          }
          note={locations.length > 0 ? a.stats.ownWeek[l] : undefined}
        />
        <Stat
          label={a.stats.planLimit[l]}
          value={
            maxM2 === null
              ? a.stats.noLimit[l]
              : a.stats.perLocation[l].replace("{m2}", formatM2(maxM2, l))
          }
          note={plan?.name ?? undefined}
        />
      </div>

      {locations.length === 0 ? (
        <Empty title={a.locations.emptyHeading[l]} body={a.locations.emptyBody[l]} />
      ) : (
        <>
          <TablePanel
            title={a.locations.panel[l]}
            action={
              over > 0 ? <Pill tone="warn">{a.locations.over[l]}</Pill> : undefined
            }
          >
            <thead>
              <tr>
                <Th>{a.locations.name[l]}</Th>
                <Th>{a.locations.type[l]}</Th>
                <Th>{a.locations.city[l]}</Th>
                <Th>{a.locations.fit[l]}</Th>
              </tr>
            </thead>
            <tbody>
              {locations.map((loc) => (
                <Tr key={loc.id}>
                  <Td>
                    <span className="block text-ink">{loc.name}</span>
                    {loc.address && (
                      <span className="block text-[0.8125rem] text-ink-3">{loc.address}</span>
                    )}
                  </Td>
                  <Td muted>{loc.venueType ? venueType(loc.venueType as VenueTypeId).label[l] : "—"}</Td>
                  <Td muted>{loc.city ?? "—"}</Td>
                  <Td>
                    {typeof loc.m2 === "number" ? (
                      <span className="flex items-center gap-3">
                        <Fit used={loc.m2} limit={maxM2} noLimit={a.stats.noLimit[l]} />
                        {maxM2 !== null && (
                          <Pill tone={loc.m2 > maxM2 ? "warn" : "neutral"}>
                            {loc.m2 > maxM2 ? a.locations.over[l] : a.locations.within[l]}
                          </Pill>
                        )}
                      </span>
                    ) : (
                      <span className="text-ink-3">—</span>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </TablePanel>

          {fallbacks && (
            <TablePanel
              title={a.locations.offPlan[l]}
              action={
                <QuietLink href={`/${l}/${l === "da" ? "spilleplan" : "schedule"}`}>
                  {a.locations.offPlanLink[l]}
                </QuietLink>
              }
            >
              <thead>
                <tr>
                  <Th>{a.locations.name[l]}</Th>
                  <Th>{a.locations.whenNothing[l]}</Th>
                </tr>
              </thead>
              <tbody>
                {locations.map((loc) => {
                  const fb = fallbacks[loc.id] ?? "silence";
                  return (
                    <Tr key={loc.id}>
                      <Td>
                        <span className="block text-ink">{loc.name}</span>
                        {loc.address && (
                          <span className="block text-[0.8125rem] text-ink-3">{loc.address}</span>
                        )}
                      </Td>
                      <Td>
                        <span className="block text-ink">{t.planner.fallback[fb][l]}</span>
                        <span className="block text-[0.8125rem] text-ink-3">
                          {a.locations.fallbackNote[fb][l]}
                        </span>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </TablePanel>
          )}
        </>
      )}

      <p className="max-w-[80ch] text-[0.8125rem] leading-relaxed text-ink-3">
        {a.locations.note[l]}{" "}
        <a href={href(l, "contact")} className="text-accent underline-offset-2 hover:underline">
          {t.footer.contact[l]}
        </a>
      </p>
    </div>
  );
}
