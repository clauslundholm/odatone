export type ParsedEdits =
  | { ok: true; page: string; edits: Record<string, string> }
  | { ok: false; error: string };

export function parseEdits(body: unknown): ParsedEdits {
  const { path: page, edits } = (body ?? {}) as { path?: unknown; edits?: unknown };

  if (typeof page !== "string" || !page) return { ok: false, error: "Missing path" };
  if (!edits || typeof edits !== "object" || Array.isArray(edits)) {
    return { ok: false, error: "Missing edits" };
  }

  const clean: Record<string, string> = {};
  for (const [before, after] of Object.entries(edits as object)) {
    if (typeof before === "string" && typeof after === "string" && before) {
      clean[before] = after;
    }
  }
  if (!Object.keys(clean).length) return { ok: false, error: "Missing edits" };

  return { ok: true, page, edits: clean };
}
