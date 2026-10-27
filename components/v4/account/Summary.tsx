import { CUSTOMER_STATUS_LABEL, localizeStatus } from "@/lib/content/portal";
import { v4 as t } from "@/lib/content/v4";
import { m2 as formatM2 } from "@/lib/format";
import { href, type Locale } from "@/lib/i18n";
import { venueType, type VenueTypeId } from "@/lib/rates";
import {
  accountHref,
  chargeIncVat,
  longDate,
  overPlan,
  priceExVat,
  shortDate,
  type Account,
} from "@/lib/v4/account";
import {
  Empty,
  Field,
  Fit,
  Panel,
  PanelLink,
  Pill,
  QuietLink,
  Stat,
  TablePanel,
  Td,
  Th,
  Tr,
  tone,
} from "./Parts";

/**
 * Oversigt: the three figures a customer checks without reading, then
 * who they are and what they pay, then their rooms.
 *
 * Every number here is read from the same rows /admin bills from — the
 * price is `quote()` against the stored plan and this customer's real
 * location count, not a figure typed into the design.
 */
export function Summary({ locale: l, account }: { locale: Locale; account: Account }) {
  const a = t.account;
  const { customer, plan, subscription, locations } = account;
  const maxM2 = plan?.maxM2 ?? null;
  const over = overPlan(account);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row">
        <Stat
          label={a.stats.subscription[l]}
          value={plan?.name ?? a.rail.noPlan[l]}
          note={priceExVat(account, l) ?? undefined}
        />
        <Stat
          label={a.stats.locations[l]}
          value={
            locations.length === 1
              ? a.stats.activeOne[l]
              : a.stats.active[l].replace("{n}", String(locations.length))
          }
          note={
            over > 0 && maxM2 !== null
              ? a.stats.over[l].replace("{n}", String(over)).replace("{m2}", formatM2(maxM2, l))
              : locations.length > 0
                ? a.stats.allWithin[l]
                : undefined
          }
        />
        <Stat
          label={a.stats.nextInvoice[l]}
          value={
            subscription?.currentPeriodEnd ? shortDate(subscription.currentPeriodEnd, l) : a.stats.none[l]
          }
          note={
            chargeIncVat(account, l)
              ? a.stats.incVat[l].replace("{price}", chargeIncVat(account, l) as string)
              : undefined
          }
        />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Panel
          title={a.company.panel[l]}
          action={<PanelLink href={accountHref(l, "settings")}>{a.company.edit[l]}</PanelLink>}
        >
          <dl className="grid gap-5 sm:grid-cols-2">
            <Field label={a.company.name[l]}>{customer.name}</Field>
            <Field label={a.company.cvr[l]}>{customer.cvr ?? "—"}</Field>
            <Field label={a.company.contact[l]}>
              {[account.fullName, account.roleLabel].filter(Boolean).join(" · ") || "—"}
            </Field>
            <Field label={a.company.email[l]}>
              <span className="block truncate">{account.email ?? customer.billingEmail}</span>
            </Field>
            <Field label={a.company.since[l]}>{longDate(customer.createdAt, l)}</Field>
            <Field label={a.company.status[l]}>
              <Pill tone={tone(customer.status)}>
                {localizeStatus(CUSTOMER_STATUS_LABEL, customer.status, l)}
              </Pill>
            </Field>
          </dl>
        </Panel>

        <Panel
          title={a.plan.panel[l]}
          /* No self-service plan change exists — there is no payment
             provider connected at all — so this leads to the one place
             the change can actually be made rather than to a flow that
             is not there. */
          action={<PanelLink href={href(l, "contact")}>{a.plan.change[l]}</PanelLink>}
        >
          {plan && subscription ? (
            <div className="flex flex-col gap-5">
              <dl className="grid gap-5 sm:grid-cols-2">
                <Field label={a.plan.plan[l]}>{plan.name}</Field>
                <Field label={a.plan.billing[l]}>
                  {subscription.billing === "annual" ? a.plan.annual[l] : a.plan.monthly[l]}
                </Field>
                <Field label={a.plan.price[l]}>
                  <span className="u-tabular">{priceExVat(account, l)}</span>
                </Field>
                <Field label={a.plan.renews[l]}>{longDate(subscription.currentPeriodEnd, l)}</Field>
              </dl>
              {plan.features.length > 0 && (
                <div className="flex flex-col gap-1.5 border-t border-line pt-5">
                  <p className="text-[0.6875rem] font-medium uppercase tracking-[0.06em] text-ink-3">
                    {a.plan.includes[l]}
                  </p>
                  <ul className="flex flex-col gap-1 text-[0.9375rem] text-ink">
                    {plan.features.map((feature) => (
                      <li key={feature[l]}>{feature[l]}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="text-[0.9375rem] leading-relaxed text-ink-2">{a.plan.none[l]}</p>
          )}
        </Panel>
      </div>

      {locations.length === 0 ? (
        <Empty title={a.locations.emptyHeading[l]} body={a.locations.emptyBody[l]} />
      ) : (
        <TablePanel
          title={a.stats.locations[l]}
          action={<QuietLink href={accountHref(l, "locations")}>{a.locations.seeAll[l]}</QuietLink>}
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
                <Td>{loc.name}</Td>
                <Td muted>{loc.venueType ? venueType(loc.venueType as VenueTypeId).label[l] : "—"}</Td>
                <Td muted>{loc.city ?? "—"}</Td>
                <Td>
                  {typeof loc.m2 === "number" ? (
                    <span className="flex items-center gap-3">
                      <Fit used={loc.m2} limit={maxM2} noLimit={a.stats.noLimit[l]} />
                      {maxM2 !== null && loc.m2 > maxM2 && (
                        <Pill tone="warn">{a.locations.over[l]}</Pill>
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
      )}
    </div>
  );
}
