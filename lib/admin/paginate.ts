/**
 * PostgREST caps every read at `max_rows` — 1000 locally
 * (supabase/config.toml) and on Supabase's cloud default. A plain
 * `.select()` against a table that can grow past that doesn't error: it
 * silently returns an arbitrary window. Every count folded from that
 * window is then wrong, and the window isn't even guaranteed to align
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
 * still the one round trip it always was.
 *
 * `max_rows` is a dashboard setting on Supabase cloud, not a constant this
 * code controls — an earlier version of this function assumed the
 * server's cap equalled `pageSize` and stopped as soon as a page came back
 * shorter than requested. That assumption breaks the moment the server's
 * actual cap is *lower* than `pageSize`: PostgREST clamps a request for
 * 1500 rows down to (say) 1000 with a plain `200 OK`, no error, so a page
 * "shorter than requested" is not the same fact as "this is the end of
 * the table" — the two are indistinguishable from a single page alone.
 * Confusing them here would silently drop everything past the first
 * capped page, reintroducing the exact bug this module exists to close,
 * just at a lower threshold.
 *
 * The fix is to know the true total rather than guess at it: every page
 * request also asks for an exact count (`count: "exact"`), which
 * PostgREST computes as a separate `COUNT(*)` unaffected by `max_rows` —
 * the row cap limits the *data* PostgREST returns, never the count. Once
 * the total is known, this loop can tell a legitimate final short page
 * (rows collected so far have reached the total) apart from a page that
 * was clamped by a cap below `pageSize` (rows collected are still short
 * of the total) — and it's precisely the second case that gets a loud
 * warning, naming the table/context and the counts involved, since that
 * is the situation the whole class of bug hides in.
 */
export type PageResult<T> = { data: T[] | null; error: unknown; count?: number | null };

export type FetchAllRowsResult<T> = { rows: T[]; error: unknown | null };

/**
 * @param fetchPage Given an inclusive `[from, to]` row range, returns that
 *   page — typically
 *   `(from, to) => supabase.from(table).select(cols, { count: "exact" }).order(...).range(from, to)`,
 *   with any `.eq()` filters applied before `.range()`. Include a stable
 *   `.order()` (e.g. the primary key) — `LIMIT`/`OFFSET` paging without one
 *   is documented as non-deterministic and can in principle skip or repeat
 *   a row at a page boundary under a concurrent write.
 * @param context A short label naming the read (e.g. `"admin customers:
 *   locations"`) for the warning below — the whole point of this function
 *   is that a truncated read must never be silent, and a warning with no
 *   idea which table or caller it came from is nearly as unhelpful as no
 *   warning at all.
 * @param pageSize The size of each request. Does not need to match the
 *   server's actual cap — see the module doc comment — but should stay a
 *   reasonable size regardless, to keep each individual request small.
 *   Defaults to 1000, this project's configured cap.
 *
 * Stops and returns whatever was read so far, plus the error, on the first
 * failed page — the same "log it, don't crash the render" contract every
 * caller already applies to a single unpaginated read.
 */
export async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
  context: string,
  pageSize = 1000,
): Promise<FetchAllRowsResult<T>> {
  const rows: T[] = [];
  let from = 0;
  let total: number | null = null;

  for (;;) {
    const to = from + pageSize - 1;
    const requested = to - from + 1;
    const { data, error, count } = await fetchPage(from, to);
    if (error) return { rows, error };

    if (typeof count === "number") total = count;
    const batch = data ?? [];
    rows.push(...batch);

    /* A page shorter than requested is ambiguous on its own — it's either
       the legitimate tail of the table, or the server clamped it below
       what was asked. With the total known, it's only the latter when
       there's still more left to collect than we have; that's the one
       case worth a warning; the true final page (rows.length reaches the
       known total) is completely ordinary and says nothing. */
    if (batch.length > 0 && batch.length < requested && (total === null || rows.length < total)) {
      console.warn(
        `[fetchAllRows] ${context}: requested ${requested} rows from offset ${from} but received only ` +
          `${batch.length}${
            total !== null ? ` (known total ${total}, ${rows.length} collected so far)` : " (total unknown — this read did not request an exact count)"
          } — the server's row cap is likely lower than this function's page size (${pageSize}). Paging on ` +
          `past it rather than treating the short page as the end of the table.`,
      );
    }

    if (batch.length === 0) break; // nothing left, regardless of any count
    if (total !== null && rows.length >= total) break; // reached the known total — definitely done

    // Advance by what was actually returned, not by pageSize: a page
    // clamped below pageSize must not cause the next request to skip the
    // rows it didn't get a chance to return.
    from += batch.length;
  }

  return { rows, error: null };
}
