# Chrome Web Store listing and submission prep

## Draft listing

**Name:** AI Hint

**Short description:** Get a concise answer about selected text with Chrome's on-device AI or your own AI provider key.

**Detailed description:**

Select a short passage on a web page and press Ctrl+Shift+Space to get a compact answer beside the text. AI Hint also summarizes the main content of the current page when requested and keeps a searchable local history of recent answers. Choose Quick, Smart, or Deep response lengths; Ordinary, Study, Code, Translate, Auto, or custom styles; and use follow-ups such as Why, Example, Simpler, Shorter, and More detail.

Lite uses Chrome's built-in on-device AI when your browser and device support it. It needs no provider API key. Pro lets you choose OpenAI, Google Gemini, Anthropic Claude, DeepSeek, or Yandex AI Studio and use your own key. AI Hint asks for optional network access for the provider you choose. A separate offline arithmetic game is included.

AI Hint reads selected text only after you invoke it. In Lite, the text is processed by Chrome's on-device model. In Pro, the selected text and follow-up prompts go to the provider you select. Settings, keys, and game scores are stored locally in Chrome. AI Hint has no analytics or advertising. Read the [Privacy Policy](https://github.com/Williamssdkok/ai-hint-chrome-extension/blob/main/PRIVACY.md) before installing.

## AI Hint Lite edition

**Name:** AI Hint Lite

**Short description:** Get concise answers about selected text with Chrome's on-device AI. No API key or cloud AI provider.

**Privacy policy:** [AI Hint Lite Privacy Policy](https://github.com/Williamssdkok/ai-hint-chrome-extension/blob/main/editions/lite/PRIVACY.md)

Lite has no Pro switch, API-key field, provider implementation, or optional host permissions. Its privacy disclosure should state that selected text and follow-ups are processed by Chrome's on-device model; response settings and the game score remain in extension-local storage; and the extension has no analytics, advertising, or remote AI service.

## Owner checklist

- [ ] Register for a Chrome Web Store developer account and complete account verification and two-step verification.
- [ ] Confirm the store listing, single purpose, category, languages, support contact, and distribution countries.
- [ ] Host the privacy policy at a stable public URL and enter that URL in the dashboard.
- [ ] Complete the dashboard's data-use declarations accurately: selected website text is user content; Lite sends it to Chrome's on-device model; Pro sends it to the selected provider; API keys and settings are stored locally; no analytics or advertising are used.
- [ ] Provide at least one current product screenshot at 1280×800 or 640×400 (up to five). The screenshot in `assets/screenshots/popup.png` shows the previous 2.2.0 popup design, measures 605×483, and does not meet the store screenshot dimensions. Capture a full-size screenshot of the refreshed UI in Chrome before submitting.
- [ ] Review the Standard and Lite ZIPs produced by the GitHub Actions build. Submit the desired edition as its own Web Store item, with matching listing and privacy declarations.
- [ ] Review all metadata, privacy disclosures, and screenshots side by side for accuracy, then submit the listing for Google's review.

## Submission status

The repository contains the listing draft, privacy policy, local package script, and a README screenshot. The extension has **not** been submitted to the Chrome Web Store. Submission requires the owner's signed-in developer dashboard and accurate account-level declarations; Google reviews and approves the listing.

## Screenshots to capture

Capture after loading the exact ZIP edition being submitted, so the toolbar icon and edition-specific popup match the listing. Use 1280×800 or 640×400 PNG or JPEG captures at 16:10. Suggested set:

1. **Ask while reading:** a regular article with a short phrase selected and the AI Hint answer bubble visible.
2. **Choose the kind of help:** the popup showing response length and answer style.
3. **Make it yours:** the settings page showing Lite/Pro selection and behavior controls. For Lite, show only its local AI status and response controls.

Keep actual page content neutral and copyright-safe. Do not show API keys, personal data, browser error pages, or UI elements from unrelated extensions. Store screenshots must be real captures of the built extension; do not use mockups as product screenshots.
