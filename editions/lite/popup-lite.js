import { DEFAULTS } from './shared-defaults.js';

const depth = document.querySelector('#depth');
const answerStyle = document.querySelector('#answerStyle');
const styleHint = document.querySelector('#styleHint');
const status = document.querySelector('#status');
const styleHints = {
  balanced: 'Коротко и по делу',
  study: 'Объяснение как от спокойного наставника',
  code: 'Точная помощь с кодом и ошибками',
  translate: 'Перевод на русский с сохранением смысла'
};

(async () => {
  const settings = { ...DEFAULTS, ...await chrome.storage.local.get(DEFAULTS) };
  depth.value = settings.depth || 'smart';
  answerStyle.value = settings.answerStyle || 'balanced';
  updateHint();
  const result = await chrome.runtime.sendMessage({ type: 'AIHINT_GET_STATUS' });
  status.textContent = result?.state === 'available'
    ? 'Локальный AI готов. Запросы остаются на устройстве.'
    : result?.state === 'downloading' ? 'Chrome готовит локальную модель…' : 'Локальный AI проверяется при первом запросе.';
})();

depth.addEventListener('change', () => chrome.storage.local.set({ depth: depth.value }));
answerStyle.addEventListener('change', async () => {
  await chrome.storage.local.set({ answerStyle: answerStyle.value });
  updateHint();
});
document.querySelector('#settings').addEventListener('click', () => chrome.runtime.openOptionsPage());
document.querySelector('#game').addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('game.html') }));
document.querySelector('#test').addEventListener('click', async () => {
  status.textContent = 'Проверяю…';
  try {
    const tab = (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    await chrome.tabs.sendMessage(tab.id, { type: 'AIHINT_CAPTURE', requestId: crypto.randomUUID() });
    status.textContent = 'Выдели текст и нажми Ctrl+Shift+Space.';
  } catch {
    status.textContent = 'На этой странице AI Hint Lite запустить нельзя.';
  }
});

function updateHint() { styleHint.textContent = styleHints[answerStyle.value] || styleHints.balanced; }
