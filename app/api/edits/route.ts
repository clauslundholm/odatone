import { promises as fs } from "node:fs";
import path from "node:path";

/* Dev-only sink for text edited straight in the browser.
   The body of every page is contentEditable; EditCapture posts what
   changed and this route parks it in a stub file at the repo root so the
   wording can be moved back into lib/content/ by hand later. Nothing here
   exists in a deployed build — the filesystem is read-only there anyway. */

const STUB = path.join(process.cwd(), "content-edits.json");

type Stub = Record<string, Record<string, string>>;

/* Autosaves arrive faster than a read-modify-write round trip, so every
   write queues behind the last one instead of racing it. */
let queue: Promise<void> = Promise.resolve();

async function readStub(): Promise<Stub> {
  try {
    return JSON.parse(await fs.readFile(STUB, "utf8")) as Stub;
  } catch {
    return {};
  }
}

async function merge(page: string, edits: Record<string, string>) {
  const stub = await readStub();
  stub[page] = { ...stub[page], ...edits };
  await fs.writeFile(STUB, `${JSON.stringify(stub, null, 2)}\n`, "utf8");
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

  const write = queue.then(() => merge(page, clean));
  queue = write.catch(() => {});
  await write;

  return Response.json({ ok: true, file: path.basename(STUB) });
}
