/**
 * Magpie — what is actually in a conversation history (docs/DEMAND.md)
 *
 * Paste into the console on a signed-in claude.ai tab. Read-only: it issues
 * the same GETs the extension's API tier would, and writes nothing.
 *
 * CONTENT-FREE BY CONSTRUCTION. It reports counts, languages, lengths and
 * derived names. No code, no message text and no conversation title is ever
 * printed or retained — the same discipline as tools/discover.js, because the
 * numbers are shareable and the conversations are not.
 *
 * The point is to refute docs/DEMAND.md, not to confirm it. Its whole
 * argument rests on one account; two more runs settle it either way.
 *
 *   await magpieMeasure(60)     // conversations to scan, default 40
 */
async function magpieMeasure(limit = 40) {
  const org = (document.cookie.match(/lastActiveOrg=([^;]+)/) || [])[1];
  if (!org) return "no lastActiveOrg cookie — sign in first";

  const api = (p) => fetch(p).then((r) => (r.ok ? r.json() : Promise.reject(r.status)));
  const list = await api(`/api/organizations/${org}/chat_conversations?limit=${limit}`);

  const MIN_LINES = 3;                      // MIN_CODE_LINES in src/parse.js

  // Trimmed copy of the naming chain, enough to group revisions by name.
  const PAT = {
    py: /^\s*(?:class|def)\s+(\w+)/m,
    js: /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function|class)\s+(\w+)/m,
    go: /^\s*(?:func|type)\s+(\w+)/m,
    rs: /^\s*(?:pub\s+)?(?:fn|struct|enum|trait)\s+(\w+)/m,
    sql: /^\s*(?:CREATE|ALTER)\s+(?:TABLE|VIEW|INDEX)\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"]?(\w+)/im,
  };
  const ALIAS = { python: "py", javascript: "js", ts: "js", typescript: "js", tsx: "js", jsx: "js", golang: "go", rust: "rs" };
  const nameOf = (lang, code) => {
    const info = String(lang || "");
    const colon = info.indexOf(":");
    if (colon > -1) return info.slice(colon + 1).trim().toLowerCase();
    const l = (colon > -1 ? info.slice(0, colon) : info).toLowerCase();
    const p = PAT[l] || PAT[ALIAS[l]];
    const m = p && p.exec(code);
    return m && m[1] && m[1].length >= 3 ? m[1].toLowerCase() : null;
  };

  const R = {
    scanned: 0, failed: 0,
    fences: 0, qualifying: 0,
    convsWithQualifying: 0, qualifyingPerConv: {},
    shortFenceLangs: {}, qualifyingLangs: {},
    shortFenceLines: { "1": 0, "2": 0 },
    revisionChains: 0, blocksInChains: 0,
    multiFileAnswers: 0,
    truncatedMessages: 0,
    convsWithAttachments: 0, attachments: 0, producedFiles: 0,
    convsInProject: 0,
    namesSeenAcross: {},
    oldest: null, newest: null,
  };

  for (const c of list) {
    let full;
    try {
      full = await api(`/api/organizations/${org}/chat_conversations/${c.uuid}?tree=True&rendering_mode=messages`);
    } catch { R.failed++; continue; }
    R.scanned++;
    if (c.project_uuid) R.convsInProject++;
    if (!R.oldest || c.updated_at < R.oldest) R.oldest = c.updated_at;
    if (!R.newest || c.updated_at > R.newest) R.newest = c.updated_at;

    // Active branch only — the same walk the extension does (§3.1).
    const byUuid = new Map((full.chat_messages || []).map((m) => [m.uuid, m]));
    const branch = [];
    let cur = byUuid.get(full.current_leaf_message_uuid);
    while (cur) { branch.unshift(cur); cur = cur.parent_message_uuid ? byUuid.get(cur.parent_message_uuid) : null; }

    const namesHere = new Map();            // derived name -> count, for chains
    let qualifyingHere = 0;

    for (const m of branch) {
      if (m.truncated) R.truncatedMessages++;
      const atts = (m.attachments || []).length;
      if (atts) { R.attachments += atts; }
      R.producedFiles += (m.files || []).length;

      if (m.sender !== "assistant") continue;
      const text = (m.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");

      let open = false, lang = null, body = [];
      const namesInThisAnswer = new Set();
      for (const line of text.split("\n")) {
        const f = /^\s{0,3}```(.*)$/.exec(line);
        if (!f) { if (open) body.push(line); continue; }
        if (!open) { open = true; lang = f[1].trim() || "(none)"; body = []; continue; }
        open = false;
        R.fences++;
        const lines = body.filter((l) => l.trim() !== "").length;
        if (lines < MIN_LINES) {
          R.shortFenceLangs[lang] = (R.shortFenceLangs[lang] || 0) + 1;
          if (lines <= 2) R.shortFenceLines[String(lines) === "0" ? "1" : String(lines)]++;
          continue;
        }
        R.qualifying++; qualifyingHere++;
        R.qualifyingLangs[lang] = (R.qualifyingLangs[lang] || 0) + 1;
        const n = nameOf(lang, body.join("\n"));
        if (n) {
          namesHere.set(n, (namesHere.get(n) || 0) + 1);
          namesInThisAnswer.add(n);
          R.namesSeenAcross[n] = (R.namesSeenAcross[n] || 0) + 1;
        }
      }
      if (namesInThisAnswer.size >= 2) R.multiFileAnswers++;
    }

    if (qualifyingHere > 0) R.convsWithQualifying++;
    R.qualifyingPerConv[String(qualifyingHere)] = (R.qualifyingPerConv[String(qualifyingHere)] || 0) + 1;
    for (const [, n] of namesHere) if (n > 1) { R.revisionChains++; R.blocksInChains += n; }
    if ((full.chat_messages || []).some((m) => (m.attachments || []).length)) R.convsWithAttachments++;
  }

  const pct = (a, b) => (b ? ((a / b) * 100).toFixed(1) + "%" : "n/a");
  const top = (o, n) => JSON.stringify(Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n));
  const recurring = Object.fromEntries(Object.entries(R.namesSeenAcross).filter(([, n]) => n > 1));

  // One block of plain text, so it can be pasted somewhere in one go rather
  // than expanded object by object in the console.
  const report = [
    "=== Magpie demand measurement ===",
    `conversations   ${R.scanned} scanned, ${R.failed} failed`,
    `window          ${(R.oldest || "").slice(0, 10)} .. ${(R.newest || "").slice(0, 10)}`,
    "",
    "-- the ratio DEMAND.md rests on --",
    `fences                    ${R.fences}`,
    `qualifying (>=${MIN_LINES} lines)   ${R.qualifying}   ${pct(R.qualifying, R.fences)} of fences`,
    `conversations with any    ${R.convsWithQualifying}/${R.scanned}   ${pct(R.convsWithQualifying, R.scanned)}`,
    `per-conversation spread   ${JSON.stringify(R.qualifyingPerConv)}`,
    "",
    "-- H1: are the short fences the copy-me kind? --",
    `one- and two-line fences  ${JSON.stringify(R.shortFenceLines)}`,
    `short-fence languages     ${top(R.shortFenceLangs, 8)}`,
    `qualifying languages      ${top(R.qualifyingLangs, 8)}`,
    "",
    "-- candidate D: are there revision chains? --",
    `chains (same name twice+) ${R.revisionChains}, covering ${R.blocksInChains} blocks   ${pct(R.blocksInChains, R.qualifying)} of qualifying`,
    `answers emitting 2+ files ${R.multiFileAnswers}`,
    `names recurring across    ${top(recurring, 8)}`,
    "",
    "-- candidates E and F --",
    `truncated messages        ${R.truncatedMessages}`,
    `attachments               ${R.attachments} across ${R.convsWithAttachments} conversations`,
    `produced files            ${R.producedFiles}`,
    `conversations in projects ${R.convsInProject}`,
  ].join("\n");

  console.log("\n" + report);

  // copy() is a DevTools console helper, not a page API — absent when this
  // file is required from Node, so it is attempted rather than assumed.
  try {
    if (typeof copy === "function") { copy(report); console.log("\n✓ copied to the clipboard"); }
    else console.log("\nSelect the block above and copy it.");
  } catch { console.log("\nSelect the block above and copy it."); }

  console.log("It contains no conversation content — counts, languages and derived names only.");
  return R;
}

if (typeof module !== "undefined") module.exports = { magpieMeasure };
