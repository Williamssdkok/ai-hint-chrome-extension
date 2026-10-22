import { DEFAULTS } from './shared-defaults.js';

const $ = (selector) => document.querySelector(selector);
const styleDescriptions = {
  auto: 'Автоматически выбирает стиль для кода и иностранного текста.',
  balanced: 'Короткий ответ без лишнего текста.',
  study: 'Поясняет основную идею простыми словами и помогает разобраться шаг за шагом.',
  code: 'Ищет точную причину ошибки и предлагает небольшое исправление.',
  translate: 'Переводит выделенный текст на выбранный язык.',
  custom: 'Использует вашу инструкцию вместо встроенного стиля.'
};
let settings = { ...DEFAULTS };

(async () => {
  settings = { ...DEFAULTS, ...await chrome.storage.local.get(DEFAULTS) };
  $('#answerStyle').value = settings.answerStyle || 'balanced';
  $('#depth').value = settings.depth || 'smart';
  $('#autoclose').value = String(settings.autoCloseMs || 10000);
  $('#followups').checked = settings.showFollowups !== false;
  $('#historyEnabled').checked = settings.historyEnabled !== false;
  $('#customPrompt').value = settings.customPrompt || '';
  $('#customPromptWrap').hidden = settings.answerStyle !== 'custom';
  $('#responseLanguage').value = settings.responseLanguage || 'auto';
  $('#translateLanguage').value = settings.translateLanguage || 'ru';
  $('#bubbleTheme').value = settings.bubbleTheme || 'auto';
  $('#maxSelectionChars').value = String(settings.maxSelectionChars || 4000);
  updateStyleInfo();
  await check();
})();

$('#answerStyle').addEventListener('change', updateStyleInfo);
$('#save').addEventListener('click', save);
$('#check').addEventListener('click', check);

function updateStyleInfo() {
  $('#styleInfo').textContent = styleDescriptions[$('#answerStyle').value] || styleDescriptions.balanced;
  $('#customPromptWrap').hidden = $('#answerStyle').value !== 'custom';
}

async function check() {
  const result = await chrome.runtime.sendMessage({ type: 'AIHINT_GET_STATUS' });
  const labels = {
    available: 'Локальная модель Chrome доступна.',
    downloadable: 'Chrome может загрузить локальную модель при первом запросе.',
    downloading: 'Локальная модель Chrome загружается.',
    unavailable: 'На этом устройстве локальная модель Chrome пока недоступна.'
  };
  $('#status').textContent = labels[result?.state] || 'Не удалось проверить Chrome AI.';
  const commands = await chrome.commands.getAll().catch(() => []);
  const shortcut = commands.find(command => command.name === 'ask-hint')?.shortcut;
  $('#shortcutDiagnostic').textContent = shortcut ? `Горячая клавиша: ${shortcut}.` : 'Горячая клавиша не назначена — настрой её в chrome://extensions/shortcuts.';
}

async function save() {
  settings = {
    ...settings,
    answerStyle: $('#answerStyle').value,
    depth: $('#depth').value,
    autoCloseMs: Number($('#autoclose').value),
    showFollowups: $('#followups').checked,
    historyEnabled: $('#historyEnabled').checked,
    customPrompt: $('#customPrompt').value.trim().slice(0, 1000),
    responseLanguage: $('#responseLanguage').value,
    translateLanguage: $('#translateLanguage').value,
    bubbleTheme: $('#bubbleTheme').value,
    maxSelectionChars: Number($('#maxSelectionChars').value)
  };
  await chrome.storage.local.set(settings);
  $('#saved').textContent = 'Сохранено ✓';
  setTimeout(() => { $('#saved').textContent = ''; }, 1800);
}
