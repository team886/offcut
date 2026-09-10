/**
 * Offcut — end-to-end smoke test (design §14, §19.5)
 *
 *   node tools/smoke.mjs           run the checks
 *   node tools/smoke.mjs --shots   also write store screenshots to dist/shots/
 *
 * Launches Chromium with the extension actually loaded and drives a fixture
 * conversation page. This is the only check that exercises what a user
 * touches: injection, the floating control, the derived filename, and the
 * download itself producing a file on disk with the right bytes.
 *
 * DELIBERATELY OUTSIDE CI. Every gate in tools/check-*.mjs runs on Node
 * built-ins with nothing to install; this one needs Playwright and a 115 MB
 * browser. Keeping it opt-in preserves that property for the build that has
 * to stay trustworthy, and this runs before a release instead (§19.5).
 *
 * The fixture is served over http from a throwaway origin, and the extension
 * is copied to dist/smoke-ext/ with that origin added to its matches. The
 * shipped manifest is never modified — a test that edits what it ships is
 * testing something else.
 */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const WANT_SHOTS = process.argv.includes("--shots");
const PORT = 8731;
const ORIGIN = `http://localhost:${PORT}`;
const EXT_DIR = resolve("dist/smoke-ext");
const OUT_DIR = resolve("dist/smoke-downloads");
const SHOT_DIR = resolve("dist/shots");

let failures = 0;
const check = (name, ok, detail) => {
  if (ok) console.log(`  ok    ${name}`);
  else { failures++; console.log(`  FAIL  ${name}${detail ? "\n          " + detail : ""}`); }
};

// ── a copy of the extension that also matches the fixture origin ─────────────
rmSync(EXT_DIR, { recursive: true, force: true });
mkdirSync(EXT_DIR, { recursive: true });
for (const d of ["src", "_locales", "icons"]) cpSync(d, join(EXT_DIR, d), { recursive: true });
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
manifest.content_scripts[0].matches.push(`${ORIGIN}/*`);
manifest.host_permissions.push(`${ORIGIN}/*`);
writeFileSync(join(EXT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));

// boot() refuses to run on a host with no registry row (§3.4.2), so the copy
// gets one. It carries Claude's MEASURED selector, because the fixture
// reproduces Claude's measured markup — a selector invented for the test
// would only be testing the test.
const registry = readFileSync("src/registry.js", "utf8").replace(
  "const REGISTRY = [",
  `const REGISTRY = [
  { id: "smoke", host: "localhost", name: "Smoke fixture",
    newChatUrl: "${ORIGIN}/", chatRoot: null,
    codeBlock: "pre.code-block__code > code, pre > code",
    LAST_VERIFIED: "2026-09-10" },`);
writeFileSync(join(EXT_DIR, "src/registry.js"), registry);

// ── serve the fixture ────────────────────────────────────────────────────────
const fixture = readFileSync("test/fixture/conversation.html");
const server = createServer((_req, res) => {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(fixture);
}).listen(PORT);

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

const ctx = await chromium.launchPersistentContext("", {
  headless: false,
  acceptDownloads: true,
  downloadsPath: OUT_DIR,
  args: [`--disable-extensions-except=${EXT_DIR}`, `--load-extension=${EXT_DIR}`],
});

try {
  // The service worker tells us the extension id, and that it started at all.
  let sw = ctx.serviceWorkers()[0];
  if (!sw) sw = await ctx.waitForEvent("serviceworker", { timeout: 10000 });
  const extId = new URL(sw.url()).host;
  check("the service worker starts", !!extId, sw.url());

  const page = await ctx.newPage();
  await page.goto(ORIGIN, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);                 // document_idle + first scan

  // ── the shell mounts, and mounts where it is supposed to ───────────────────
  // The shell is mounted lazily, on first use, so it is asserted after the
  // hover below — the first run of this test checked here and was checking
  // the wrong moment.

  // ── the floating control appears on hover, naming the file it will make ────
  const firstBlock = page.locator("pre.code-block__code > code").first();
  await firstBlock.hover();
  await page.waitForTimeout(400);
  const ctl = page.locator('[data-oc="root"]').locator(".oc-ctl");
  const ctlVisible = await ctl.isVisible().catch(() => false);
  check("the control appears over a code block", ctlVisible);

  const shell = await page.evaluate(() => {
    const h = document.querySelector('[data-oc="root"]');
    if (!h) return { mounted: false };
    return {
      mounted: true,
      isShadowHost: !!h.shadowRoot,
      onDocumentElement: h.parentElement === document.documentElement,
      // `all: initial` is a shorthand the browser expands, so it is not in the
      // serialised style attribute — the first version of this check looked for
      // the text and reported an isolation failure that was not one. What
      // matters is the behaviour: the overlay is fixed, and it does not eat the
      // page's clicks.
      position: getComputedStyle(h).position,
      pointerEvents: getComputedStyle(h).pointerEvents,
      pageStylesheets: document.querySelectorAll("link[rel=stylesheet]").length,
    };
  });
  check("the shell mounts as a shadow host", shell.mounted && shell.isShadowHost,
        JSON.stringify(shell));
  check("it hangs off the document element, not inside the page's own tree",
        shell.onDocumentElement, JSON.stringify(shell));
  check("the overlay is fixed and does not swallow the page's clicks",
        shell.position === "fixed" && shell.pointerEvents === "none", JSON.stringify(shell));
  check("no stylesheet is injected into the page",
        shell.pageStylesheets === 0, JSON.stringify(shell));

  const preview = ctlVisible ? (await ctl.getAttribute("title")) : null;
  check("the control names the file before you commit to it",
        !!preview && preview.endsWith(".css"), `title=${preview}`);

  // ── the download actually produces a file ─────────────────────────────────
  let saved = null;
  if (ctlVisible) {
    const [dl] = await Promise.all([
      page.waitForEvent("download", { timeout: 8000 }).catch(() => null),
      ctl.click(),
    ]);
    if (dl) {
      saved = join(OUT_DIR, dl.suggestedFilename());
      await dl.saveAs(saved);
    }
    check("clicking the control downloads a file", !!dl,
          dl ? `saved ${dl.suggestedFilename()}` : "no download event fired");
    check("the delivered name is the previewed name",
          !!dl && dl.suggestedFilename() === preview,
          dl ? `preview=${preview} delivered=${dl.suggestedFilename()}` : "");
    if (saved && existsSync(saved)) {
      const body = readFileSync(saved, "utf8");
      check("the file holds the block's code, not the page's chrome",
            body.includes(".panel") && body.includes("border-radius") && !body.includes("<pre"),
            body.slice(0, 60).replace(/\n/g, "\\n"));
    }
  }

  // ── the popup, and through it the naming chain on real DOM ────────────────
  // Not page.evaluate: a content script runs in an isolated world, so its
  // globals are invisible from the page — the first draft of this test tried
  // and got `undefined`. Asking through the popup is both the only way to
  // reach them and the path the product itself uses.
  const popup = await ctx.newPage();
  await popup.goto(`chrome-extension://${extId}/src/panel.html`);
  await popup.waitForTimeout(800);

  const listed = await popup.evaluate(async () => {
    const tabs = await chrome.tabs.query({});
    const tab = tabs.find((t) => t.url && t.url.startsWith("http://localhost"));
    if (!tab) return { error: "fixture tab not found" };
    return await new Promise((res) =>
      chrome.tabs.sendMessage(tab.id, { type: "items:list" }, (r) => res(r || { error: "no reply" })));
  });

  const offered = (listed.items || []).map((i) => i.name);
  check("the content script answers the popup", !listed.error, JSON.stringify(listed.error));
  check("only blocks worth offering are offered", offered.length === 4, JSON.stringify(offered));
  check("short blocks are counted, not silently dropped", listed.skipped === 2,
        `skipped=${listed.skipped}`);
  check("a filename in the fence wins outright",
        offered.some((n) => n.startsWith("seed")), JSON.stringify(offered));
  check("a declaration names the file",
        offered.some((n) => n.startsWith("render-cart")), JSON.stringify(offered));
  check("a throwaway local does NOT name the file",
        !offered.some((n) => /^el\./.test(n)), JSON.stringify(offered));

  // The popup is opened as a TAB here, so its own tab is the active one and it
  // correctly reports that a chrome-extension:// page is not a chat. Provider
  // detection is covered above through the message path; what is worth
  // asserting here is that the page renders and speaks a real language.
  const shellState = await popup.evaluate(() => ({
    version: document.getElementById("ver")?.textContent || "",
    empty: (document.querySelector(".empty")?.textContent || "").trim(),
  }));
  check("the popup renders and reports its version",
        /^v\d+\.\d+\.\d+$/.test(shellState.version), JSON.stringify(shellState.version));
  check("its empty state is localised, not a bare message key",
        shellState.empty.length > 12 && shellState.empty.includes(" "),
        JSON.stringify(shellState.empty.slice(0, 70)));

  if (WANT_SHOTS) {
    mkdirSync(SHOT_DIR, { recursive: true });
    await firstBlock.hover();
    await page.waitForTimeout(300);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.screenshot({ path: join(SHOT_DIR, "1-control-on-a-code-block.png") });
    await popup.setViewportSize({ width: 480, height: 620 });
    await popup.screenshot({ path: join(SHOT_DIR, "2-the-panel.png") });
    console.log(`\n  screenshots -> ${SHOT_DIR}`);
  }
} finally {
  await ctx.close();
  server.close();
}

console.log(failures ? `\n${failures} check(s) failed` : "\nsmoke ok");
process.exit(failures ? 1 : 0);
