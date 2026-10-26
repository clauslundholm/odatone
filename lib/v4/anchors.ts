/** Anchors on the front page that the shell links to.
 *
 *  Its own module so Shell can link to the builder without importing
 *  Landing — Spilleplan and Sæsoner render the shell too, and pulling the
 *  whole landing bundle into them for one string would be a poor trade.
 */
export const BUILDER_ID = "byg-din-liste";
