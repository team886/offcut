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
