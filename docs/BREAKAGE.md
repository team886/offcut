# Breakage runbook

Symptom → diagnosis → fix. The first thing to ask a user for is the **diagnostics block** (popup → "Copy diagnostics"); the tables below are written to line up with what that block prints.

## General — any provider

| Symptom | In diagnostics | Diagnosis | Fix |
|---|---|---|---|
| No button appears at all | `SEL: chatRoot ✗` while the page has code blocks | Even the heuristic root failed; page structure differs from expectation | Run `tools/discover.js`, read its `chatRoot` output, add an explicit `chatRoot` to the registry row |
| Button appears, clicking does nothing | `Last error:` populated | Core failure | Take the first line of the error into an issue; check whether `selftest.js` covers that function |
| Button flickers in and out | — | The framework re-renders and re-injection is not working | Verify the `document.contains(btn)` check and the rAF debounce (design §7 step 2) |
| Console full of `Extension context invalidated` | — | The extension updated and the old content script is orphaned | Expected behaviour is one toast then self-teardown. If no toast appears, that path is broken |
| Downloaded file is empty or short | `Tier: 3 (DOM)` | Virtualised content was not fully collected | Check the scroll-collect path; the item should have been marked "may be incomplete" |
| Zip downloads but will not open | — | Byte versus character length confusion | Run the `selftest.js` zip tests, especially the Turkish-named and emoji-content case |
| Fails when the interface is in another language | Several `SEL: ✗` | A text-based selector was used, which is forbidden | Replace it with a structural marker; CI gate 9 should have caught this |
| Red `!` badge, popup says the interface changed | Three `SEL` entries failing together | The provider redesigned | Self-diagnosis worked. Run `discover.js`, update the registry row |

## Claude adapter

| Symptom | In diagnostics | Diagnosis | Fix |
|---|---|---|---|
| No version menu, single row "read from page" | `Tier: 3`, `Conversation request: 401` | Session could not be read | The user may be signed out; a persistent 401 means the endpoint changed |
| Same, but `404` | `Org resolution: cookie ✓`, request 404 | Wrong organisation — the user belongs to more than one | Check that the try-each-org path works (design §4) |
| A version marked partial, reason `old_str_not_found` | — | **Most likely a line-ending difference** (CRLF vs LF) | Content is never normalised. The schema may have changed; update the fixture |
| Same, reason `old_str_ambiguous` | — | `old_str` occurs more than once in the body | Expected behaviour; the user sees the partial marker |
| Menu numbers disagree with the panel's "Version N" | — | Our fold counter and Claude's have diverged | Drop the `v` label and use position plus timestamp (design §8.2) |
| Nothing parses although the API returns 200 | `Tier: 3` | The `tool_use` schema changed | Dump a fresh conversation, update `test/fixtures/claude/`, follow the failing test |
| Tier 1 and the DOM disagree noticeably | Divergence warning | Windowing, virtualisation or schema drift | The §4.1 cross-check fired; start from whichever side is shorter |

## Registry providers (no adapter)

| Symptom | Diagnosis | Fix |
|---|---|---|
| Code blocks not detected | The `pre > code` structure changed | `discover.js` → `codeBlocks.count`; if zero, add an exception for that provider in `common-dom.js` |
| Everything downloads as `.txt` | The language class convention changed | `discover.js` → `langSources`; if "none" dominates, add the new source to the precedence list |
| Names are always `kod-N` | The naming chain is not matching | Expected when the language has no regex entry. If the language is recognised, add it to the table |
| "Copy" text ends up inside the file | A UI element sits inside the code node | Add that node to the clone-stripping list in `readCodeText` (design §12.1) |

## After a fix

Update the relevant `LAST_VERIFIED` · add a fixture · `node selftest.js` green · record the result in `docs/SMOKE.md`.
