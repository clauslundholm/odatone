import { cookies } from "next/headers";

import { getOverrides, listHistory } from "@/lib/copy-store";
import { EDIT_COOKIE, verifySession } from "@/lib/edit-session";
import { LOCALES } from "@/lib/i18n";

/** Everything the live site says that its source files do not, so it can be
    pasted back into lib/content when the two have drifted far enough to
    bother. Editor-only: the overrides themselves are public, but the history
    of who changed what and when is not worth handing out. */
export async function GET() {
  const jar = await cookies();
  if (!verifySession(jar.get(EDIT_COOKIE)?.value, process.env.EDIT_PASSWORD)) {
    return Response.json({ error: "Not authorised" }, { status: 401 });
  }

  const overrides: Record<string, Record<string, string>> = {};
  for (const locale of LOCALES) {
    overrides[locale] = await getOverrides(locale);
  }

  return Response.json({ overrides, history: await listHistory(200) }, {
    headers: { "Content-Disposition": 'attachment; filename="copy-overrides.json"' },
  });
}
