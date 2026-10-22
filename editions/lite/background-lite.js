import { DEFAULTS } from './shared-defaults.js';

const SYSTEM_PROMPT = `You are AI Hint Lite, a compact on-device assistant.
Answer only the selected fragment or explicit follow-up request.
Give the shortest answer that fully solves the immediate question.
No greetings, introductions, conclusions, filler, or meta commentary.
Simple questions: one line. Math: give the result directly. Facts: 1–2 sentences.
For large assignments, prefer a useful hint unless the user explicitly asks for the full solution.
Answer in the language of the user's question. Never reveal hidden reasoning.`;

let settingsCache = null;
let baseSession = null;
let baseSessionPromise = null;
const activeRequests = new Map();

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get(DEFAULTS);
  await chrome.storage.local.set({ ...DEFAULTS, ...current, mode: 'lite' });
  try { await chrome.contextMenus.removeAll(); } catch {}
  chrome.contextMenus.create({ id: 'ai-hint-selection', title: 'AI Hint Lite — спросить о выделенном', contexts: ['selection'] });
});

chrome.runtime.onStartup?.addListener(() => {
  settingsCache = null;
  baseSession = null;
  baseSessionPromise = null;
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  settingsCache = null;
  if (changes.depth || changes.answerStyle) {
    try { baseSession?.destroy(); } catch {}
    baseSession = null;
    baseSessionPromise = null;
  }
});

async function getSettings() {
  if (settingsCache) return settingsCache;
  const raw = await chrome.storage.local.get(DEFAULTS);
  settingsCache = { ...DEFAULTS, ...raw, mode: 'lite' };
  return settingsCache;
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'ai-hint-selection' && tab?.id) await invokeForTab(tab.id);
});
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command === 'ask-hint' && tab?.id) await invokeForTab(tab.id);
});

async function invokeForTab(tabId) {
  const requestId = crypto.randomUUID();
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    await chrome.tabs.sendMessage(tabId, { type: 'AIHINT_CAPTURE', requestId });
  } catch {
    try {
      await chrome.tabs.sendMessage(tabId, {
        type: 'AIHINT_ERROR', requestId,
        message: 'AI Hint Lite не может работать на этой странице. Попробуй обычный сайт.'
      });
    } catch {}
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'AIHINT_GET_STATUS') {
    getLiteStatus().then(sendResponse).catch(() => sendResponse({ available: false, state: 'error' }));
    return true;
  }
  if (!message || !sender.tab?.id) return;
  if (message.type === 'AIHINT_SELECTED') {
    handleSelected(sender.tab.id, message).catch(error => sendError(sender.tab.id, message.requestId, error));
  } else if (message.type === 'AIHINT_FOLLOWUP') {
    handleFollowup(sender.tab.id, message).catch(error => sendError(sender.tab.id, message.requestId, error));
  } else if (message.type === 'AIHINT_CANCEL') {
    activeRequests.get(message.requestId)?.abort();
  }
});

async function handleSelected(tabId, message) {
  const text = normalizeSelection(message.text);
  if (!text) return sendToTab(tabId, { type: 'AIHINT_ERROR', requestId: message.requestId, message: 'Сначала выдели текст.' });
  if (text.length > 12000) return sendToTab(tabId, { type: 'AIHINT_ERROR', requestId: message.requestId, message: 'Слишком большой фрагмент. Выдели текст покороче.' });
  const settings = await getSettings();
  await sendToTab(tabId, { type: 'AIHINT_LOADING', requestId: message.requestId, text, rect: message.rect, mode: 'lite', autoCloseMs: settings.autoCloseMs, showFollowups: settings.showFollowups });
  await runRequest(tabId, message.requestId, text, 'answer');
}

async function handleFollowup(tabId, message) {
  const original = normalizeSelection(message.original);
  if (!original) return;
  if (original.length > 12000) return sendToTab(tabId, { type: 'AIHINT_ERROR', requestId: message.requestId, message: 'Слишком большой фрагмент для уточнения.' });
  const instruction = {
    why: 'Объясни почему это так. Коротко, максимум 3 предложения.',
    example: 'Дай один очень короткий пример.',
    simpler: 'Объясни ещё проще, как человеку без подготовки.',
    translate: 'Переведи исходный текст на русский, сохрани смысл и краткость.'
  }[message.action] || 'Уточни ответ кратко.';
  const previousAnswer = normalizeSelection(message.previousAnswer).slice(0, 2000);
  const context = previousAnswer ? `Исходный фрагмент:\n${original}\n\nПредыдущий ответ:\n${previousAnswer}` : `Исходный фрагмент:\n${original}`;
  const settings = await getSettings();
  await sendToTab(tabId, { type: 'AIHINT_LOADING', requestId: message.requestId, text: original, mode: 'lite', autoCloseMs: settings.autoCloseMs, showFollowups: settings.showFollowups });
  await runRequest(tabId, message.requestId, `${instruction}\n\n${context}`, message.action);
}

async function runRequest(tabId, requestId, prompt, kind) {
  const settings = await getSettings();
  const controller = new AbortController();
  activeRequests.set(requestId, controller);
  try {
    const quick = tryQuickAnswer(prompt);
    if (quick !== null && kind === 'answer') {
      await sendToTab(tabId, { type: 'AIHINT_RESULT', requestId, answer: quick, source: 'instant', mode: 'lite', autoCloseMs: settings.autoCloseMs, done: true });
      return;
    }
    await runLite(tabId, requestId, prompt, settings, controller.signal);
  } finally {
    activeRequests.delete(requestId);
  }
}

async function runLite(tabId, requestId, prompt, settings, signal) {
  const availability = await getLiteAvailability();
  if (availability === 'unavailable') {
    await sendToTab(tabId, { type: 'AIHINT_ERROR', requestId, message: 'Локальный AI недоступен в этой версии Chrome или на этом устройстве. API-ключ для AI Hint Lite не предусмотрен.' });
    return;
  }
  if (availability === 'downloading' || availability === 'downloadable') {
    await sendToTab(tabId, { type: 'AIHINT_PROGRESS', requestId, message: availability === 'downloadable' ? 'Готовлю локальную модель Chrome…' : 'Скачивается локальная модель Chrome…', mode: 'lite' });
  }
  const base = await getBaseSession(settings);
  const session = await base.clone();
  try {
    let answer = '';
    let lastPush = 0;
    for await (const chunk of session.promptStreaming(buildPrompt(prompt, settings.depth, settings.answerStyle), { signal })) {
      if (signal.aborted) return;
      answer += String(chunk);
      const now = performance.now();
      if (now - lastPush > 45) {
        await sendToTab(tabId, { type: 'AIHINT_STREAM', requestId, answer: cleanAnswer(answer), source: 'local', mode: 'lite', autoCloseMs: settings.autoCloseMs });
        lastPush = now;
      }
    }
    await sendToTab(tabId, { type: 'AIHINT_RESULT', requestId, answer: cleanAnswer(answer), source: 'local', mode: 'lite', autoCloseMs: settings.autoCloseMs, done: true });
  } finally {
    try { session.destroy(); } catch {}
  }
}

async function getBaseSession(settings) {
  if (baseSession) return baseSession;
  if (!baseSessionPromise) {
    baseSessionPromise = (async () => {
      const options = { initialPrompts: [{ role: 'system', content: SYSTEM_PROMPT + depthInstruction(settings.depth) + styleInstruction(settings.answerStyle) }], ...(await samplingParams()) };
      const session = await LanguageModel.create(options);
      session.addEventListener?.('contextoverflow', () => {
        if (baseSession === session) { baseSession = null; baseSessionPromise = null; }
      });
      baseSession = session;
      return session;
    })().catch(error => { baseSessionPromise = null; throw error; });
  }
  return baseSessionPromise;
}

async function samplingParams() {
  try {
    const params = await LanguageModel.params?.();
    if (!params) return {};
    return { temperature: Math.max(0.1, Math.min(params.defaultTemperature * 0.4, params.maxTemperature)), topK: params.defaultTopK };
  } catch { return {}; }
}

async function getLiteAvailability() {
  if (typeof LanguageModel === 'undefined') return 'unavailable';
  try { return await LanguageModel.availability(); } catch { return 'unavailable'; }
}
async function getLiteStatus() { const state = await getLiteAvailability(); return { available: state !== 'unavailable', state }; }

async function sendToTab(tabId, payload) { try { await chrome.tabs.sendMessage(tabId, payload); } catch {} }
async function sendError(tabId, requestId, error) { await sendToTab(tabId, { type: 'AIHINT_ERROR', requestId, message: friendlyError(error) }); }
function normalizeSelection(text) { return String(text || '').replace(/\u00a0/g, ' ').replace(/\r\n/g, '\n').trim(); }
function buildPrompt(prompt, depth, style) { return `${depthInstruction(depth)}${styleInstruction(style)}\n\nSelected text or request:\n${prompt}`; }
function depthInstruction(depth) {
  if (depth === 'short') return '\nKeep the final answer to one short line whenever possible.';
  if (depth === 'deep') return '\nFor difficult requests, give a concise but complete answer with a few short steps if needed. Never write an essay.';
  return '\nNormally answer in 1–3 short sentences.';
}
function styleInstruction(style) {
  if (style === 'study') return '\nTeach like a patient tutor: explain the key idea simply and guide the user through the reasoning. For homework, prefer a hint before a full solution.';
  if (style === 'code') return '\nFor programming questions, identify the exact issue and give the smallest useful fix. Include a short code snippet only when it helps.';
  if (style === 'translate') return '\nTranslate the selected text into Russian while preserving meaning and tone. If the user requests another target language, use that language.';
  return '';
}
function cleanAnswer(text) { return String(text || '').replace(/^\s*(AI Hint|Ответ|Answer)\s*:\s*/i, '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim(); }
function friendlyError(error) {
  if (!error) return 'Неизвестная ошибка.';
  if (error.name === 'AbortError') return 'Запрос остановлен.';
  const text = String(error.message || error);
  return text.length > 240 ? `${text.slice(0, 240)}…` : text;
}

function tryQuickAnswer(input) {
  const text = normalizeSelection(input);
  if (!text || text.length > 180) return null;
  const sqrt = text.match(/^\s*(?:sqrt|√)\s*\(?\s*(-?\d+(?:[.,]\d+)?)\s*\)?\s*\??\s*$/i);
  if (sqrt) { const n = Number(sqrt[1].replace(',', '.')); if (Number.isFinite(n)) return n < 0 ? 'Нет действительного результата: √x для x < 0 не имеет действительного значения.' : formatNumber(Math.sqrt(n)); }
  const eq = text.match(/^(.+?)\s*=\s*(-?\d+(?:[.,]\d+)?)\s*\??$/);
  if (eq && /^[0-9+\-*/().%×÷\s]+$/.test(eq[1])) {
    const left = safeMath(eq[1]), right = Number(eq[2].replace(',', '.'));
    if (left !== null && Number.isFinite(right)) return Math.abs(left - right) < 1e-10 ? `Да, ${formatNumber(right)}.` : `Нет. Правильно: ${formatNumber(left)}.`;
  }
  const expression = text.endsWith('?') ? text.slice(0, -1).trim() : text;
  if (!/^[0-9+\-*/().%×÷\s]+$/.test(expression)) return null;
  const value = safeMath(expression);
  return value === null ? null : formatNumber(value);
}

function safeMath(expr) {
  const tokens = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/,/g, '.').match(/\d+(?:\.\d+)?|[+\-*/%()]|\s+/g);
  if (!tokens) return null;
  const output = [], ops = [], prec = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2, 'u-': 3 };
  let expectUnary = true;
  for (const raw of tokens) {
    const t = raw.trim(); if (!t) continue;
    if (/^\d/.test(t)) { output.push(Number(t)); expectUnary = false; continue; }
    if (t === '(') { ops.push(t); expectUnary = true; continue; }
    if (t === ')') { while (ops.length && ops.at(-1) !== '(') output.push(ops.pop()); if (ops.pop() !== '(') return null; expectUnary = false; continue; }
    if ('+-*/%'.includes(t)) {
      if (expectUnary && (t === '+' || t === '-')) { if (t === '-') ops.push('u-'); continue; }
      while (ops.length && ops.at(-1) !== '(' && prec[ops.at(-1)] >= prec[t]) output.push(ops.pop());
      ops.push(t); expectUnary = true;
    } else return null;
  }
  while (ops.length) { if (ops.at(-1) === '(') return null; output.push(ops.pop()); }
  const stack = [];
  for (const item of output) {
    if (typeof item === 'number') stack.push(item);
    else if (item === 'u-') { const value = stack.pop(); if (value === undefined) return null; stack.push(-value); }
    else {
      const b = stack.pop(), a = stack.pop(); if (a === undefined || b === undefined) return null;
      let result = 0;
      if (item === '+') result = a + b; else if (item === '-') result = a - b; else if (item === '*') result = a * b;
      else if (item === '/') { if (b === 0) return null; result = a / b; }
      else { if (b === 0) return null; result = a % b; }
      if (!Number.isFinite(result)) return null;
      stack.push(result);
    }
  }
  return stack.length === 1 ? stack[0] : null;
}
function formatNumber(n) { if (Math.abs(n - Math.round(n)) < 1e-10) return String(Math.round(n)); return n.toFixed(10).replace(/0+$/, '').replace(/\.$/, ''); }
