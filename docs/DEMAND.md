# What to build next — and what the measurement corrected

This document argued for a reordering of the roadmap from a 25-conversation sample. `tools/measure-demand.js` was written to refute it. Run on 40 conversations, it confirmed the central ratio and **refuted the conclusion drawn from it**.

The refuted version is kept below rather than quietly rewritten, because the shape of the error is the useful part: a real number, read too eagerly, produced a confident recommendation to cut work that turned out to be justified.

**Measured:** 40 conversations, 2026-06-29 to 2026-09-09, one account.

---

## 1. What held

| | First sample (25) | Instrument (40) |
|---|---|---|
| Fences | ~360 | 1807 |
| Reaching `MIN_CODE_LINES` | ~14 | 85 |
| **Ratio** | **~4%** | **4.7%** |

The ratio survived a sample nearly twice the size. Fewer than one fence in twenty is a file; the rest are snippets. That is the finding, and everything below rests on it.

## 2. What was wrong

**Claim:** *"four conversations out of five contain nothing to download."*
**Measured:** 23 of 40 contain nothing — **three out of five**, not four. Overstated from a small sample.

**Claim:** *"v1.1 is scoped for a volume that does not exist in this corpus."*
**Measured: false.** The volume exists. It is *concentrated*, which is not the same thing as absent:

| Qualifying blocks | Conversations | Share of all blocks |
|---|---|---|
| 0 | 23 (57.5%) | — |
| 1–3 | 7 (17.5%) | 11.8% |
| **4 or more** | **10 (25%)** | **88.2%** |
| 7 or more | 7 (17.5%) | 74.1% |

**A quarter of conversations hold seven-eighths of the downloadable code.** Seven of forty carry seven or more blocks; one carries twelve.

That is precisely the population multi-select and `All → zip` exist for. The mistake was reasoning from the *average* conversation to the *valuable* one. Nobody reaches for a bulk control in the conversation with one block — they reach for it in the conversation with ten, and those are 17.5% of the corpus rather than the zero the first reading implied.

**v1.1 is reinstated.** The argument against it was an artifact of averaging a long-tailed distribution.

One detail inside v1.1 does not survive: §8.6 item 12 draws a filter box past ten items, and exactly **one conversation in forty** crosses that line. It is a few lines of code and it stays, but it is decoration, not the "usability condition" §8.6 calls it.

## 3. What the number pointed at, and still does

The 1722 sub-threshold fences did not disappear when the bulk argument collapsed.

**H1 is strongly supported.** Of 1722 short fences, **1697 are a single line**, and **1681 carry no language tag at all** — 93% of every fence in the corpus is an untagged one-liner. The tagged remainder is what you would expect of things people run rather than save: `bash` 14, `json` 11, `powershell` 6, `sql` 5.

Downloading fires 85 times in ten weeks. Whatever people do with the other 1722 blocks, they do it far more often, and the only mechanism for it is copy.

So the interface question stands even though the roadmap question was answered wrongly: **copy is the frequent action and download is the rare one**, and v1 gives download the floating control, the keyboard shortcut and the badge while copy is a hover-revealed button in the popup.

## 4. Where the instrument is weak

Owning this, because it changes how much the next section is worth.

**The chain measurement is much weaker than its "0" suggests.** Chains are detected by deriving a name and seeing it twice. The deriver covers py, js, go, rs and sql — but **44 of the 85 qualifying blocks (52%) carry no language tag**, so no name is derivable and they cannot participate in a chain by construction. "0 chains" therefore means *no chains among the half of blocks that could have had one*. The same limit applies to the 0 for multi-file answers.

It is still evidence — 41 nameable blocks produced no repeat at all — but it is not the clean refutation the raw number looks like. Detecting chains properly needs content similarity, not names.

## 5. The ranking, corrected

| | Candidate | Measured basis | Verdict |
|---|---|---|---|
| **A** | Search across your own conversations | 1722 unreachable snippets in ten weeks | **Flagship, unchanged** |
| **B** | Provenance — where a file came from | 85 downloads in ten weeks, each orphaned in a folder | **Cheapest large win** |
| **C** | Copy promoted to the primary action | H1 supported: 93% of fences are untagged one-liners | **Confirmed** |
| **v1.1** | Bulk, multi-select, zip, folder saving | 25% of conversations hold 88% of blocks | **Reinstated — the objection was wrong** |
| **D** | Revision chains | 0 found, but half the blocks were unnameable | **Not scheduled; needs a better instrument** |
| **E** | Truncation honesty | 1 truncated message in 40 | **Already fixed** — rare, and the fix was three lines |
| **F** | Attachments and produced files | 6 attachments / 3 conversations; **14 produced files** | Modest. Produced files outnumber uploads more than 2:1 |

Also measured: **7 of 40 conversations belong to a Project** (17.5%), which gives grouping-by-project a real basis it did not have before.

## 6. What this does to the roadmap

- **v1.1 stays where it was.** Bulk and placement answer the conversations that actually carry code. The filter box is kept as a cheap nicety rather than a headline.
- **B and E ride along with it** — both are small, and provenance makes every later version better.
- **C joins if the interface work fits**; H1 is supported and the change is interface rather than machinery.
- **A remains the flagship of v1.2**, with download history as a subset of it.
- **D waits** for an instrument that does not depend on naming.

Under `docs/VERSIONING.md` all of these are minor: none adds a dependency outside our control.

## 7. The caveat that did not go away

**Still n = 1 account**, now over 40 conversations and ten weeks rather than 25. The corpus skews toward analysis, configuration and marketing rather than sustained software work — which is exactly why the concentration finding matters: it says the software-shaped conversations exist inside this corpus as a minority, and for those users the numbers would look nothing like the average.

Run `tools/measure-demand.js` on a second account before treating the ranking as settled. It prints counts rather than conclusions, and it has now demonstrated that it will contradict this document when the document is wrong.
