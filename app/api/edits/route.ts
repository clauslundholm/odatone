import { promises as fs } from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { revalidatePath, revalidateTag } from "next/cache";

import { parseEdits } from "./payload";
import { setOverride } from "@/lib/copy-store";
import { OVERRIDES_TAG } from "@/lib/copy-server";
import { EDIT_COOKIE, verifySession } from "@/lib/edit-session";
import { isLocale, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

/* Sink for text edited straight in the browser, with two destinations.

   In development the edit is written back into lib/content/*.ts, so a reload
   shows the new wording because it is now the source. Edits are permanent —
   git diff is the review step and git checkout the undo. Anything that cannot
   be placed unambiguously is parked in content-edits.json instead of guessed
   at, so no edit is lost quietly.

   Everywhere else the edit becomes an override in the store, which the layout
   and pages read during static generation. That needs a signed session, and
   the affected pages are revalidated so the change is live immediately. */

const isDev = process.env.NODE_ENV === "development";

const CONTENT_DIR = path.join(process.cwd(), "lib", "content");
const STUB = path.join(process.cwd(), "content-edits.json");

type Stub = { unresolved?: Record<string, Record<string, string>> };

/* Autosaves arrive faster than a read-modify-write round trip, so every write
   queues behind the last one instead of racing it. */
let queue: Promise<unknown> = Promise.resolve();

/* The source writes these as TypeScript string literals, so a line break in
   the browser is a two-character \n on disk. Comparing the literal forms is
   what makes the match exact. */
const literal = (s: string) => JSON.stringify(s);

function countOf(haystack: string, needle: string) {
  return haystack.split(needle).length - 1;
}

async function readContentFiles() {
  const names = (await fs.readdir(CONTENT_DIR)).filter((n) => n.endsWith(".ts"));
  const files = new Map<string, string>();
  for (const name of names) {
    const file = path.join(CONTENT_DIR, name);
    files.set(file, await fs.readFile(file, "utf8"));
  }
  return files;
}

async function parkUnresolved(page: string, edits: Record<string, string>) {
  let stub: Stub = {};
  try {
    stub = JSON.parse(await fs.readFile(STUB, "utf8")) as Stub;
  } catch {
    /* first unplaceable edit of the session */
  }
  stub.unresolved = {
    ...stub.unresolved,
    [page]: { ...stub.unresolved?.[page], ...edits },
  };
  await fs.writeFile(STUB, `${JSON.stringify(stub, null, 2)}\n`, "utf8");
}

async function apply(page: string, edits: Record<string, string>) {
  const files = await readContentFiles();
  const applied: { from: string; to: string; file: string }[] = [];
  const unresolved: { from: string; reason: string }[] = [];
  const parked: Record<string, string> = {};
  const touched = new Set<string>();

  for (const [before, after] of Object.entries(edits)) {
    const needle = literal(before);
    let hits = 0;
    let target: string | null = null;
    for (const [file, source] of files) {
      const n = countOf(source, needle);
      hits += n;
      if (n) target = file;
    }

    if (hits !== 1 || !target) {
      const reason = hits ? `${hits} matches in lib/content` : "no match in lib/content";
      unresolved.push({ from: before, reason });
      parked[before] = after;
      continue;
    }

    files.set(target, files.get(target)!.replace(needle, literal(after)));
    touched.add(target);
    applied.push({ from: before, to: after, file: path.basename(target) });
  }

  for (const file of touched) {
    await fs.writeFile(file, files.get(file)!, "utf8");
  }
  if (Object.keys(parked).length) await parkUnresolved(page, parked);

  return { applied, unresolved };
}

/** Development: rewrite the string literal in lib/content/*.ts. */
async function applyToSource(page: string, edits: Record<string, string>) {
  const write = queue.then(() => apply(page, edits));
  queue = write.catch(() => {});
  return write;
}

/** The editor posts the page it was on; the locale is its first segment. */
function localeOf(page: string): Locale {
  const first = page.split("/").filter(Boolean)[0];
  return first && isLocale(first) ? first : DEFAULT_LOCALE;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseEdits(body);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

  if (isDev) {
    const result = await applyToSource(parsed.page, parsed.edits);
    return Response.json({ ok: true, mode: "source", ...result });
  }

  const jar = await cookies();
  if (!verifySession(jar.get(EDIT_COOKIE)?.value, process.env.EDIT_PASSWORD)) {
    return Response.json({ error: "Not authorised" }, { status: 401 });
  }

  const locale = localeOf(parsed.page);
  const applied: { from: string; to: string; previous: string | null }[] = [];
  try {
    for (const [from, to] of Object.entries(parsed.edits)) {
      const { previous } = await setOverride(locale, from, to);
      applied.push({ from, to, previous });
    }
  } catch {
    return Response.json({ error: "Override store unavailable" }, { status: 503 });
  }

  /* The tag drops the cached read, the path rebuilds the pages that used it.
     Both are needed: without the tag the rebuild would just re-read the old
     cached copy and nothing would appear to have changed.

     expire: 0 means no one is served the old wording while the rebuild runs.
     A profile like "max" would answer the editor's own reload with exactly
     the stale text they just replaced, which is the one thing this feature
     must not do. updateTag would say this more directly, but it is only
     available to server actions, not to a route handler. */
  revalidateTag(OVERRIDES_TAG, { expire: 0 });
  revalidatePath("/", "layout");
  return Response.json({ ok: true, mode: "live", applied, unresolved: [] });
}
