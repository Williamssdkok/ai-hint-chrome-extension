const lite = new URLSearchParams(location.search).get('edition') === 'lite';
document.querySelector('#edition').textContent = lite ? 'LITE' : 'STANDARD';
if (!lite) {
  document.querySelector('#editionTip').textContent = 'Lite работает локально без ключа. В Pro можно выбрать облачного провайдера и добавить собственный API-ключ в настройках.';
}
const privacy = document.querySelector('#privacy');
privacy.href = lite
  ? 'https://github.com/Williamssdkok/ai-hint-chrome-extension/blob/main/editions/lite/PRIVACY.md'
  : 'https://github.com/Williamssdkok/ai-hint-chrome-extension/blob/main/PRIVACY.md';
privacy.target = '_blank';
privacy.rel = 'noreferrer';
document.querySelector('#settings').addEventListener('click', () => chrome.runtime.openOptionsPage());
document.querySelector('#start').addEventListener('click', () => window.close());
