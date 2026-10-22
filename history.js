const $ = selector => document.querySelector(selector);
let items = [];

async function load() {
  const data = await chrome.storage.local.get({ history: [] });
  items = (Array.isArray(data.history) ? data.history : []).map(item => ({
    id: String(item.id || ''), prompt: String(item.prompt || ''), answer: String(item.answer || ''),
    source: String(item.source || 'local'), mode: item.mode === 'pro' ? 'pro' : 'lite',
    style: String(item.style || 'balanced'), pinned: item.pinned === true, createdAt: Number(item.createdAt) || Date.now()
  })).sort((a, b) => b.createdAt - a.createdAt);
  render();
}

function short(text, length = 190) {
  return text.length > length ? `${text.slice(0, length).trimEnd()}…` : text;
}

async function save() {
  await chrome.storage.local.set({ history: items });
}

async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const field = document.createElement('textarea');
    field.value = value;
    field.setAttribute('readonly', '');
    field.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
    document.body.append(field);
    field.select();
    let copied = false;
    try { copied = document.execCommand('copy'); } catch {}
    field.remove();
    return copied;
  }
}

function render() {
  const query = $('#search').value.trim().toLocaleLowerCase();
  const visible = items.filter(item => `${item.prompt} ${item.answer}`.toLocaleLowerCase().includes(query));
  const pinnedCount = items.filter(item => item.pinned).length;
  const regularCount = items.length - pinnedCount;
  $('#count').textContent = `${regularCount} из 10 обычных · ${pinnedCount} закреплено${query ? ` · найдено ${visible.length}` : ''}`;
  const list = $('#list');
  list.replaceChildren();
  if (!visible.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = items.length ? 'Ничего не найдено. Попробуй другой запрос.' : 'Здесь появятся ваши последние ответы.';
    list.append(empty);
    return;
  }

  for (const item of visible) {
    const card = document.createElement('article'); card.className = 'item';
    const head = document.createElement('div'); head.className = 'item-head';
    const mode = document.createElement('span'); mode.className = 'tag'; mode.textContent = item.mode === 'pro' ? 'PRO' : 'LITE';
    const style = document.createElement('span'); style.className = 'tag style'; style.textContent = item.style;
    const dateValue = new Date(item.createdAt);
    const date = document.createElement('time'); date.dateTime = dateValue.toISOString(); date.textContent = dateValue.toLocaleString();
    head.append(mode, style, date);

    const promptLabel = document.createElement('span'); promptLabel.className = 'field-label'; promptLabel.textContent = 'ТВОЙ ТЕКСТ';
    const prompt = document.createElement('p'); prompt.className = 'prompt'; prompt.textContent = short(item.prompt);
    const answerLabel = document.createElement('span'); answerLabel.className = 'field-label'; answerLabel.textContent = 'ОТВЕТ AI HINT';
    const answer = document.createElement('p'); answer.className = 'answer'; answer.textContent = short(item.answer);

    const actions = document.createElement('div'); actions.className = 'item-actions';
    const copyAnswer = document.createElement('button'); copyAnswer.textContent = 'Копировать ответ';
    copyAnswer.addEventListener('click', async () => showCopyResult(copyAnswer, await copyText(item.answer)));
    const copyPrompt = document.createElement('button'); copyPrompt.textContent = 'Копировать исходный';
    copyPrompt.addEventListener('click', async () => showCopyResult(copyPrompt, await copyText(item.prompt)));
    const expand = document.createElement('button'); expand.textContent = 'Показать полностью';
    let expanded = false;
    expand.addEventListener('click', () => {
      expanded = !expanded;
      prompt.textContent = expanded ? item.prompt : short(item.prompt);
      answer.textContent = expanded ? item.answer : short(item.answer);
      expand.textContent = expanded ? 'Свернуть' : 'Показать полностью';
    });
    const pin = document.createElement('button'); pin.className = 'pin'; pin.textContent = item.pinned ? 'Открепить' : 'Закрепить';
    pin.addEventListener('click', async () => { item.pinned = !item.pinned; await save(); render(); });
    const remove = document.createElement('button'); remove.className = 'delete'; remove.textContent = 'Удалить';
    remove.addEventListener('click', async () => { items = items.filter(entry => entry.id !== item.id); await save(); render(); });
    actions.append(copyAnswer, copyPrompt, expand, pin, remove);
    card.append(head, promptLabel, prompt, answerLabel, answer, actions);
    list.append(card);
  }
}

function showCopyResult(button, ok) {
  const label = button.textContent;
  button.textContent = ok ? 'Скопировано ✓' : 'Не удалось скопировать';
  setTimeout(() => { if (button.isConnected) button.textContent = label; }, 1100);
}

$('#search').addEventListener('input', render);
$('#clear').addEventListener('click', async () => {
  if (!confirm('Удалить все незакреплённые записи? Закреплённые останутся.')) return;
  items = items.filter(item => item.pinned);
  await save();
  render();
});
chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && changes.history) load(); });
load();
