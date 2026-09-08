import { promises as fs } from "node:fs";
import path from "node:path";

/* Dev-only sink for text edited straight in the browser.

   The body of every page is contentEditable; EditCapture posts what changed
   and this route writes it back into lib/content/*.ts, so a reload shows the
   new wording because it is now the source. Edits are permanent — git diff is
   the review step and git checkout the undo.

   Anything that cannot be placed unambiguously is parked in
   content-edits.json instead of guessed at, so no edit is lost quietly. */

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

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return new Response("Not found", { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { path: page, edits } = (body ?? {}) as {
    path?: unknown;
    edits?: unknown;
  };

  if (typeof page !== "string" || !page) {
    return Response.json({ error: "Missing path" }, { status: 400 });
  }
  if (!edits || typeof edits !== "object" || Array.isArray(edits)) {
    return Response.json({ error: "Missing edits" }, { status: 400 });
  }

  const clean: Record<string, string> = {};
  for (const [before, after] of Object.entries(edits as object)) {
    if (typeof before === "string" && typeof after === "string" && before) {
      clean[before] = after;
    }
  }
  if (!Object.keys(clean).length) {
    return Response.json({ error: "Missing edits" }, { status: 400 });
  }

  const write = queue.then(() => apply(page, clean));
  queue = write.catch(() => {});
  const result = await write;

  return Response.json({ ok: true, ...result });
}
