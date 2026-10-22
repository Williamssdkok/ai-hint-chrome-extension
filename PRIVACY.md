# AI Hint Privacy Policy

**Last updated: October 23, 2026**

AI Hint is a Chrome extension that answers questions about text you choose to select. It does not include analytics, advertising, or telemetry.

## Information AI Hint handles

- **Selected text, page summaries, and follow-up prompts.** The extension reads selected text only after you invoke AI Hint. If you choose “Кратко о странице”, it reads up to the text limit you configure from the page's main content. It also uses the selection and the answer already shown when you request a follow-up.
- **API keys and preferences.** If you enable Pro, the API key you enter, provider/model choice, response settings, and related preferences are saved in Chrome extension-local storage on your device.
- **Answer history.** The most recent 40 prompts and answers are saved locally in Chrome extension storage. You can search, copy, delete individual items, or clear the history page.
- **Game score.** The offline arithmetic game saves its high score in Chrome extension-local storage.

## How information is processed

- **Lite:** selected text and follow-up prompts are passed to Chrome's built-in on-device AI when it is available. AI Hint does not send these prompts to an AI provider in Lite mode.
- **Pro:** selected text and follow-up prompts are sent directly from the extension to the AI provider you select (OpenAI, Google Gemini, Anthropic, DeepSeek, or Yandex AI Studio) so it can generate a response. Each provider processes information under its own terms and privacy policy. Review the selected provider's terms before using Pro, and do not submit sensitive information unless you are comfortable sharing it with that provider.
- **Local storage:** settings, Pro API keys, answer history, and the game high score remain in Chrome's extension-local storage. They are not synced by AI Hint. Removing the extension or clearing its data removes this locally stored information.

AI Hint does not receive prompts or answers on a developer-operated server. Its local history is visible only in your browser profile. It does not sell user information, use it for advertising, or allow the developer to read it. Chrome and the selected AI provider may process information according to their own terms.

## Data sharing and retention

AI Hint shares selected text, page text for a requested summary, and follow-up prompts only with the selected AI provider when you use Pro. Provider-side retention, use, and deletion are governed by that provider's policies and account settings. Lite uses Chrome's on-device model. The extension maintains a bounded local history but no remote user database.

## Permissions

AI Hint uses active-tab access and scripting to read the text selection after you invoke the feature, extension storage for settings and scores, commands for the keyboard shortcut, and context menus for the right-click action. Optional network permissions are requested only for the provider you choose in Pro.

## Contact and changes

For privacy questions or requests, open a GitHub issue in the [AI Hint repository](https://github.com/Williamssdkok/ai-hint-chrome-extension/issues). This policy will be updated if the extension's data practices change.
