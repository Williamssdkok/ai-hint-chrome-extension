// Single source of truth for default settings and provider metadata.
// Imported by background.js, popup.js and options.js so the three
// copies can never drift out of sync again.
export const DEFAULTS = {
  mode: 'lite',
  depth: 'smart',
  answerStyle: 'balanced',
  customPrompt: '',
  responseLanguage: 'auto',
  translateLanguage: 'ru',
  bubbleTheme: 'auto',
  historyLimit: 10,
  historyEnabled: true,
  maxSelectionChars: 4000,
  provider: 'openai',
  models: {
    openai: 'gpt-5-mini',
    gemini: 'gemini-2.5-flash',
    claude: 'claude-haiku-4-5-20251001',
    deepseek: 'deepseek-v4-flash', // deepseek-chat/-reasoner retired 2026-07-24
    yandex: 'gpt://FOLDER_ID/yandexgpt/latest'
  },
  keys: {},
  liteFallback: 'local-only',
  autoCloseMs: 10000,
  showFollowups: true
};

export const PROVIDER_ORIGINS = {
  openai: 'https://api.openai.com/*',
  gemini: 'https://generativelanguage.googleapis.com/*',
  claude: 'https://api.anthropic.com/*',
  deepseek: 'https://api.deepseek.com/*',
  yandex: 'https://ai.api.cloud.yandex.net/*'
};

export const PROVIDER_LABELS = {
  openai: 'OpenAI',
  gemini: 'Gemini',
  claude: 'Claude',
  deepseek: 'DeepSeek',
  yandex: 'Yandex'
};

export function providerLabel(provider) {
  return PROVIDER_LABELS[provider] || provider;
}
