import { DEFAULTS, providerLabel } from './shared-defaults.js';

const modeTitle = document.querySelector('#modeTitle');
const modeStatus = document.querySelector('#modeStatus');
const modeToggle = document.querySelector('#modeToggle');
const modeCard = document.querySelector('#modeCard');
const depth = document.querySelector('#depth');
const answerStyle = document.querySelector('#answerStyle');
const styleHint = document.querySelector('#styleHint');
const status = document.querySelector('#status');

const styleHints = {
  auto: 'Код и иностранный текст определяются автоматически',
  balanced: 'Коротко и по делу',
  study: 'Объяснение как от спокойного наставника',
  code: 'Точная помощь с кодом и ошибками',
  translate: 'Перевод на выбранный язык',
  custom: 'Собственная инструкция пользователя'
};

let settings;

(async()=>{
  settings = {...DEFAULTS,...await chrome.storage.local.get(DEFAULTS)};
  depth.value = settings.depth || 'smart';
  answerStyle.value = settings.answerStyle || 'balanced';
  render();
  const r = await chrome.runtime.sendMessage({type:'AIHINT_GET_STATUS'});
  if (settings.mode === 'lite') status.textContent = r?.state === 'available' ? 'Локальный AI готов. Запросы не уходят в облако.' : r?.state === 'downloading' ? 'Chrome сейчас готовит локальную модель…' : 'Lite проверяется при первом запросе.';
})();

function render(){
  const lite = settings.mode === 'lite';
  modeCard.classList.toggle('pro', !lite);
  modeTitle.textContent = lite ? 'AI HINT' : 'AI HINT PRO';
  modeStatus.textContent = lite ? 'ЛОКАЛЬНО · Chrome AI' : `${label(settings.provider)} · API`;
  modeToggle.textContent = lite ? 'PRO' : 'AI HINT';
  modeToggle.setAttribute('aria-label', lite ? 'Переключить на AI Hint Pro' : 'Переключить на локальный AI Hint');
  document.querySelector('#test span:nth-child(2)').textContent = lite ? 'Спросить AI Hint' : 'Спросить AI Hint Pro';
  styleHint.textContent = styleHints[answerStyle.value] || styleHints.balanced;
}

depth.addEventListener('change', async()=>{ settings.depth=depth.value; await chrome.storage.local.set({depth:settings.depth}); });
answerStyle.addEventListener('change', async()=>{ settings.answerStyle=answerStyle.value; await chrome.storage.local.set({answerStyle:settings.answerStyle}); render(); });
modeToggle.addEventListener('click', async()=>{ settings.mode=settings.mode==='lite'?'pro':'lite'; await chrome.storage.local.set({mode:settings.mode}); render(); status.textContent=settings.mode==='lite'?'Lite включён — локально.':'Pro включён — использует твой API-ключ.'; });
document.querySelector('#settings').addEventListener('click',()=>chrome.runtime.openOptionsPage());
document.querySelector('#history').addEventListener('click',()=>chrome.tabs.create({url:chrome.runtime.getURL('history.html')}));
document.querySelector('#game').addEventListener('click',()=>chrome.tabs.create({url:chrome.runtime.getURL('game.html')}));
document.querySelector('#summarizePage').addEventListener('click',async()=>{
  status.textContent='Читаю страницу…';
  try{
    const tab=(await chrome.tabs.query({active:true,currentWindow:true}))[0];
    if(!tab?.id) throw new Error('no tab');
    await chrome.scripting.executeScript({target:{tabId:tab.id},files:['content.js']});
    const limits=await chrome.storage.local.get({maxSelectionChars:4000});
    await chrome.tabs.sendMessage(tab.id,{type:'AIHINT_SUMMARIZE_PAGE_CAPTURE',requestId:crypto.randomUUID(),maxChars:limits.maxSelectionChars});
    status.textContent='Готовлю краткий пересказ…';
  }catch{status.textContent='На этой странице чтение недоступно.';}
});
document.querySelector('#test').addEventListener('click',async()=>{
  status.textContent='Проверяю…';
  try{
    const tab=(await chrome.tabs.query({active:true,currentWindow:true}))[0];
    await chrome.scripting.executeScript({target:{tabId:tab.id},files:['content.js']});
    await chrome.tabs.sendMessage(tab.id,{type:'AIHINT_CAPTURE',requestId:crypto.randomUUID()});
    status.textContent='Выдели любой текст на странице и нажми Ctrl+Shift+Space.';
  }catch(e){status.textContent='На этой странице тест невозможен.';}
});
const label = providerLabel;
