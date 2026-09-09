# Design screens

Open the `.html` files directly in a browser. They are self-contained — no build, no server.

## Current

| File | Shows |
|---|---|
| `current.html` | **The current design.** Palette, mark, English interface, the popup item list, the in-page control and the version menu. Supersedes the annotated screens below wherever they disagree |
| `logo-magpie.html` | The three logo candidates at 128 / 48 / **real 16px** on light and dark toolbar strips, and why the third won (§8.5) |

## Historical

These recorded a decision at the time it was made. They are kept because the specification references the reasoning, but they predate the rename and the palette change — they still show the old coral accent, the old mark, and a Turkish interface. **Where they disagree with `current.html`, `current.html` is right.**

| File | Decision it recorded |
|---|---|
| `download-button.html` | Split button versus popover versus a persistent version strip (§8.1) |
| `logo.html` | The first mark, before the rename (§8.5, eliminated direction) |
| `pulse-toast.html` | Pill placement and the toast variants (§8.3, §8.4) |
| `settings.html` | The first settings panel, before the item list replaced the single "current item" card |
| `multi-provider.html` | The capability matrix and the floating code control, when scope grew to four providers (§3.4.5) |
| `ui-v2.html` | Version diffs, filtering, multi-select, progress (§8.2, §8.6) |
| `ui-final.html` | The registry model made visible in settings (§3.4) |
| `tool-outputs.html` | Tool outputs as an item kind, and how much the interface truncates them (§2.1.3) |

## Why these are in the repository

The specification points at them and they are the visual evidence for its decisions. Left in a temporary directory, the spec loses its own references (§18).
