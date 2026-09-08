import { cache } from "react";

import { applyCopy } from "@/lib/copy-apply";
import { getOverrides } from "@/lib/copy-store";
import type { Locale } from "@/lib/i18n";

/* React's cache keeps one render pass to a single round trip, however many
   components ask for copy. Everything on the server reads through this,
   including the layout, so a page render never fetches twice. */
export const overridesFor = cache(getOverrides);

export async function serverCopy<T>(defaults: T, locale: Locale): Promise<T> {
  return applyCopy(defaults, await overridesFor(locale));
}
