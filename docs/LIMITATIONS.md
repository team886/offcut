# Known limitations

These are not bugs. They are deliberate boundaries or platform constraints. Saying them up front is cheaper than learning them back as complaints.

## Downloading

**A browser download cannot be confirmed as complete.** Chrome reports neither completion nor failure for a download started with `<a download>`; knowing that requires the `downloads` permission, which we deliberately did not take. So the toast says "downloading" rather than "downloaded". Writing into a chosen folder *is* verified, and there it says "saved".

**Version history does not exist on every provider.** On Claude the artifact op-log gives a full history. Elsewhere it depends on the capability matrix, and where it is absent the version menu is not drawn at all.

**A DOM read gives only the version on screen.** If the provider's API cannot be reached there is no history, just the current file.

**Tool outputs may be truncated without an API tier.** Interfaces collapse and shorten results; without the API the item arrives marked "may be truncated".

## Saving to a folder

**The folder preference is per site.** The browser binds folder permission to the origin that requested it, so a folder chosen on Claude does not apply on ChatGPT. That is the browser's security model rather than a shortcoming on our side, but it is unexpected enough to be written down.

**Permission lapses when the browser restarts.** The handle survives, the write permission does not, so the first download asks once. Decline and it falls back to a normal download and tells you so.

## Drag and drop

**You cannot drag from the popup.** Chrome closes a popup when it loses focus, so the drag would cancel the moment it left. Something that fails every time is worse than something absent, so it is not offered. Dragging from the in-page button works.

**Drag is off on touch devices** — it collides with scrolling.

**Dragging a multi-selection produces a zip.** The browser allows one file per drag.

## Transfer

**"Continue elsewhere" is a context transfer, not a copy.** Artifacts do not arrive as artifacts, version history does not travel, and attachment contents are not carried (their names are listed). The composer is not filled automatically — sending data to another company should be the user's own action.

## Coverage

**A provider redesign can break things temporarily.** Code-block downloading keeps working through the heuristic root; adapter-backed features such as panels and versions may wait for an update.

**A provider using a closed shadow root or an iframe cannot be supported** — a content script cannot read that tree. Such a provider never enters the registry.

**For interfaces you host yourself, you grant the permission** (popup → "Also run on this site"). That is why the install-time permission list does not grow.

**Thinking blocks are excluded by default.** You can turn them on; they are off because they triple the size of an export and because carrying another model's abandoned reasoning into a new chat is actively unhelpful.

## The floating control is positioned physically, not logically (v1)

`positionControl` pins the control with `style.right`, computed from the code block's `getBoundingClientRect().right`. §8.7 asks for logical properties so the interface follows the page's direction, and gate 12 enforces that for the injected stylesheet — but it only reads `SHELL_CSS`, so a physical property set from JavaScript passes it.

In a right-to-left page the block's *inline start* is its right edge, so the control would sit over the beginning of the code rather than after it.

**Not fixed blind.** Correcting it means reworking the rect arithmetic against `direction`, and there is no RTL provider page measured yet to check the result against — a change that cannot be verified is as likely to make this worse as better. §12's verification step (switch a provider's interface to another language and retry the whole flow) is where this gets settled, and it is on the pre-release list.

Until then: the control may overlap the start of a code block on an RTL page. Everything else about the flow works, because the shadow host inherits `direction` from the page.

## `readCodeTextComplete` runs at delivery, not at scan (v1)

Completeness is proved for the one block being downloaded or copied, at the moment it is taken — not for every block on every rescan. Counting blocks needs one cheap read; handing one over needs the proof.

The consequence is that the floating control's filename preview cannot know whether the block is complete, because that is only established after the read. When a read comes back incomplete the file is saved with `-partial` and a toast says so, which means the preview and the delivered name differ in exactly that case. The alternative — scrolling every block on the page on every DOM mutation — was worse.

## Offcut runs on conversation pages, not on every page of a provider

A registry row matches a **host**; the manifest injects on specific **paths**. On claude.ai that is `/chat/*` and `/project/*`, and nothing else. A published artifact at `/code/artifact/<id>`, the `/recents` listing and the settings screens have no content script in them at all.

This surfaced as a bug in the popup rather than in the extension: a supported host with no answer was reported as "not running on this tab — reload the page", which on an artifact page would have sent the user round the same loop forever. The popup now reads `content_scripts` out of its own manifest and matches the tab's URL against it, so its answer cannot drift from what Chrome actually injects.

**Should artifact pages be included?** Not in v1, and not only because of scope. A published artifact usually *renders* — an HTML page displays as a page, a React component as a component — so there is frequently no `pre > code` on it to read. Making it work means reading the artifact's source rather than its output, which is the v2.0 document work (`docs/ROADMAP.md`) and needs the adapter and API tiers that version introduces. Adding the path now would move the confusing message rather than remove it.
