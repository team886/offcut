# Monthly smoke test

There is no telemetry (design §17.2), so monitoring has to be scheduled and manual. Once a month, and before every release.

**Coverage:** every adapter-backed provider, plus **three registry providers at random**, plus any provider whose `LAST_VERIFIED` is older than 90 days. The sample is recorded below so that the randomness actually rotates rather than landing on the same three each time.

## Checklist (per provider, ~3 minutes)

- [ ] Hovering a code block shows the control, and it displays the filename it will produce
- [ ] Clicking downloads a file with the right name and extension
- [ ] Console is clean — no errors, no warnings
- [ ] Popup opens and items appear in the correct groups
- [ ] Adapter-backed only: version menu opens and line differences are shown
- [ ] Diagnostics reports `chatRoot: selector`. If it says `heuristic`, the registry row wants updating — planned, not urgent

## Log

| Date | Provider | Result | Note |
|---|---|---|---|
| — | — | — | Not run yet (no code) |
