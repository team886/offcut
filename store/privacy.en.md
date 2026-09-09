# Privacy Policy — Magpie

**Last updated:** 2026-09-09
**Publisher:** Ömer Faruk Ceylandağ (Kata Technology)
**Contact:** team@katatechnology.co

> Publishing this policy at a public URL is required by the Chrome Web Store. This file in the repository is the source; the published version must match it.

## Short answer

Magpie collects no data and sends nothing anywhere. Everything it reads stays in your browser.

## What it accesses

Magpie runs only on supported AI chat sites, and only on **the conversation you have open**. There it sees: message text, code blocks, documents and their versions, the results of tool calls, citation lists, images, and files that were uploaded to or produced in the conversation.

The only reason it reads them is to find what can be downloaded and to turn what you choose into a file.

## What it does not send

- No requests are made to any server of ours. The extension's network activity happens only when you download something, and only to the chat site you are already signed in to.
- There is no telemetry, no analytics, no error reporting service.
- There is no account, no sign-in, no user identifier.
- There are no ad networks, trackers, or third-party code.

This is not a promise but a constraint **verified automatically on every release**: a pre-publish check confirms the source contains no address outside the permitted chat sites.

## What it stores

On your device, in browser storage:

1. **Your settings** — filename template, which item kinds are shown, which sites are enabled, save-location preference. These may sync through your browser account (that is Chrome's own sync).
2. **Download history — only if you turn it on.** It is **off by default**. When on, the following stays on your device: provider name, conversation title, item name, date, a digest (hash) of the file content, and the folder path it was saved to. **The file content itself is not stored.** This record does not sync and stays on that device only. It can be cleared from settings in one click.
3. **Folder permission** — if you use "save to a chosen folder", the browser-issued handle for that folder. Only the handle, nothing else.

None of this reaches us or anyone else.

## Cookies

Magpie sets no cookies. The chat site's own session cookies exist because you are already signed in, and the extension does not modify them.

## Children

Magpie is not directed at children and collects no age information.

## Changes

If this policy changes, the date is updated and the change is noted in the release notes (`CHANGELOG.md`). Any change that widens what is processed also ships with an explicit in-extension consent step — it is never widened silently.

## Contact

Questions, security reports, or data requests: **team@katatechnology.co**
