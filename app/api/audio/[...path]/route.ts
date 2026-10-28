import {
  AUDIO_PROXY_PREFIX,
  DEMO_FOLDER,
  FULL_FOLDER,
  TRAX_DEMO_AUDIO_BASE,
} from "@/lib/catalogue/trax";
import { createClient } from "@/lib/supabase/server";

/**
 * The audio proxy, and the only reason the player can hear 1000trax at all.
 *
 * demo.1000trax.com answers with `Access-Control-Allow-Origin: 1000trax.com`.
 * That is a bare host, not an origin, so it matches neither `*` nor
 * `https://odatone.com` and no browser will ever accept it. Our player sets
 * `crossOrigin = "anonymous"` (components/player/PlayerProvider.tsx) because
 * the spectrum runs off an AnalyserNode, and a CORS-anonymous request whose
 * ACAO does not match is a network error -- the element fires `error` and
 * nothing plays. Dropping crossOrigin would load the file but taint the
 * element, and Chrome silences a tainted source the moment it is connected
 * to Web Audio. There is no arrangement of flags that gets both the audio
 * and the visualiser off the direct URL.
 *
 * So the bytes come back through our own origin, where they are same-origin
 * and none of that applies. The day 1000trax return a usable header this
 * file can be deleted and `proxiedAudioUrl` can go back to `audioUrl`.
 *
 * This is deliberately NOT a general proxy. It will fetch one folder from
 * one host, and only files that look like their compositions -- an open
 * relay on our domain would be worth more to an abuser than the music is to
 * us.
 */

/** The two folders we serve, and the only two.
 *
 *  `MusicShort/` is the 60-second cut and is open to anyone: it is what
 *  a visitor hears while deciding, and what 1000trax's own demo player
 *  serves. `Music/` is the whole composition and needs a session -- that
 *  is the line between trying the library and subscribing to it.
 *
 *  `Effects/` is excluded on purpose and not by omission: that is where
 *  their advertising lives (see isAdvertisement), and a jingle must not
 *  become reachable because somebody guessed a URL. */
const ALLOWED_FOLDERS = new Set([DEMO_FOLDER, FULL_FOLDER]);

/** Their filenames look like `250219.002@v10.mp3`. The `@` is theirs. */
const FILE = /^[A-Za-z0-9][A-Za-z0-9._@-]{0,120}\.mp3$/;

/** Their own CDN allows a week; matching it means a track a café plays on
    repeat is fetched from them once and served from our edge after that.
    `immutable` is safe because the filename carries the version (`@v10`).

    The full-length folder gets `private` instead. That response depends
    on who asked, and a shared cache which did not know that would hand
    the next anonymous visitor a copy of what a subscriber just played.
    The cost is real — a full track is 5.8 MB and is re-fetched per
    listener rather than once per edge — and it is the strongest
    argument for getting a usable CORS header out of 1000trax, after
    which the browser streams from their CDN and we carry nothing. */
const CACHE_PUBLIC = "public, max-age=604800, s-maxage=604800, immutable";
const CACHE_PRIVATE = "private, max-age=604800, immutable";

const UPSTREAM_TIMEOUT_MS = 15_000;

/* Range requests are the whole point of an audio element -- seeking issues
   a fresh request for a byte offset -- so this can never be prerendered or
   cached as a single static body. */
export const dynamic = "force-dynamic";

function upstreamFor(path: string[]): string | null {
  if (path.length !== 2) return null;
  const [folder, file] = path;
  if (!ALLOWED_FOLDERS.has(folder)) return null;
  if (!FILE.test(file)) return null;
  /* Belt and braces over the regex: `.` and `/` cannot survive it, but a
     path that climbed out of the folder would be the one bug here worth
     catching twice. */
  if (file.includes("..") || file.includes("/")) return null;
  return `${TRAX_DEMO_AUDIO_BASE}${folder}/${encodeURIComponent(file)}`;
}

/** Any valid session. Deliberately not "a customer with a live
    subscription": a staff member checking a track, and a customer whose
    card bounced last night, should both still hear the catalogue.
    Billing decides what a plan costs, not whether audio decodes. */
async function hasSession(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    return typeof data?.claims?.sub === "string";
  } catch {
    /* Auth being unreachable must not take the music down: the short cut
       is public and plays for everybody, so fall back to it. */
    return false;
  }
}

async function pass(request: Request, path: string[], withBody: boolean) {
  const url = upstreamFor(path);
  if (!url) return new Response("Not found", { status: 404 });

  const full = path[0] === FULL_FOLDER;
  if (full && !(await hasSession())) {
    /* Redirect rather than refuse. A session that expired mid-queue
       would otherwise become a dead track and a silent room; this way
       the listener drops to the 60-second cut and the music keeps
       going. `no-store` because the answer depends on the session, and
       the next request may deserve the other one. */
    return new Response(null, {
      status: 302,
      headers: {
        Location: `${AUDIO_PROXY_PREFIX}${DEMO_FOLDER}/${path[1]}`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  const range = request.headers.get("range");

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: withBody ? "GET" : "HEAD",
      headers: range ? { Range: range } : undefined,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      redirect: "error",
      cache: "no-store",
    });
  } catch {
    /* Their host being slow or down is not our bug to dress up as one:
       502 tells the player to move on to the next track. */
    return new Response("Upstream unavailable", { status: 502 });
  }

  if (!upstream.ok && upstream.status !== 206) {
    return new Response("Upstream error", { status: upstream.status === 404 ? 404 : 502 });
  }

  const headers = new Headers({
    "Content-Type": upstream.headers.get("content-type") ?? "audio/mpeg",
    "Cache-Control": full ? CACHE_PRIVATE : CACHE_PUBLIC,
    "Accept-Ranges": "bytes",
  });
  for (const h of ["content-length", "content-range"]) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }

  return new Response(withBody ? upstream.body : null, {
    status: upstream.status,
    headers,
  });
}

export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return pass(request, path, true);
}

export async function HEAD(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return pass(request, path, false);
}
