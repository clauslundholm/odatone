import { Redis } from "@upstash/redis";

/* Relative, with the extension, because this is a value import and the test
   runner resolves it directly — Node does not read tsconfig's "@/" alias.
   Type-only imports are erased before Node ever sees them, so those can stay
   on the alias. */
import { resolveKey, type Overrides } from "./copy-apply.ts";
import type { Locale } from "@/lib/i18n";

const HASH = "copy:overrides";
const HISTORY = "copy:history";
const HISTORY_MAX = 200;

export type HistoryEntry = { ts: number; locale: string; from: string; to: string };

/* Two spellings, because the credentials arrive under different names
   depending on how the database was created: UPSTASH_REDIS_REST_* is what
   Upstash's own SDK and dashboard use, and KV_REST_API_* is what the Vercel
   Marketplace integration injects. Whichever is present wins. */
function credentials(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

/** Whether a store is reachable at all. False is a normal state — locally, and
    on any deploy made before the integration was added — and means every read
    falls back to the defaults in lib/content. */
export function isConfigured(): boolean {
  return credentials() !== null;
}

/* Absent credentials are a normal state, so this returns null instead of
   throwing and lets each caller decide what that means. */
function client(): Redis | null {
  const creds = credentials();
  return creds ? new Redis(creds) : null;
}

/** Every override for one locale, keyed by the text as it appears in
    lib/content. A store that is missing or unreachable yields none, which
    renders the site exactly as its source files describe it. */
export async function getOverrides(locale: Locale): Promise<Overrides> {
  const redis = client();
  if (!redis) return {};
  try {
    const all = await redis.hgetall<Record<string, string>>(HASH);
    if (!all) return {};
    const prefix = `${locale}:`;
    const out: Overrides = {};
    for (const [key, value] of Object.entries(all)) {
      if (key.startsWith(prefix)) out[key.slice(prefix.length)] = value;
    }
    return out;
  } catch {
    return {};
  }
}

/** Records one edit and returns what the text was before, so the caller can
    report it and the history list can be replayed backwards.

    `from` is whatever the browser had on screen, which after an earlier edit
    is that edit's text rather than the source string, so it is resolved to the
    key lib/content actually uses before anything is written. */
export async function setOverride(
  locale: Locale,
  from: string,
  to: string,
): Promise<{ previous: string | null; key: string }> {
  const redis = client();
  if (!redis) throw new Error("Override store is not configured");

  const overrides = await getOverrides(locale);
  const key = resolveKey(from, overrides);
  const field = `${locale}:${key}`;
  const previous = overrides[key] ?? null;

  if (to === key) {
    /* Edited back to what lib/content says, so the override has nothing left
       to say. Dropping it beats storing a mapping onto itself. */
    await redis.hdel(HASH, field);
  } else {
    await redis.hset(HASH, { [field]: to });
  }

  await redis.lpush(HISTORY, JSON.stringify({ ts: Date.now(), locale, from: key, to }));
  await redis.ltrim(HISTORY, 0, HISTORY_MAX - 1);
  return { previous, key };
}

/** Most recent edits first. */
export async function listHistory(limit = 50): Promise<HistoryEntry[]> {
  const redis = client();
  if (!redis) return [];
  try {
    const raw = await redis.lrange<string>(HISTORY, 0, limit - 1);
    return raw.map((entry) => (typeof entry === "string" ? JSON.parse(entry) : entry));
  } catch {
    return [];
  }
}
