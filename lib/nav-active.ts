/**
 * Which navigation row should be highlighted for the path being viewed.
 *
 * The rule is "most specific match wins", and it exists because the obvious
 * rule is wrong. Matching each row independently with
 * `path === href || path.startsWith(href + "/")` looks right and is right
 * for a section — `/admin/customers/8f3a` should light Customers — but a
 * section INDEX is a prefix of every one of its siblings, so `/admin` lit
 * Dashboard on `/admin/customers`, `/admin/billing`, `/admin/products` and
 * `/admin/users`, and `/my-odatone` lit Oversigt on both portal pages.
 *
 * Comparing candidates against each other, rather than each against the
 * path alone, fixes that without anyone having to flag which rows are
 * indexes — a flag would have to be set correctly on every future row, and
 * would be wrong the first time someone forgot.
 *
 * Matching is on segment boundaries, never characters: `/administrators`
 * must not match `/admin`, the same concern `lib/tenancy.ts` documents for
 * the routes it guards.
 */
export function activeNavHref(
  hrefs: readonly string[],
  currentPath: string | null | undefined,
): string | undefined {
  if (!currentPath) return undefined;

  let best: string | undefined;
  for (const href of hrefs) {
    const matches = currentPath === href || currentPath.startsWith(`${href}/`);
    if (!matches) continue;
    if (best === undefined || href.length > best.length) best = href;
  }
  return best;
}
