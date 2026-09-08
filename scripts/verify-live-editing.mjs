#!/usr/bin/env node
/**
 * End-to-end check of live copy editing against a real production build in a
 * real browser, driven over the Chrome DevTools Protocol.
 *
 * It asserts, in order:
 *   1. /da is not editable and issues no request to /api/edit-session.
 *   2. /da?edit with a wrong password is refused.
 *   3. /da?edit with the right password makes the body editable.
 *   4. Typing into an h1 and clicking away posts once to /api/edits.
 *   5. A fresh request to /da contains the new text.
 *   6. With no Redis configured, /da still renders its source copy.
 *
 * Steps 4 and 5 need a scratch Redis database. Set UPSTASH_REDIS_REST_URL and
 * UPSTASH_REDIS_REST_TOKEN to run them; without those they are reported as
 * skipped and a narrower check runs in their place, confirming that an
 * authorised save reaches the store and fails on the store rather than on the
 * session.
 *
 * Usage: node scripts/verify-live-editing.mjs
 */

import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const PASSWORD = "verify-" + Math.random().toString(36).slice(2, 10);
const CHROME =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const HAS_REDIS = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
);

const results = [];
let failed = false;

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  const mark = ok === "skip" ? "–" : ok ? "✓" : "✗";
  console.log(`${mark} ${name}${detail ? ` — ${detail}` : ""}`);
  if (ok === false) failed = true;
}

function assert(name, condition, detail = "") {
  record(name, Boolean(condition), detail);
  if (!condition) throw new Error(`assertion failed: ${name}${detail ? ` (${detail})` : ""}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

async function waitFor(fn, { timeout = 60_000, every = 250, what = "condition" } = {}) {
  const deadline = Date.now() + timeout;
  let last;
  while (Date.now() < deadline) {
    try {
      const value = await fn();
      if (value) return value;
    } catch (error) {
      last = error;
    }
    await sleep(every);
  }
  throw new Error(`timed out waiting for ${what}${last ? `: ${last.message}` : ""}`);
}

/* ------------------------------- the app ------------------------------- */

async function startApp({ redis }) {
  const port = await freePort();
  const env = { ...process.env, EDIT_PASSWORD: PASSWORD, PORT: String(port) };
  if (!redis) {
    delete env.UPSTASH_REDIS_REST_URL;
    delete env.UPSTASH_REDIS_REST_TOKEN;
  }

  const proc = spawn("npx", ["next", "start", "-p", String(port)], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  proc.stdout.on("data", () => {});
  proc.stderr.on("data", () => {});

  const origin = `http://localhost:${port}`;
  await waitFor(async () => (await fetch(`${origin}/da`)).ok, {
    what: `the app on ${origin}`,
  });
  return { proc, origin };
}

/* ------------------------------- the browser ----------------------------- */

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.next = 1;
    this.pending = new Map();
    this.listeners = new Set();
    ws.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
      } else if (msg.method) {
        for (const fn of this.listeners) fn(msg);
      }
    });
  }

  send(method, params = {}, sessionId) {
    const id = this.next++;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    this.ws.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }

  on(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

async function startBrowser() {
  const port = await freePort();
  const profile = await mkdtemp(path.join(tmpdir(), "odatone-verify-"));
  const proc = spawn(CHROME, [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
  ], { stdio: ["ignore", "pipe", "pipe"] });
  proc.stdout.on("data", () => {});
  proc.stderr.on("data", () => {});

  const version = await waitFor(
    async () => (await fetch(`http://127.0.0.1:${port}/json/version`)).json(),
    { what: "Chrome's debugging endpoint" },
  );

  const ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });

  const cdp = new Cdp(ws);
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  await cdp.send("Page.enable", {}, sessionId);
  await cdp.send("Runtime.enable", {}, sessionId);
  await cdp.send("Network.enable", {}, sessionId);

  return { proc, profile, cdp, sessionId };
}

/* --------------------------- page-level helpers -------------------------- */

function makePage(cdp, sessionId) {
  const requests = [];
  const responses = new Map();
  cdp.on((msg) => {
    if (msg.sessionId !== sessionId) return;
    if (msg.method === "Network.requestWillBeSent") {
      requests.push({ url: msg.params.request.url, method: msg.params.request.method });
    }
    if (msg.method === "Network.responseReceived") {
      responses.set(msg.params.response.url, {
        status: msg.params.response.status,
        requestId: msg.params.requestId,
      });
    }
  });

  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await cdp.send(
      "Runtime.evaluate",
      { expression, returnByValue: true, awaitPromise: true },
      sessionId,
    );
    if (exceptionDetails) throw new Error(exceptionDetails.text ?? "evaluate threw");
    return result.value;
  };

  const goto = async (url) => {
    requests.length = 0;
    responses.clear();
    await cdp.send("Page.navigate", { url }, sessionId);
    await waitFor(() => evaluate("document.readyState === 'complete'"), {
      what: `${url} to load`,
    });
    /* React hydrates and EditorShell's effect runs after load. */
    await sleep(1200);
  };

  const insertText = (text) => cdp.send("Input.insertText", { text }, sessionId);

  return { requests, responses, evaluate, goto, insertText };
}

/** Puts the caret at the end of the first element matching `selector`, which
    is what tells EditCapture which element is being edited. */
const caretInto = (selector) => `
  (() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return false;
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    return true;
  })()`;

/* --------------------------------- main ---------------------------------- */

let app;
let browser;

try {
  console.log(`Live copy editing verification${HAS_REDIS ? "" : " (no Redis configured)"}\n`);

  app = await startApp({ redis: HAS_REDIS });
  browser = await startBrowser();
  const page = makePage(browser.cdp, browser.sessionId);

  /* 1. An ordinary visitor. */
  await page.goto(`${app.origin}/da`);
  const editableAtFirst = await page.evaluate("document.body.isContentEditable");
  const askedForSession = page.requests.filter((r) => r.url.includes("/api/edit-session"));
  assert("plain /da is not editable", editableAtFirst === false);
  assert(
    "plain /da never calls /api/edit-session",
    askedForSession.length === 0,
    `${askedForSession.length} request(s)`,
  );

  /* The heading is split across spans, so the whole h1's textContent is a
     run-on that never appears in the markup. One span's text does. */
  const originalHeading = await page.evaluate(
    "document.querySelector('h1 span')?.textContent?.trim() ?? ''",
  );
  assert("the page rendered its copy", originalHeading.length > 0, JSON.stringify(originalHeading));

  /* 2. The wrong password. */
  await page.goto(`${app.origin}/da?edit`);
  const promptShown = await waitFor(
    () => page.evaluate("Boolean(document.querySelector('input[type=password]'))"),
    { what: "the password prompt", timeout: 15_000 },
  );
  assert("?edit shows the password prompt", promptShown);

  await page.evaluate("document.querySelector('input[type=password]').focus()");
  await page.insertText("definitely-not-the-password");
  await page.evaluate("document.querySelector('form button[type=submit]').click()");
  await sleep(800);
  const refused = await page.evaluate(
    "Boolean([...document.querySelectorAll('span')].find(s => /Wrong password/.test(s.textContent)))",
  );
  const stillNotEditable = await page.evaluate("document.body.isContentEditable");
  assert("a wrong password is refused", refused && stillNotEditable === false);

  /* 3. The right password. */
  await page.evaluate("document.querySelector('input[type=password]').focus()");
  await page.evaluate("document.querySelector('input[type=password]').select()");
  await page.insertText(PASSWORD);
  await page.evaluate("document.querySelector('form button[type=submit]').click()");
  await waitFor(() => page.evaluate("document.body.isContentEditable === true"), {
    what: "the page to become editable",
    timeout: 20_000,
  });
  assert("the right password unlocks editing", true);

  const badge = await page.evaluate(
    "[...document.querySelectorAll('span')].map(s => s.textContent).find(t => /editing/.test(t)) ?? ''",
  );
  assert("the badge names the destination", badge === "editing live site", JSON.stringify(badge));

  /* 4 & 5. A real edit, which needs somewhere to store it. */
  if (HAS_REDIS) {
    await page.goto(`${app.origin}/da`);
    await waitFor(() => page.evaluate("document.body.isContentEditable === true"), {
      what: "editing to be on after reload",
    });

    const target = "h1 span";
    const before = await page.evaluate(
      `document.querySelector(${JSON.stringify(target)}).textContent`,
    );
    await page.evaluate(caretInto(target));
    await sleep(300);
    await page.insertText(" (edited)");
    await sleep(300);
    /* Moving the caret out of the element ends the sentence and saves. */
    await page.evaluate(caretInto("h2"));

    const saved = await waitFor(
      () => {
        const hit = page.requests.filter(
          (r) => r.method === "POST" && r.url.endsWith("/api/edits"),
        );
        return hit.length ? hit : null;
      },
      { what: "the save to be posted", timeout: 15_000 },
    );
    assert("clicking away posts exactly one save", saved.length === 1, `${saved.length} post(s)`);

    const response = page.responses.get(`${app.origin}/api/edits`);
    assert("the save was accepted", response?.status === 200, `status ${response?.status}`);
    const { body } = await browser.cdp.send(
      "Network.getResponseBody",
      { requestId: response.requestId },
      browser.sessionId,
    );
    const payload = JSON.parse(body);
    assert("the save went to the live store", payload.mode === "live", JSON.stringify(payload.mode));

    const fresh = await (await fetch(`${app.origin}/da`, { cache: "no-store" })).text();
    assert(
      "a fresh request serves the edited text",
      fresh.includes(`${before} (edited)`),
      `looked for ${JSON.stringify(`${before} (edited)`)}`,
    );
  } else {
    record("clicking away posts exactly one save", "skip", "needs UPSTASH_REDIS_REST_URL");
    record("a fresh request serves the edited text", "skip", "needs UPSTASH_REDIS_REST_URL");

    /* Narrower substitute: prove the session authorises the write and that
       the only thing missing is the store. */
    const status = await page.evaluate(`
      fetch("/api/edits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: "/da", edits: { ${JSON.stringify(originalHeading)}: "x" } }),
      }).then(r => r.status)`);
    assert(
      "an authorised save fails on the store, not the session",
      status === 503,
      `status ${status}`,
    );
  }

  /* 6. The store is optional. */
  app.proc.kill();
  await sleep(500);
  const plain = await startApp({ redis: false });
  const html = await (await fetch(`${plain.origin}/da`, { cache: "no-store" })).text();
  plain.proc.kill();
  assert(
    "with no Redis the site still serves its source copy",
    html.includes(originalHeading),
    `looked for ${JSON.stringify(originalHeading)}`,
  );
} catch (error) {
  failed = true;
  console.error(`\n${error.message}`);
} finally {
  app?.proc.kill();
  if (browser) {
    const exited = new Promise((resolve) => browser.proc.once("exit", resolve));
    browser.proc.kill();
    await Promise.race([exited, sleep(5000)]);
    /* Chrome rewrites its profile as it shuts down, so a failure to clear the
       scratch directory is noise, not a result. */
    await rm(browser.profile, { recursive: true, force: true, maxRetries: 5 }).catch(() => {});
  }
}

const passed = results.filter((r) => r.ok === true).length;
const skipped = results.filter((r) => r.ok === "skip").length;
console.log(
  `\n${passed} passed, ${results.filter((r) => r.ok === false).length} failed` +
    (skipped ? `, ${skipped} skipped` : ""),
);
process.exit(failed ? 1 : 0);
