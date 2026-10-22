# Troubleshooting

## The shortcut does nothing

- Select text on an ordinary webpage first, then use `Ctrl+Shift+Space`.
- Chrome blocks extensions on `chrome://` pages, the Chrome Web Store, and some protected pages.
- Open `chrome://extensions/shortcuts` and assign AI Hint another shortcut if Chrome reports a conflict.
- Or right-click selected text and choose **AI Hint — спросить о выделенном**.

## Lite says Chrome AI is unavailable

- Lite requires Chrome 138 or newer and a supported device and language/model configuration.
- Open AI Hint settings and press **Проверить**. Chrome may need time and disk space to download its local model.
- If Lite remains unavailable, the extension will not switch to a cloud provider. Standard edition's Pro mode is a separate opt-in path and requires your own provider key.

## Pro cannot connect

- Confirm the key and model for the selected provider in settings.
- Press **Разрешить API** for that provider. The extension requests access only to the chosen provider's domain.
- Check the provider account, model access, quota, and key status with that provider.

## The answer bubble closes too soon

Open settings and choose 6, 10, or 15 seconds. You can also disable the follow-up buttons to make the bubble more compact.

## The selected text is over the request limit

Open settings and lower or raise **Максимум текста за запрос**. Standard mode uses this limit to help control provider usage. Lite uses it to keep local prompts manageable. Page summaries read only the same configured number of characters from the main page content.

## The extension package seems incomplete

Load the extracted edition folder that contains `manifest.json`; do not select the ZIP itself or the repository's `editions/lite` source folder. For a downloadable package, use the newest GitHub Release asset for the matching edition and version.
