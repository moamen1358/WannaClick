# WannaClick

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-4285F4?logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/intro/) [![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

WannaClick is a Chromium browser extension that automatically clicks any
element matching a user-specified text label on any website. It supports
configurable random delays to mimic human behavior, single-page-app
navigation, and a visible on-page status indicator.

Manifest V3, distributed as an unpacked extension. Tested on Chrome,
Edge, Brave, and Opera.

## Features

- Universal auto-clicker — works on any website
- Custom target — specify any visible text to click
- Random delay range to mimic human behavior
- On-page status indicator showing current state
- Single-page-app navigation handled (re-runs on URL changes)

## Installation

1. Download or clone this repository.
2. Open `chrome://extensions/` (or `edge://extensions/` etc.).
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the repository folder.
5. Refresh any open tabs.

## Usage

1. Click the extension icon in your toolbar.
2. Enter the text of the element you want to click.
3. Set the delay range in seconds (`Min` and `Max`).
4. Toggle the extension on. The status row turns green when active.

## Permissions

| Permission | Why it's needed |
|---|---|
| `activeTab` | Read the active tab when the popup runs |
| `scripting` | Inject the click logic into the page |
| `storage` | Save your target text and delay settings |
| `<all_urls>` | Run the auto-click content script on any site |

## License

MIT.
