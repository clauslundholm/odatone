#!/usr/bin/env node
/**
 * Writes a self-contained static copy of the site to static-export/.
 *
 * The app cannot use Next's own `output: "export"`: it has route handlers that
 * read the request and cookies, a redirect in next.config, and server actions
 * behind the forms — all of which that mode refuses. So this builds the real
 * thing, serves it, and saves what a browser would actually receive.
 *
 * The result keeps the production URL shape (/da/priser -> da/priser/
 * index.html), so any static web server serves it at the same paths. Scripts
 * and styles come along, so the player, calculator and theme toggle still
 * work. What cannot survive without a server: the signup and contact forms
 * (server actions), and the / -> /da redirect, which is replaced by a meta
 * refresh.
 *
 * Pages are written as individual files — da.html, da-priser.html — with every
 * reference to the site's own root rewritten relative, so one file can be
 * opened, moved or sent on its own. Opened straight off disk a page renders and
 * navigates, but Chrome treats a file:// document as an opaque origin and so
 * refuses the CORS-gated requests: the webfont falls back to the system sans
 * and the chunks loaded on demand never arrive. Serving the folder over HTTP —
 * `npx serve static-export` — has neither problem. --nested writes the
 * production URL shape (da/priser/index.html) for hosting instead.
 *
 * Usage: node scripts/export-static.mjs [--out <dir>] [--skip-build] [--nested]
 */

import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { cp, mkdir, rm, writeFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

import { LOCALES, PAGE_KEYS, SLUGS, DEFAULT_LOCALE } from "../lib/i18n.ts";

const args = process.argv.slice(2);
const outDir = path.resolve(
  args.includes("--out") ? args[args.indexOf("--out") + 1] : "static-export",
);
const skipBuild = args.includes("--skip-build");
const nested = args.includes("--nested");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function run(command, argv, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, argv, { stdio: "inherit", ...options });
    proc.on("error", reject);
    proc.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)),
    );
  });
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function waitFor(fn, { timeout = 90_000, what = "condition" } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      if (await fn()) return true;
    } catch {
      /* not up yet */
    }
    await sleep(300);
  }
  throw new Error(`timed out waiting for ${what}`);
}

async function dirSize(dir) {
  let total = 0;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    total += entry.isDirectory() ? await dirSize(full) : (await stat(full)).size;
  }
  return total;
}

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/** Every page the site renders, in production URL order. */
function routes() {
  const all = [];
  for (const locale of LOCALES) {
    all.push(`/${locale}`);
    for (const key of PAGE_KEYS) all.push(`/${locale}/${SLUGS[key][locale]}`);
  }
  return all;
}

/** Where a route's HTML goes.

    Flat by default — /da -> da.html, /da/priser -> da-priser.html — so every
    page is one openable file. --nested keeps the production URL shape
    (/da/priser -> da/priser/index.html) for hosting behind a web server. */
function fileFor(route) {
  if (nested) return path.join(outDir, route.replace(/^\//, ""), "index.html");
  return path.join(outDir, `${route.replace(/^\//, "").replaceAll("/", "-")}.html`);
}

const flatName = (route) => `${route.replace(/^\//, "").replaceAll("/", "-")}.html`;

/* Longest first, so /da never rewrites the front of /da/priser. */
const ROUTE_FILES = routes()
  .map((route) => [route, flatName(route)])
  .sort((a, b) => b[0].length - a[0].length);

/* Everything the site serves from its own root. */
const ROOT_ASSETS = ["/_next/", "/audio/", "/favicon", "/odatone-logo"];

/** Flat pages all sit in one directory, so every absolute reference to this
    site becomes a plain relative one and the file works when opened directly.
    Absolute URLs to elsewhere — canonicals, og:url, hreflang — are left alone,
    because they are meant to point at the real site. Each replacement is done
    in both the plain and the backslash-escaped form, since the same paths
    appear again inside the JSON payload embedded in a script tag. */
function relativise(html) {
  let out = html;
  for (const asset of ROOT_ASSETS) {
    const bare = asset.slice(1);
    out = out.replaceAll(`"${asset}`, `"${bare}`).replaceAll(`\\"${asset}`, `\\"${bare}`);
    out = out.replaceAll(`'${asset}`, `'${bare}`);
  }
  for (const [route, file] of ROUTE_FILES) {
    for (const q of ['"', '\\"']) {
      out = out.replaceAll(`${q}${route}${q}`, `${q}${file}${q}`);
      /* A link may carry a fragment or a query — the signup links pass a
         chosen plan that way — and both survive a file:// URL. */
      out = out.replaceAll(`${q}${route}#`, `${q}${file}#`);
      out = out.replaceAll(`${q}${route}?`, `${q}${file}?`);
    }
  }
  return out;
}

async function save(file, body) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, body);
}

const server = { proc: null };

try {
  if (!skipBuild) {
    console.log("Building…\n");
    await run("npx", ["next", "build"]);
  }

  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`\nServing the production build on ${origin}`);
  server.proc = spawn("npx", ["next", "start", "-p", String(port)], {
    stdio: ["ignore", "ignore", "ignore"],
  });
  await waitFor(async () => (await fetch(`${origin}/da`)).ok, { what: "the server" });

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  /* Pages. */
  const list = routes();
  console.log(`\nSaving ${list.length} pages`);
  for (const route of list) {
    const res = await fetch(`${origin}${route}`);
    if (!res.ok) throw new Error(`${route} returned ${res.status}`);
    const html = await res.text();
    await save(fileFor(route), nested ? html : relativise(html));
    console.log(`  ${route}`);
  }

  /* The 404, which a static host can be pointed at. */
  const notFound = await fetch(`${origin}/da/definitely-not-a-page`);
  const notFoundHtml = await notFound.text();
  await save(path.join(outDir, "404.html"), nested ? notFoundHtml : relativise(notFoundHtml));

  /* next.config redirects / to /da, and neither a static host nor a file
     manager will. */
  const home = nested ? "da/" : flatName(`/${DEFAULT_LOCALE}`);
  await save(
    path.join(outDir, "index.html"),
    `<!doctype html>
<html lang="da">
  <head>
    <meta charset="utf-8">
    <title>Odatone</title>
    <meta http-equiv="refresh" content="0; url=./${home}">
    <link rel="canonical" href="./${home}">
  </head>
  <body><p><a href="./${home}">Fortsæt til Odatone</a></p></body>
</html>
`,
  );

  /* Generated files that are routes rather than pages. */
  for (const name of ["robots.txt", "sitemap.xml"]) {
    const res = await fetch(`${origin}/${name}`);
    if (res.ok) await save(path.join(outDir, name), await res.text());
  }

  /* The build's own JS, CSS and fonts, at the paths the HTML asks for. */
  console.log("\nCopying assets");
  await cp(".next/static", path.join(outDir, "_next", "static"), { recursive: true });
  console.log("  _next/static");

  /* Everything served from the site root: audio, favicons, the logo. */
  for (const entry of await readdir("public", { withFileTypes: true })) {
    await cp(path.join("public", entry.name), path.join(outDir, entry.name), {
      recursive: true,
    });
    console.log(`  ${entry.name}`);
  }

  const size = await dirSize(outDir);
  console.log(
    `\nWrote ${list.length} pages to ${path.relative(process.cwd(), outDir)}/ (${mb(size)})`,
  );
  console.log(
    nested
      ? `Serve it with:  npx serve ${path.relative(process.cwd(), outDir)}`
      : `Open ${path.relative(process.cwd(), outDir)}/${home} directly, or serve the folder.`,
  );
} finally {
  server.proc?.kill();
}
