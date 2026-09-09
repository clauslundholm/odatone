import { cache } from "react";
import { unstable_cache } from "next/cache";

import { applyCopy } from "@/lib/copy-apply";
import { getOverrides } from "@/lib/copy-store";
import type { Locale } from "@/lib/i18n";

/** Everything that invalidates the stored copy carries this tag, so one save
    is enough to make every page rebuild against the new wording. */
export const OVERRIDES_TAG = "copy-overrides";

/* Reading the store is a network call, and an uncached one during render opts
   the route into dynamic rendering. That is not a detail: it is how all 25
   prerendered pages quietly became server-rendered the moment the Upstash
   credentials arrived, because until then the read returned early and never
   reached the network at all.

   Caching it puts the read back in the build rather than in the request, so
   the pages prerender again. Nothing expires on a timer — a save revalidates
   this tag, which is the only thing that ever changes the answer. */
const storedOverrides = unstable_cache(
  async (locale: Locale) => getOverrides(locale),
  ["copy-overrides"],
  { tags: [OVERRIDES_TAG] },
);

/* React's cache keeps one render pass to a single round trip, however many
   components ask for copy. Everything on the server reads through this,
   including the layout, so a page render never fetches twice. */
export const overridesFor = cache((locale: Locale) => storedOverrides(locale));

export async function serverCopy<T>(defaults: T, locale: Locale): Promise<T> {
  return applyCopy(defaults, await overridesFor(locale));
}
