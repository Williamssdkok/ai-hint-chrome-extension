import { DEFAULTS, providerLabel } from './shared-defaults.js';

const modeTitle = document.querySelector('#modeTitle');
const modeStatus = document.querySelector('#modeStatus');
const modeToggle = document.querySelector('#modeToggle');
const modeCard = document.querySelector('#modeCard');
const depth = document.querySelector('#depth');
const status = document.querySelector('#status');

let settings;

(async()=>{
  settings = {...DEFAULTS,...await chrome.storage.local.get(DEFAULTS)};
  depth.value = settings.depth || 'smart';
  render();
  const r = await chrome.runtime.sendMessage({type:'AIHINT_GET_STATUS'});
  if (settings.mode === 'lite') status.textContent = r?.state === 'available' ? 'Локальный AI готов. Запросы не уходят в облако.' : r?.state === 'downloading' ? 'Chrome сейчас готовит локальную модель…' : 'Lite проверяется при первом запросе.';
})();

function render(){
  const lite = settings.mode === 'lite';
  modeCard.classList.toggle('pro', !lite);
  modeTitle.textContent = lite ? 'AI HINT LITE' : 'AI HINT PRO';
  modeStatus.textContent = lite ? 'LOCAL · Chrome AI' : `${label(settings.provider)} · API`;
  modeToggle.textContent = lite ? 'PRO' : 'LITE';
}

depth.addEventListener('change', async()=>{ settings.depth=depth.value; await chrome.storage.local.set({depth:settings.depth}); });
modeToggle.addEventListener('click', async()=>{ settings.mode=settings.mode==='lite'?'pro':'lite'; await chrome.storage.local.set({mode:settings.mode}); render(); status.textContent=settings.mode==='lite'?'Lite включён — локально.':'Pro включён — использует твой API-ключ.'; });
document.querySelector('#settings').addEventListener('click',()=>chrome.runtime.openOptionsPage());
document.querySelector('#game').addEventListener('click',()=>chrome.tabs.create({url:chrome.runtime.getURL('game.html')}));
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
