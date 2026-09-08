/* Cookie names, kept apart from the signing in lib/edit-session so the editor
   shell can read them on the client without pulling node:crypto into the
   browser bundle. */

/** Authorises writes. httpOnly, so script on the page cannot read it. */
export const EDIT_COOKIE = "odatone_edit";
/** Readable by the page, and carries no authority whatsoever: its only job is
    to tell the client whether asking about a session is worth a request. */
export const HINT_COOKIE = "odatone_edit_hint";

export const SESSION_DAYS = 30;
