# What to build next, and the number that reframes it

This document exists because the step 5 verification produced a ratio nobody was looking for, and it undercuts part of the roadmap. It is written before the next version is scoped, so the scoping argues with the data rather than around it.

**Read `tools/measure-demand.js` alongside this.** Every claim below marked *measured* comes out of it; every claim marked *hypothesis* is a guess with a way to refute it. The sample is one account, so the instrument matters more than the numbers.

---

## 1. The number

*Measured, n = 25 conversations, one account, 2026-09-09.*

| | |
|---|---|
| Code fences | ~360 |
| Fenced blocks reaching `MIN_CODE_LINES` (3 non-empty lines) | **~14** |
| Conversations containing at least one | **5 of 25** |
| Artifacts | 0 |

So roughly **4%** of fences are worth a download control, and four conversations out of five contain nothing to download at all.

The step 1 note called 360 fences "the most consequential product finding here" and used it to put code blocks ahead of artifacts. That ordering still holds — 14 beats 0. But 360 was measuring typing, not deliverables, and the corrected number changes what the *next* versions should be.

## 2. What it undercuts

**v1.1 is scoped for a volume that does not exist in this corpus.** Multi-select, a bulk bar, `All → zip`, and the filter box that appears past ten items are all answers to a long list. The measured list is zero to four items, and it is zero four times out of five. §8.6 item 12 says "a forty-block conversation is unusable without a filter"; no such conversation appeared.

That is not an argument to cut v1.1 — a heavy code user's numbers will differ, and the features are cheap once the extraction exists. It is an argument that **v1.1 is not where the next big value is**, and shipping it first would be building for a distribution we have not observed.

**It also implies a retention problem.** A product whose core action fires once every five conversations is not a product someone opens. Download is a rare event. If Magpie's value equals its download count, the value is small.

## 3. What the same number reveals

The 96% did not vanish. Those ~346 short fences are commands, config lines, one-liners, snippets — the things people **copy**, not download.

So the two actions have inverted frequencies from the ones the interface assumes:

| Action | Measured frequency | Where v1 puts it |
|---|---|---|
| Copy a short snippet | constant | a hover-revealed button in the popup |
| Download a file | ~0.6 per conversation | the floating control, the keyboard shortcut, the badge |

**Hypothesis H1:** copy is the high-frequency action and deserves the fastest path in the product. Refutable: `measure-demand.js` reports the language and length distribution of sub-threshold fences. If they are overwhelmingly shell, SQL and config one-liners, H1 stands.

## 4. The bigger consequence — 346 snippets you will never find again

The corpus contains hundreds of small, useful outputs. Exactly one path exists to any of them: remember which conversation, open it, scroll. There is no search over your own code across conversations, and the provider does not offer one worth the name.

This is the pain that recurs weekly rather than monthly: *"I asked for that ffmpeg invocation last month."*

A downloader ignores it entirely. And it is precisely the thing this architecture is already positioned to do — the API tier is confirmed, `chat_conversations` lists everything, `updated_at` allows incremental work, and none of it needs a model call, a key or a server. It passes the admission test in `docs/ROADMAP.md` unchanged.

It is also the natural end of the line the roadmap already draws. v1.2's note says the memory version "changes what the product is for: not downloading, but knowing what you already took." Search is the same sentence one step further: **knowing what you already have.**

## 5. Ranked candidates

Scored on: does the corpus say people hit this, does it fit the architecture without new dependencies, and how much does it change what the product is worth.

### A. Search across your own conversations — **the big one**

A local, opt-in index over the user's own conversations: every fenced block, its language, its conversation and message, its date. Lexical search, no embeddings, no model call. Results open the conversation at the message, copy the block, or download it.

- **Need:** *measured* — 346 unreachable snippets in 25 conversations
- **Fit:** API tier already confirmed; index in IndexedDB; incremental by `updated_at`
- **Changes:** the product stops being an event (download) and becomes a place (your output, searchable)

**The cost that must be designed, not discovered.** An index is a large local copy of private conversations. The privacy line — *"data stays on your device"* — stays literally true, but the store listing and §19.6 have to say plainly that an opt-in index exists, what it holds, and that deleting it is one click. A permission story that was easy to defend gets harder, and pretending otherwise would be the dishonest version of this feature.

Also real: building the index is N API calls against the user's own session. Rate limiting, backoff, and resumability are part of the feature, not polish.

### B. Provenance — a file that still means something in six months

Every downloaded file carries, in a way that survives the filesystem, where it came from: the conversation, the message, the date, and optionally the request that produced it. A comment header for code, a sidecar for everything else, opt-in.

- **Need:** *inferred* — with ~0.6 downloads per conversation, the Downloads folder fills slowly with files that have no context and names derived from a heuristic
- **Fit:** trivial; the conversation and message UUIDs are already in hand, and a deep link back is a URL
- **Changes:** it is what makes A worth having later, and it is a fraction of the work

This is the cheapest large win on the list and it should probably ship before A.

### C. Copy, promoted to the primary action

If H1 holds: a keystroke that copies the most recent code block without opening anything, copy as the default action on the floating control, and copy-with-context (name, language, fence) one modifier away.

- **Need:** *hypothesis H1*, refutable by the instrument
- **Fit:** the extraction already exists; this is interface, not machinery
- **Changes:** moves the product from "used occasionally" to "used constantly"

### D. Revision chains — the same file, emitted five times

Within a conversation, group blocks that are successive versions of one file rather than listing them as `code-1`, `code-3`, `code-6`. This is the op-log insight (§3) applied where the volume actually is, and it would give code blocks a version menu without waiting for v2.0's adapters.

- **Need:** **unmeasured, and possibly small.** With ~14 qualifying blocks across 25 conversations, chains may be rare. `measure-demand.js` counts them directly. Do not schedule this before that number exists.
- **Fit:** pure `parse.js`; grouping by derived name and content similarity

### E. Truncation honesty

`truncated` exists on every message (*measured*, step 1). A truncated message means an incomplete code block, and downloading it hands over a broken file with a confident name. `fmtName` already supports a `-partial` suffix; nothing currently sets it from the server's own flag.

- **Need:** correctness, not value. Small, and it prevents the worst failure this product has: a silently wrong file.
- **Fit:** one field, one flag, one suffix

### F. Your own uploaded files, back out

`attachments[]` carries `file_size` and `extracted_content` (*measured*). Getting back a file you uploaded months ago and no longer have locally.

- **Need:** *unmeasured* — the instrument counts attachments per conversation
- **Fit:** already in v2.1's territory; no new dependency

## 6. What this does to the roadmap

Nothing is deleted. The order changes, and one version gets a new occupant:

- **v1.1** stops being "bulk and placement" as the next release. Bulk answers a distribution not observed; it moves behind the items that answer a measured one.
- **B (provenance)** and **E (truncation)** are small, and both make every later version better. They are the natural v1.1.
- **C (copy first)** joins them if H1 survives the instrument.
- **A (search)** becomes the flagship of v1.2, replacing "download history" as the headline — history is a subset of it, and an index that knows every block also knows which ones you took.
- **D** waits for its number.

Under `docs/VERSIONING.md` all of these are **minor**: none adds a dependency outside our control. A is a minor that changes what the product is, which is exactly the case that document's major/minor axis was built to get right — the risk surface does not grow, so the digit does not.

## 7. The honest caveat

**n = 1 account.** These conversations skew toward analysis, marketing and configuration rather than sustained software work. An engineer using Claude for eight hours a day would plausibly invert the 4%, and every ranking above with it.

That is why `tools/measure-demand.js` exists and why it prints counts rather than conclusions. Before any of this is scheduled, run it on a second and third account. If the qualifying-block rate comes back at 40% instead of 4%, v1.1 was right and this document is wrong — and it will have been wrong in a way that took one console run to find out.
