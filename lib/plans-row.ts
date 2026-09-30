import { toKroner } from "./money.ts";
import type { Plan } from "./pricing.ts";

/** One row of the `plans` table, as selected by lib/plans-server.ts. */
export type PlanRow = {
  id: string;
  name: string;
  monthly_ore: number;
  max_m2: number | null;
  tagline: Plan["tagline"];
  features: Plan["features"];
};

/** Converts a `plans` table row into the `Plan` shape the rest of the app
    already reads. Kept in its own module, separate from lib/plans-server.ts
    (which imports next/cache and react's cache — neither resolves under
    plain `node --test`), so the conversion itself — the one place an
    øre/kroner slip or a dropped `null` would produce a 100x price error or
    break the unbounded plan — can be unit tested directly. */
export function rowToPlan(row: PlanRow): Plan {
  return {
    id: row.id,
    name: row.name,
    monthly: toKroner(row.monthly_ore),
    maxM2: row.max_m2,
    tagline: row.tagline,
    features: row.features,
  };
}
