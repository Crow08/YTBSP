# YouTube Better Start Page (YTBSP)

A Tampermonkey/Greasemonkey userscript that replaces YouTube's start page with an organized grid of **all your subscriptions** — every channel with its latest uploads, at a glance.

## Features

- **Subscription grid** — the YouTube start page becomes a list of all your subscribed channels, each with a row of its most recent videos.
- **Filtering** — hide Shorts (per channel), hide empty channels, hide videos older than a configurable number of days.
- **Native toggle** — switch between the YTBSP view and YouTube's native start page at any time via the fixed top bar.
- **Seen/unseen tracking** — videos are automatically marked as seen after watching (configurable delay); optionally hide seen videos.
- **Peek player** — hover-enlarge thumbnails and a built-in picture-in-picture style mini player with configurable quality.
- **Dark/light theme** — follows YouTube's theme.
- **Local-only storage** — all data (video cache, seen state, settings) lives in your browser's `localStorage`. No external servers, no accounts, no tracking.

## Installation

1. Install a userscript manager, e.g. [Tampermonkey](https://www.tampermonkey.net/) (Chrome, Edge, Firefox) or Greasemonkey (Firefox).
2. Install the script by opening this link — your userscript manager will pick it up:

   **[Install ytbsp.user.js](https://raw.githubusercontent.com/Crow08/YTBSP/master/dist/ytbsp.user.js)**

3. Open [youtube.com](https://www.youtube.com) while logged in to your Google account. The start page is replaced by the YTBSP subscription grid.

Updates are delivered automatically through the userscript manager via the script's `@updateURL`.

> **Note:** You must be logged in to YouTube — the script reads your subscription list through YouTube's internal API using your existing session. Nothing is sent anywhere else.

## Configuration

Open the settings via the gear icon in the YTBSP bar. Notable options (defaults in parentheses):

| Option | Description |
| --- | --- |
| Videos per row / per channel | Grid density (9 per row, 36 per channel) |
| Time to mark as seen | Seconds of watching before a video counts as seen (10 s) |
| Hide seen videos | Hide videos you have already watched (off) |
| Hide empty channels | Hide channels with no videos to show (on) |
| Hide older videos | Drop videos older than the decompose time (off, 30 days) |
| Hide Shorts | Filter Shorts, configurable per channel |
| Player quality | Preferred quality for the built-in player (1080p) |
| Enlarge on hover | Thumbnail zoom factor and delay |

## Building from source

Requirements: Node.js and npm.

```bash
npm install
npm run build     # webpack build + userscript assembly
npm run lint      # ESLint
```

The build bundles `src/index.ts` with webpack and then runs `compile-script.js`, which injects the version from `package.json` into the userscript header and assembles the final artifacts:

- `dist/ytbsp.user.js` — the complete userscript (this is what gets installed)
- `dist/ytbsp.meta.js` — header only, used for update checks

For manual testing, load `dist/ytbsp.user.js` into Tampermonkey and open youtube.com. There is no automated test suite.

### A word of caution

`ytsub.ts` and `ytpl.ts` talk to YouTube's **undocumented internal API** (InnerTube) and parse data out of YouTube's pages. When YouTube changes its response format, these break and need to be adapted. Upload dates are reverse-engineered from relative timestamps ("x days ago") and currently support English and German UI languages.

## Releasing

The `dist/` artifacts are committed on purpose: the userscript's `@downloadURL`/`@updateURL` point at raw GitHub master, so `dist/` *is* the distribution channel. To release: bump the version in `package.json`, run `npm run build`, commit including `dist/`.
