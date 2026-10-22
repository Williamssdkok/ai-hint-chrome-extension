const $ = (selector) => document.querySelector(selector);
let items = [];

async function load() {
  const data = await chrome.storage.local.get({ history: [] });
  items = Array.isArray(data.history) ? data.history : [];
  render();
}

function render() {
  const query = $('#search').value.trim().toLocaleLowerCase();
  const visible = items.filter(item => `${item.prompt} ${item.answer}`.toLocaleLowerCase().includes(query));
  $('#count').textContent = query ? `${visible.length} найдено из ${items.length}` : `${items.length} из 40`;
  const list = $('#list');
  list.replaceChildren();
  if (!visible.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = items.length ? 'Ничего не найдено. Попробуй другой запрос.' : 'История пока пуста. Ответы появятся здесь после первого запроса.';
    list.append(empty);
    return;
  }
  for (const item of visible) {
    const card = document.createElement('article'); card.className = 'item';
    const head = document.createElement('div'); head.className = 'item-head';
    const source = document.createElement('span'); source.className = 'source'; source.textContent = String(item.source || 'AI').toUpperCase();
    const createdAt = Number(item.createdAt) || Date.now();
    const date = document.createElement('time'); date.dateTime = new Date(createdAt).toISOString(); date.textContent = new Date(createdAt).toLocaleString();
    head.append(source, date);
    const prompt = document.createElement('p'); prompt.className = 'prompt'; prompt.textContent = item.prompt;
    const answer = document.createElement('p'); answer.className = 'answer'; answer.textContent = item.answer;
    const actions = document.createElement('div'); actions.className = 'item-actions';
    const copy = document.createElement('button'); copy.className = 'copy'; copy.textContent = 'Копировать';
    copy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(item.answer); copy.textContent = 'Скопировано ✓'; setTimeout(() => copy.textContent = 'Копировать', 1000); } catch { copy.textContent = 'Не удалось'; } });
    const remove = document.createElement('button'); remove.className = 'delete'; remove.textContent = 'Удалить';
    remove.addEventListener('click', async () => { items = items.filter(entry => entry.id !== item.id); await chrome.storage.local.set({ history: items }); render(); });
    actions.append(copy, remove); card.append(head, prompt, answer, actions); list.append(card);
  }
}

$('#search').addEventListener('input', render);
$('#clear').addEventListener('click', async () => { items = []; await chrome.storage.local.set({ history: [] }); render(); });
chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && changes.history) load(); });
load();
