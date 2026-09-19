import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: { root: path.resolve(".") },
  /* Local NEXT_PUBLIC_SITE_URL is http://127.0.0.1:3000, not localhost —
     prescribed by tracked files, not a per-machine .env.local choice:
     supabase/config.toml's [auth].site_url, .env.example and README.md
     all say the two must match. Task 13's invite email bakes that value
     into GoTrue's redirect_to, so a real invite link always lands the
     browser at 127.0.0.1:3000, never localhost:3000 — confirmed directly
     that pointing NEXT_PUBLIC_SITE_URL at localhost instead makes GoTrue
     reject the redirect_to as outside its allow-list and silently
     downgrade the link to the marketing root, quietly breaking the exact
     journey Task 14 exists to fix.
     Without this line, `next dev`'s own dev-only asset-origin check
     403s every JS chunk request that arrives with Origin: 127.0.0.1:3000
     — confirmed directly (200 with this line, 403 without) — so the
     invite page loads but never hydrates: no React, no error, nothing
     visibly wrong until you go looking. Dev-only; a production
     `next build`/`next start` behind a real domain has no such check at
     all, so this has no bearing on production behaviour either way. */
  allowedDevOrigins: ["127.0.0.1"],
  async redirects() {
    return [{ source: "/", destination: "/da", permanent: false }];
  },
};

export default nextConfig;
