import { DEFAULTS } from './shared-defaults.js';

const $ = (selector) => document.querySelector(selector);
const styleDescriptions = {
  balanced: 'Короткий ответ без лишнего текста.',
  study: 'Поясняет основную идею простыми словами и помогает разобраться шаг за шагом.',
  code: 'Ищет точную причину ошибки и предлагает небольшое исправление.',
  translate: 'Переводит выделенный текст на русский, сохраняя смысл и тон.'
};
let settings = { ...DEFAULTS };

(async () => {
  settings = { ...DEFAULTS, ...await chrome.storage.local.get(DEFAULTS) };
  $('#answerStyle').value = settings.answerStyle || 'balanced';
  $('#depth').value = settings.depth || 'smart';
  $('#autoclose').value = String(settings.autoCloseMs || 10000);
  $('#followups').checked = settings.showFollowups !== false;
  updateStyleInfo();
  await check();
})();

$('#answerStyle').addEventListener('change', updateStyleInfo);
$('#save').addEventListener('click', save);
$('#check').addEventListener('click', check);

function updateStyleInfo() {
  $('#styleInfo').textContent = styleDescriptions[$('#answerStyle').value] || styleDescriptions.balanced;
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
}

async function save() {
  settings = {
    ...settings,
    answerStyle: $('#answerStyle').value,
    depth: $('#depth').value,
    autoCloseMs: Number($('#autoclose').value),
    showFollowups: $('#followups').checked
  };
  await chrome.storage.local.set(settings);
  $('#saved').textContent = 'Сохранено ✓';
  setTimeout(() => { $('#saved').textContent = ''; }, 1800);
}
