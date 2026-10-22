# AI Hint — Chrome Extension v2.2.0 Beta

Current package version: **2.2.0**.

AI Hint is a tiny browser assistant: select a small fragment, press **Ctrl+Shift+Space**, get a short answer, continue working.

## Lite — free first

Lite is designed to be the main product, not a demo. It uses Chrome's built-in on-device Prompt API / Gemini Nano when the user's Chrome and hardware support it. No API key and no AI cloud request are needed for Lite. The first supported use may download the local model once; later requests reuse the local model.

Before invoking the LLM, AI Hint has a zero-latency deterministic engine for arithmetic/equality/square-root micro-queries.

## Pro

Pro can call a provider with the user's own API key:
- OpenAI
- Google Gemini
- Claude
- DeepSeek
- Yandex AI Studio (OpenAI-compatible endpoint)

Keys stay inside extension storage and are only read by the service worker. They are never passed to the webpage content script.

## UX

- tiny glass bubble near the selection
- adaptive size
- Lite = light glass
- Pro = dark glass
- streaming local answers
- auto-close
- Quick / Smart / Deep
- Why? / Example / Simpler follow-ups
- right-click selection menu
- no giant chat window
- built-in offline math sprint with a local high score

## Game

Open the extension popup and choose **Играть · Математический блиц**. Solve as many multiple-choice arithmetic questions as possible in 60 seconds. The game works offline and stores the best score in extension-local storage.

## Install locally

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder (the folder that directly contains `manifest.json`).
5. Pin AI Hint.
6. Select text on a normal web page and press **Ctrl+Shift+Space**.

If Chrome reports that the shortcut is unavailable, open `chrome://extensions/shortcuts` and assign another shortcut. Chrome can also leave a shortcut unassigned if another extension already owns it.

## Chrome AI

Prompt API support is device/browser dependent. Open the extension settings and check Lite status. The extension does not pretend that every PC supports local Gemini Nano.

## Privacy

Lite: selected text is sent to Chrome's local built-in model when available. Pro: selected text is sent to the provider selected by the user. AI Hint has no telemetry or analytics code in this beta.

## v2.1.1 changes

- Lite now runs the on-device model at lower temperature (Chrome Extensions can tune `temperature`/`topK` via `LanguageModel.params()`), which makes short factual/math/code answers more consistent instead of varying between clicks.
- Follow-ups (Почему? / Пример / Проще) now receive the answer that was actually shown, so they stay consistent with it instead of re-deriving an answer from scratch.
- The Lite session is rebuilt automatically when depth (Quick/Smart/Deep) or mode changes, or when Chrome reports a context overflow, instead of silently keeping stale behavior.
- The auto-close delay set in Settings (6/10/15s) is now actually applied to the bubble; before, the bubble always used a hardcoded 10s regardless of the setting.
- **Esc** now closes the bubble and cancels the in-flight request.
- **Ctrl+Shift+Space** now also works as a page-level fallback: if Chrome hasn't bound the shortcut (see `chrome://extensions/shortcuts`) or it conflicts with something else, AI Hint still triggers on that key combo while the page has focus.

## v2.1.2 changes

- The “Why? / Example / Simpler” follow-up buttons now respect the Settings checkbox.
- The instant calculator now handles unary minus correctly, including expressions such as `2 * -3`.

## v2.2.0 changes

- Added a built-in offline 60-second arithmetic game, opened from the extension popup.
- The game includes four-choice answers, keyboard controls, streak bonuses, and a locally saved high score.

