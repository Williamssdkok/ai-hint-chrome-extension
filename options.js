import { DEFAULTS, PROVIDER_ORIGINS, providerLabel } from './shared-defaults.js';
let s;
const $=q=>document.querySelector(q);
(async()=>{s={...DEFAULTS,...await chrome.storage.local.get(DEFAULTS)};s.models={...DEFAULTS.models,...(s.models||{})};s.keys={...(s.keys||{})};render();await check();})();
$('#mode').addEventListener('click',e=>{const v=e.target.dataset.value;if(!v)return;s.mode=v;render();});
$('#provider').addEventListener('change',()=>{saveProviderFields();loadProvider();});
$('#grant').addEventListener('click',grant);
$('#save').addEventListener('click',save);
$('#check').addEventListener('click',check);
async function grant(){saveProviderFields();const origin=origins()[s.provider];try{const ok=await chrome.permissions.request({origins:[origin]});$('#permissionText').textContent=ok?'Доступ разрешён.':'Доступ не выдан.';}catch(e){$('#permissionText').textContent='Chrome не разрешил запрос.';}}
async function check(){const r=await chrome.runtime.sendMessage({type:'AIHINT_GET_STATUS'});$('#status').textContent=`${r?.state||'unknown'}${r?.available?' · локальный AI доступен':' · локальный AI сейчас недоступен'}`;}
function render(){document.querySelectorAll('#mode button').forEach(b=>b.classList.toggle('active',b.dataset.value===s.mode));$('#liteInfo').style.display=s.mode==='lite'?'block':'none';$('#proCard').style.display=s.mode==='pro'?'block':'none';$('#depth').value=s.depth||'smart';$('#autoclose').value=String(s.autoCloseMs||10000);$('#followups').checked=s.showFollowups!==false;loadProvider();}
function loadProvider(){const p=$('#provider').value=s.provider||'openai';$('#model').value=s.models[p]||'';$('#key').value=s.keys[p]||'';$('#permissionText').textContent='Сетевой доступ к '+label(p)+' выдаётся только для выбранного API.';}
function saveProviderFields(){if(!$('#provider'))return;const p=$('#provider').value;s.provider=p;s.models[p]=$('#model').value.trim();s.keys[p]=$('#key').value.trim();}
async function save(){saveProviderFields();s.depth=$('#depth').value;s.autoCloseMs=Number($('#autoclose').value);s.showFollowups=$('#followups').checked;await chrome.storage.local.set(s);$('#saved').textContent='Сохранено ✓';setTimeout(()=>$('#saved').textContent='',1800);}
function origins(){return PROVIDER_ORIGINS}
const label = providerLabel;
