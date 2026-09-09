#!/usr/bin/env node
/**
 * Writes a self-contained static copy of the site to static-export/.
 *
 * The app cannot use Next's own `output: "export"`: it has route handlers that
 * read the request and cookies, a redirect in next.config, server actions
 * behind the forms, and revalidation behind live copy editing — all of which
 * that mode refuses. So this builds the real thing, serves it, and saves what
 * a browser would actually receive.
 *
 * The result keeps the production URL shape (/da/priser -> da/priser/
 * index.html), so any static web server serves it at the same paths. Scripts
 * and styles come along, so the player, calculator and theme toggle still
 * work. What cannot survive without a server: the signup and contact forms
 * (server actions), live copy editing, and the / -> /da redirect, which is
 * replaced by a meta refresh.
 *
 * The snapshot is built from lib/content alone. The override store is switched
 * off for the build and the server behind it, so a static copy never depends on
 * Redis being reachable and never bakes in live edits. Pass --with-overrides to
 * capture the site exactly as it currently reads instead.
 *
 * Usage: node scripts/export-static.mjs [--out <dir>] [--skip-build]
 *                                       [--with-overrides]
 */

import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { cp, mkdir, rm, writeFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

import { LOCALES, PAGE_KEYS, SLUGS } from "../lib/i18n.ts";

const args = process.argv.slice(2);
const outDir = path.resolve(
  args.includes("--out") ? args[args.indexOf("--out") + 1] : "static-export",
);
const skipBuild = args.includes("--skip-build");
const withOverrides = args.includes("--with-overrides");

/* Next does not overwrite a variable that is already set, so blanking these
   here beats the credentials in .env.local, and lib/copy-store treats an empty
   URL or token as no store at all. */
const REDIS_VARS = [
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
];

const childEnv = { ...process.env };
if (!withOverrides) for (const name of REDIS_VARS) childEnv[name] = "";

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

/** /da -> da/index.html, /da/priser -> da/priser/index.html. Keeping the
    directory shape means a static host serves the same URLs as production. */
function fileFor(route) {
  return path.join(outDir, route.replace(/^\//, ""), "index.html");
}

async function save(file, body) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, body);
}

const server = { proc: null };

try {
  console.log(
    withOverrides
      ? "Including stored copy overrides.\n"
      : "Building from lib/content only — the override store is switched off.\n",
  );

  if (!skipBuild) {
    /* Cached copy outlives the credentials. The store is read through
       unstable_cache, which persists in .next/cache between builds, so an
       earlier build made with credentials would otherwise hand this one the
       very overrides it is trying to leave out. */
    if (!withOverrides) await rm(".next/cache/fetch-cache", { recursive: true, force: true });
    console.log("Building…\n");
    await run("npx", ["next", "build"], { env: childEnv });
  }

  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`\nServing the production build on ${origin}`);
  server.proc = spawn("npx", ["next", "start", "-p", String(port)], {
    stdio: ["ignore", "ignore", "ignore"],
    env: childEnv,
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
    await save(fileFor(route), await res.text());
    console.log(`  ${route}`);
  }

  /* The 404, which a static host can be pointed at. */
  const notFound = await fetch(`${origin}/da/definitely-not-a-page`);
  await save(path.join(outDir, "404.html"), await notFound.text());

  /* next.config redirects / to /da, and a static host will not. */
  await save(
    path.join(outDir, "index.html"),
    `<!doctype html>
<html lang="da">
  <head>
    <meta charset="utf-8">
    <title>Odatone</title>
    <meta http-equiv="refresh" content="0; url=./da/">
    <link rel="canonical" href="./da/">
  </head>
  <body><p><a href="./da/">Fortsæt til Odatone</a></p></body>
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
  console.log(`Serve it with:  npx serve ${path.relative(process.cwd(), outDir)}`);
} finally {
  server.proc?.kill();
}
