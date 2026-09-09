/**
 * Magpie — build the Web Store upload (design §15, §19.4)
 *
 *   node tools/pack.mjs
 *
 * Writes dist/magpie-<version>.zip and prints its SHA-256, which goes into the
 * CHANGELOG entry for the release. Anyone can then check that the zip on the
 * store is the one built from this tag.
 *
 * The archive is written by src/zip.js — the same store-only writer that ships
 * to users. Packing every release through it means the release process is also
 * the writer's largest standing test: if it produced a broken archive, the zip
 * you are about to upload would not open.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, posix } from "node:path";
import { createRequire } from "node:module";

const { buildZip } = createRequire(import.meta.url)("../src/zip.js");

// What ships. Anything not named here stays out — a whitelist, because the
// failure mode of a blacklist is shipping a file nobody meant to publish.
const INCLUDE_DIRS = ["src", "_locales", "icons"];
const INCLUDE_FILES = ["manifest.json", "LICENSE"];

const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const version = manifest.version;

function walk(dir, out = []) {
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const files = [
  ...INCLUDE_FILES,
  ...INCLUDE_DIRS.flatMap((d) => walk(d)),
];

// Zip paths are always "/"-separated, whatever the host filesystem calls them.
// Building this on Windows and on CI must produce the same archive.
const entries = files.map((f) => ({
  name: f.split(/[\\/]/).join(posix.sep),
  bytes: new Uint8Array(readFileSync(f)),
}));

// A fixed timestamp keeps the build reproducible: the same source has to give
// the same bytes, or the SHA-256 below means nothing.
const zip = buildZip(entries, { date: new Date("2026-01-01T00:00:00Z") });

mkdirSync("dist", { recursive: true });
const out = `dist/magpie-${version}.zip`;
writeFileSync(out, zip);

const sha = createHash("sha256").update(zip).digest("hex");
const kb = (zip.length / 1024).toFixed(1);

console.log(`${out}  ${kb} KB  ${entries.length} files`);
console.log(`sha256  ${sha}`);

// The store rejects an upload whose manifest version is not new. Catching it
// here costs a second; catching it in the review queue costs a day.
const log = readFileSync("CHANGELOG.md", "utf8");
if (!log.includes(`[${version}]`)) {
  console.error(`\nFAIL  CHANGELOG.md has no [${version}] entry — the release is not documented`);
  process.exit(1);
}
if (!log.includes(sha)) {
  console.log(`\nnote  paste this into the [${version}] CHANGELOG entry:\n      sha256 ${sha}`);
}
