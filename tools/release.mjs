/**
 * Offcut — cut a release (docs/VERSIONING.md, design §19.4)
 *
 *   node tools/release.mjs <major|minor|patch> [--dry]
 *
 * Everything a release needs, in an order where each step can refuse. The
 * point is not convenience: it is that the version number, the changelog
 * entry, the package and the tag cannot drift apart, because one command
 * writes all four and stops if any of them is not ready.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const bump = process.argv[2];
const dry = process.argv.includes("--dry");
if (!["major", "minor", "patch", "current"].includes(bump)) {
  console.error("usage: node tools/release.mjs <major|minor|patch|current> [--dry]");
  console.error("  current: stamp the version already in manifest.json (the first release,");
  console.error("           or any time the number was decided ahead of the date)");
  console.error("\nWhich one: docs/VERSIONING.md, \"Deciding the bump\".");
  process.exit(2);
}

const sh = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8" }).trim();
const die = (msg) => { console.error("FAIL  " + msg); process.exit(1); };

// ── 1. the tree, and something worth releasing ───────────────────────────────
if (sh("git", ["status", "--porcelain"])) {
  die("working tree is not clean — commit or stash first");
}

const log = readFileSync("CHANGELOG.md", "utf8");
// The pending section is headed either "[Unreleased]" or "[X.Y.Z] — unreleased",
// the second being what you get when the number was decided before the date.
const unrel = /^##\s*\[(?:Unreleased|\d+\.\d+\.\d+)\][^\n]*unreleased[^\n]*$/mi.exec(log);
if (!unrel) die('CHANGELOG.md has no pending section — expected "## [Unreleased]" or "## [X.Y.Z] — unreleased"');

const after = log.slice(unrel.index + unrel[0].length);
const body = after.slice(0, after.search(/^##\s/m) === -1 ? after.length : after.search(/^##\s/m));
if (!/\S/.test(body.replace(/^###.*$/gm, ""))) {
  die("the Unreleased section is empty — a release with nothing to say is not a release");
}

// ── 2. the number ────────────────────────────────────────────────────────────
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const [maj, min, pat] = manifest.version.split(".").map(Number);
const next = bump === "current" ? manifest.version
           : bump === "major" ? `${maj + 1}.0.0`
           : bump === "minor" ? `${maj}.${min + 1}.0`
           : `${maj}.${min}.${pat + 1}`;

// Chrome validates this before anything else, and rejects the whole upload.
for (const part of next.split(".")) {
  if (!/^(0|[1-9]\d*)$/.test(part) || Number(part) > 65535) {
    die(`${next} is not a legal Chrome version (1-4 integers, 0-65535, no leading zeros)`);
  }
}

const tags = sh("git", ["tag", "--list", "v*"]).split("\n").filter(Boolean);
if (tags.includes("v" + next)) die(`tag v${next} already exists — a published version is never reused`);

console.log(`${manifest.version} → ${next}  (${bump})`);
if (dry) { console.log("\n--dry: nothing written"); process.exit(0); }

// ── 3. write the version and the changelog entry ─────────────────────────────
const today = new Date().toISOString().slice(0, 10);
manifest.version = next;
writeFileSync("manifest.json", JSON.stringify(manifest, null, 2) + "\n");
writeFileSync("CHANGELOG.md", log.replace(unrel[0], `## [${next}] — ${today}`));

// ── 4. every gate, before anything is tagged ─────────────────────────────────
for (const step of [["selftest.js"], ["tools/check-invariants.mjs"], ["tools/check-spec.mjs"]]) {
  try {
    execFileSync(process.execPath, step, { stdio: "inherit" });
  } catch {
    die(`${step[0]} failed — the release stops here; manifest.json and CHANGELOG.md are modified but nothing is committed`);
  }
}

// ── 5. pack, and record what was packed ──────────────────────────────────────
execFileSync(process.execPath, ["tools/pack.mjs"], { stdio: "inherit" });
const zip = readFileSync(`dist/offcut-${next}.zip`);
const sha = (await import("node:crypto")).createHash("sha256").update(zip).digest("hex");

const withSha = readFileSync("CHANGELOG.md", "utf8").replace(
  `## [${next}] — ${today}`,
  `## [${next}] — ${today}\n\n\`offcut-${next}.zip\` · sha256 \`${sha}\``,
);
writeFileSync("CHANGELOG.md", withSha);

// ── 6. commit and tag ────────────────────────────────────────────────────────
execFileSync("git", ["add", "manifest.json", "CHANGELOG.md"], { stdio: "inherit" });
execFileSync("git", ["commit", "-m", `release: ${next}`], { stdio: "inherit" });
execFileSync("git", ["tag", "-a", `v${next}`, "-m", `offcut ${next}\n\nsha256 ${sha}`], { stdio: "inherit" });

console.log(`\nreleased ${next}`);
console.log(`  package  dist/offcut-${next}.zip`);
console.log(`  sha256   ${sha}`);
console.log(`  tag      v${next}  (not pushed — git push --follow-tags when ready)`);
