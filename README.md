# AI Hint

AI Hint is a Chrome extension that helps you understand, rewrite, translate, and fix selected text directly on any webpage.

Select a fragment, press Ctrl+Shift+Space, and get a concise answer right next to the text — without leaving the page, without copy-pasting into a separate app.

AI Hint works in two modes:

- AI Hint / Local mode: uses Chrome's built-in on-device AI when available, with no API key required.
- Pro mode: sends requests to the provider you choose using your own API key. Supported providers include OpenAI, Google Gemini, Anthropic Claude, DeepSeek, and Yandex AI Studio.

The extension also includes a local offline math mini-game for quick practice.

Project website:
https://williamssdkok.github.io/ai-hint-chrome-extension/

## Why AI Hint?

Most AI tools require you to copy text into a new tab, paste it into a chat, and manage the context manually. AI Hint keeps the workflow inside the browser:

- select text on any page
- ask a question in context
- get an answer inline
- rewrite, explain, translate, or improve directly

This makes it useful for:
- reading and learning
- writing and editing
- debugging code
- translating text
- quick research
- productivity workflows
- understanding web content faster

## Features

- Explain selected text
- Summarize a section or page
- Rewrite and improve text
- Translate selected content
- Fix grammar and polish writing
- Work with code snippets
- Answer quick math questions instantly
- Use Chrome's built-in local AI
- Optional Pro mode with your own API key
- Searchable local answer history
- Pin, copy, and delete answers
- Context menu actions
- Offline mini-game
- Works in text inputs, textareas, and editable fields

## Install from source

1. Clone or download this repository.
2. Open Chrome and go to:
   chrome://extensions
3. Enable Developer mode.
4. Click Load unpacked.
5. Select the project folder containing manifest.json.
6. Pin AI Hint in your Chrome toolbar.

Shortcut:
- Ctrl+Shift+Space

If the shortcut is already in use, set a different one here:
chrome://extensions/shortcuts

## How to use

### Local mode
AI Hint can use Chrome's built-in on-device AI when available. This mode:
- requires no API key
- keeps selected text on-device
- works without cloud access

### Pro mode
Pro mode allows you to choose an AI provider and use your own API key. Supported providers:
- OpenAI
- Google Gemini
- Anthropic Claude
- DeepSeek
- Yandex AI Studio

In Pro mode, you can configure:
- answer depth
- answer style
- translation language
- custom instructions
- provider selection

## Privacy

AI Hint does not include analytics or telemetry.

The extension reads text only when you explicitly select it and trigger the feature. In local mode, selected text is processed using Chrome's built-in on-device AI when available. In Pro mode, the text is sent to the selected provider only when you choose that mode and provide your own API key.

For more details, see:
- PRIVACY.md

## Project status

Current version:
- 2.6.2

This repository contains the main extension and a separate Lite edition optimized for local-only usage.

## Development

This project is built as a dependency-free Manifest V3 Chrome extension.

It includes:
- UI pages for the popup, settings, welcome flow, game, and history
- a background service worker for request orchestration
- a content script for page interaction and inline UI
- provider integrations for multiple AI backends
- local persistent history
- CI validation for syntax and permission checks

## Repository structure

- background.js — request orchestration, provider calls, local AI handling
- content.js — page interaction, floating bubble UI, selected-text capture
- popup.html / popup.js — extension popup
- options.html / options.js — settings UI
- game.html / game.js — offline math game
- history.html / history.js — local answer history
- welcome.html / welcome.js — first-run onboarding
- manifest.json — Chrome extension manifest
- shared-defaults.js — default settings and provider metadata
- editions/lite — Lite build with reduced permissions and no cloud-provider support
- docs/ — project documentation
- assets/ and icons/ — branding and icons

## License

No license has been declared yet. All rights are reserved unless a license is added by the project owner.

## Roadmap

The project is actively evolving. Planned and recent work includes:
- clearer onboarding and product messaging
- stronger positioning for a browser-first AI assistant
- improved Pro mode flow and provider UX
- more flexible answer history tools
- more powerful custom instruction features
- better learning-focused workflows
- experiments with flashcards, summaries, and richer game modes

## Contributing

Pull requests are welcome. If you'd like to contribute:
- improve UX
- add new providers
- improve local AI handling
- enhance privacy and diagnostics
- improve accessibility
- add localization support

## Support

For questions, issues, or suggestions, open a GitHub issue in this repository.
