/**
 * PostgREST caps every read at `max_rows` — 1000 locally
 * (supabase/config.toml) and on Supabase's cloud default. A plain
 * `.select()` against a table that can grow past that doesn't error: it
 * silently returns an arbitrary 1000-row window. Every count folded from
 * that window is then wrong, and the window isn't even guaranteed to align
 * with a stable sort — once a table passes the cap, *every* customer's
 * aggregated figure can go wrong at once, not just the one that pushed it
 * over.
 *
 * Reproduced live: a customer with 1201 locations rendered as "933
 * locations" and a visibly wrong MRR on the customers list, with nothing
 * on screen or in a log to say the read had been truncated.
 *
 * `fetchAllRows` reads a table page by page via `.range()` instead of
 * trusting one unbounded `.select()`. For a table under the cap this is
 * exactly the one round trip it always was — the loop only continues once
 * a page comes back full — so it doesn't turn "aggregate once, fold in
 * memory" into an N+1 query; it only pays for more pages once the data
 * actually needs them.
 */
export type PageResult<T> = { data: T[] | null; error: unknown };

export type FetchAllRowsResult<T> = { rows: T[]; error: unknown | null };

/**
 * @param fetchPage Given an inclusive `[from, to]` row range, returns that
 *   page — typically `(from, to) => supabase.from(table).select(cols).range(from, to)`,
 *   with any `.eq()`/`.order()` filters applied before `.range()`.
 * @param pageSize Must not exceed the server's `max_rows`, or a single
 *   requested page would itself be silently clamped and this function
 *   would stop one page early. Defaults to 1000, matching this project's
 *   configured cap; pass the deployment's actual value if it ever differs.
 *
 * Stops and returns whatever was read so far, plus the error, on the first
 * failed page — the same "log it, don't crash the render" contract every
 * caller already applies to a single unpaginated read.
 */
export async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize = 1000,
): Promise<FetchAllRowsResult<T>> {
  const rows: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) return { rows, error };
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }
  return { rows, error: null };
}
