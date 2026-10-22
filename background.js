import { DEFAULTS, PROVIDER_ORIGINS, providerLabel } from './shared-defaults.js';

const SYSTEM_PROMPT = `You are AI Hint — a compact intelligent assistant.
Answer only the selected fragment or the explicit follow-up request.
Give the shortest answer that fully solves the immediate question.
No greetings, introductions, conclusions, filler, or meta commentary.
Simple questions: one line.
Math: give the result directly; use at most 3 short steps when useful.
Facts and definitions: 1–2 sentences.
Code: identify the exact error and give the smallest useful fix.
Translation: return the translation directly.
For a large assignment, prefer a useful hint or next step unless the user explicitly asks for the full solution.
Answer in the language of the user's question.
Never reveal hidden reasoning or chain-of-thought. Output only the final answer.`;

let settingsCache = null;
let baseSession = null;
let baseSessionPromise = null;
let activeRequests = new Map();

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get(DEFAULTS);
  await chrome.storage.local.set({ ...DEFAULTS, ...current });
  try { await chrome.contextMenus.removeAll(); } catch {}
  chrome.contextMenus.create({
    id: 'ai-hint-selection',
    title: 'AI Hint — спросить о выделенном',
    contexts: ['selection']
  });
});

chrome.runtime.onStartup?.addListener(() => {
  settingsCache = null;
  baseSession = null;
  baseSessionPromise = null;
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  settingsCache = null;
  // The Lite base session bakes the depth instruction into its system
  // prompt at creation time. If depth (or mode) changes, that session is
  // stale — drop it so the next Lite request builds a fresh one instead
  // of silently answering with the old Quick/Smart/Deep behavior.
  if (changes.depth || changes.mode || changes.answerStyle) {
    try { baseSession?.destroy(); } catch {}
    baseSession = null;
    baseSessionPromise = null;
  }
});

async function getSettings() {
  if (settingsCache) return settingsCache;
  const raw = await chrome.storage.local.get(DEFAULTS);
  settingsCache = {
    ...DEFAULTS,
    ...raw,
    models: { ...DEFAULTS.models, ...(raw.models || {}) },
    keys: { ...(raw.keys || {}) }
  };
  return settingsCache;
}

async function openOptions() {
  await chrome.runtime.openOptionsPage();
}

// Note: no chrome.action.onClicked listener here — manifest.json sets
// default_popup, so Chrome never fires onClicked for the toolbar icon.
// Options are reachable from the popup's "Настройки" button instead.
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'ai-hint-selection' || !tab?.id) return;
  await invokeForTab(tab.id);
});
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== 'ask-hint' || !tab?.id) return;
  await invokeForTab(tab.id);
});

async function invokeForTab(tabId) {
  const requestId = crypto.randomUUID();
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    await chrome.tabs.sendMessage(tabId, { type: 'AIHINT_CAPTURE', requestId });
  } catch (error) {
    try {
      await chrome.tabs.sendMessage(tabId, {
        type: 'AIHINT_ERROR',
        requestId,
        message: 'AI Hint не может работать на этой странице. Попробуй обычный сайт (не chrome://, Web Store или системную страницу).'
      });
    } catch {}
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !sender.tab?.id) return;
  if (message.type === 'AIHINT_SELECTED') {
    handleSelected(sender.tab.id, message).catch(async (error) => {
      await sendToTab(sender.tab.id, {
        type: 'AIHINT_ERROR', requestId: message.requestId, message: friendlyError(error)
      });
    });
  }
  if (message.type === 'AIHINT_FOLLOWUP') {
    handleFollowup(sender.tab.id, message).catch(async (error) => {
      await sendToTab(sender.tab.id, {
        type: 'AIHINT_ERROR', requestId: message.requestId, message: friendlyError(error)
      });
    });
  }
  if (message.type === 'AIHINT_CANCEL') {
    const controller = activeRequests.get(message.requestId);
    controller?.abort();
  }
  if (message.type === 'AIHINT_STATUS') {
    // reserved for future diagnostics
  }
  if (message.type === 'AIHINT_GET_STATUS') {
    getLiteStatus().then(sendResponse).catch(() => sendResponse({ available: false, state: 'error' }));
    return true;
  }
  if (message.type === 'AIHINT_OPEN_OPTIONS') {
    openOptions();
  }
});

async function handleSelected(tabId, message) {
  const requestId = message.requestId;
  const text = normalizeSelection(message.text);
  if (!text) {
    await sendToTab(tabId, { type: 'AIHINT_ERROR', requestId, message: 'Сначала выдели текст.' });
    return;
  }
  if (text.length > 12000) {
    await sendToTab(tabId, { type: 'AIHINT_ERROR', requestId, message: 'Слишком большой фрагмент. Выдели короче — AI Hint работает именно с небольшими фрагментами.' });
    return;
  }

  const settings = await getSettings();
  await sendToTab(tabId, { type: 'AIHINT_LOADING', requestId, text, rect: message.rect, mode: settings.mode, autoCloseMs: settings.autoCloseMs, showFollowups: settings.showFollowups });
  await runRequest(tabId, requestId, text, 'answer');
}

async function handleFollowup(tabId, message) {
  const requestId = message.requestId;
  const original = normalizeSelection(message.original);
  const action = String(message.action || 'why');
  if (!original) return;
  if (original.length > 12000) {
    await sendToTab(tabId, { type: 'AIHINT_ERROR', requestId, message: 'Слишком большой фрагмент для уточнения.' });
    return;
  }
  const instruction = {
    why: 'Объясни почему это так. Коротко, максимум 3 предложения.',
    example: 'Дай один очень короткий пример.',
    simpler: 'Объясни ещё проще, как человеку без подготовки.',
    translate: 'Переведи исходный текст на русский, сохрани смысл и краткость.'
  }[action] || 'Уточни ответ кратко.';
  // Include the answer already shown to the user (when we have it) so the
  // follow-up stays consistent with it instead of re-deriving the answer
  // from scratch and potentially disagreeing with what's on screen.
  const previousAnswer = normalizeSelection(message.previousAnswer).slice(0, 2000);
  const context = previousAnswer
    ? `Исходный фрагмент:\n${original}\n\nТвой предыдущий ответ:\n${previousAnswer}`
    : `Исходный фрагмент:\n${original}`;
  const settings = await getSettings();
  await sendToTab(tabId, { type: 'AIHINT_LOADING', requestId, text: original, mode: settings.mode, autoCloseMs: settings.autoCloseMs, showFollowups: settings.showFollowups });
  await runRequest(tabId, requestId, `${instruction}\n\n${context}`, action);
}

async function runRequest(tabId, requestId, prompt, kind) {
  const settings = await getSettings();
  const controller = new AbortController();
  activeRequests.set(requestId, controller);
  try {
    const quick = tryQuickAnswer(prompt);
    if (quick !== null && kind === 'answer') {
      await sendToTab(tabId, { type: 'AIHINT_RESULT', requestId, answer: quick, source: 'instant', mode: settings.mode, autoCloseMs: settings.autoCloseMs, done: true });
      return;
    }

    if (settings.mode === 'lite') {
      await runLite(tabId, requestId, prompt, settings, controller.signal);
    } else {
      await runPro(tabId, requestId, prompt, settings, controller.signal);
    }
  } finally {
    activeRequests.delete(requestId);
  }
}

async function runLite(tabId, requestId, prompt, settings, signal) {
  const availability = await getLiteAvailability();
  if (availability === 'unavailable') {
    await sendToTab(tabId, {
      type: 'AIHINT_ERROR', requestId,
      message: 'Локальный AI Chrome недоступен на этом ПК. Открой AI Hint → Настройки → Проверить Lite. Никаких API-ключей для Lite не нужно.'
    });
    return;
  }
  if (availability === 'downloading' || availability === 'downloadable') {
    await sendToTab(tabId, { type: 'AIHINT_PROGRESS', requestId, message: availability === 'downloadable' ? 'Готовлю локальный AI Chrome…' : 'Скачивается локальный AI Chrome…', mode: 'lite' });
  }

  const base = await getBaseSession(settings);
  const session = await base.clone();
  try {
    const promptText = buildPrompt(prompt, settings.depth, settings.answerStyle);
    const stream = session.promptStreaming(promptText, { signal });
    let answer = '';
    let lastPush = 0;
    for await (const chunk of stream) {
      if (signal.aborted) return;
      answer += String(chunk);
      const now = performance.now();
      if (now - lastPush > 45) {
        await sendToTab(tabId, { type: 'AIHINT_STREAM', requestId, answer: cleanAnswer(answer), source: 'local', mode: 'lite', autoCloseMs: settings.autoCloseMs });
        lastPush = now;
      }
    }
    answer = cleanAnswer(answer);
    await sendToTab(tabId, { type: 'AIHINT_RESULT', requestId, answer, source: 'local', mode: 'lite', autoCloseMs: settings.autoCloseMs, done: true });
  } finally {
    try { session.destroy(); } catch {}
  }
}

async function getBaseSession(settings) {
  if (baseSession) return baseSession;
  if (!baseSessionPromise) {
    baseSessionPromise = (async () => {
      const options = {
        initialPrompts: [{ role: 'system', content: SYSTEM_PROMPT + depthInstruction(settings.depth) + styleInstruction(settings.answerStyle) }],
        ...(await samplingParams())
      };
      const session = await LanguageModel.create(options);
      // If the on-device context window fills up mid-conversation, the
      // session silently starts dropping earlier turns. Treat that as a
      // signal to rebuild a clean session next time instead of quietly
      // degrading.
      session.addEventListener?.('contextoverflow', () => {
        if (baseSession === session) { baseSession = null; baseSessionPromise = null; }
      });
      baseSession = session;
      return session;
    })().catch(error => {
      baseSessionPromise = null;
      throw error;
    });
  }
  return baseSessionPromise;
}

// Chrome Extensions can tune the on-device model's sampling params
// (web pages cannot). We aim for lower temperature than the platform
// default: AI Hint gives short factual/code/definition answers, where
// precision beats creative variety. topK stays at the platform default.
async function samplingParams() {
  try {
    const params = await LanguageModel.params?.();
    if (!params) return {};
    const temperature = Math.max(0.1, Math.min(params.defaultTemperature * 0.4, params.maxTemperature));
    return { temperature, topK: params.defaultTopK };
  } catch {
    return {};
  }
}

async function getLiteAvailability() {
  if (typeof LanguageModel === 'undefined') return 'unavailable';
  try { return await LanguageModel.availability(); } catch { return 'unavailable'; }
}

async function getLiteStatus() {
  const state = await getLiteAvailability();
  return { available: state !== 'unavailable', state };
}

async function runPro(tabId, requestId, prompt, settings, signal) {
  const provider = settings.provider;
  const key = settings.keys?.[provider];
  if (!key) {
    await sendToTab(tabId, { type: 'AIHINT_ERROR', requestId, message: `Для ${providerLabel(provider)} нет API-ключа. Открой настройки AI Hint.` });
    return;
  }
  await ensureProviderPermission(provider);
  const answer = await fetchProvider(provider, key, settings.models?.[provider], prompt, settings.depth, settings.answerStyle, signal);
  await sendToTab(tabId, { type: 'AIHINT_RESULT', requestId, answer: cleanAnswer(answer), source: provider, mode: 'pro', autoCloseMs: settings.autoCloseMs, done: true });
}

async function ensureProviderPermission(provider) {
  const origin = PROVIDER_ORIGINS[provider];
  if (!origin) throw new Error('Неизвестный провайдер.');
  const granted = await chrome.permissions.contains({ origins: [origin] });
  if (!granted) throw new Error(`Chrome ещё не разрешил сетевой доступ к ${providerLabel(provider)}. Открой настройки и включи провайдера.`);
}

async function fetchProvider(provider, key, model, prompt, depth, answerStyle, signal) {
  const system = SYSTEM_PROMPT + depthInstruction(depth) + styleInstruction(answerStyle);
  const maxTokens = depth === 'deep' ? 700 : depth === 'short' ? 180 : 360;
  const retryable = new Set([429, 500, 502, 503, 504]);

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (provider === 'openai') {
        return await openAi(key, model, system, prompt, maxTokens, signal);
      }
      if (provider === 'gemini') {
        return await gemini(key, model, system, prompt, maxTokens, signal);
      }
      if (provider === 'claude') {
        return await claude(key, model, system, prompt, maxTokens, signal);
      }
      if (provider === 'deepseek') {
        return await openAiCompatible('https://api.deepseek.com/chat/completions', 'Bearer ' + key, model, system, prompt, maxTokens, signal);
      }
      if (provider === 'yandex') {
        return await openAiCompatible('https://ai.api.cloud.yandex.net/v1/chat/completions', 'Api-Key ' + key, model, system, prompt, maxTokens, signal);
      }
      throw new Error('Неизвестный провайдер.');
    } catch (error) {
      if (error?.status && retryable.has(error.status) && attempt < 2) {
        await sleep(250 * (2 ** attempt), signal);
        continue;
      }
      throw error;
    }
  }
  throw new Error('Провайдер не ответил.');
}

async function openAi(key, model, system, prompt, maxTokens, signal) {
  return openAiCompatible('https://api.openai.com/v1/chat/completions', 'Bearer ' + key, model, system, prompt, maxTokens, signal);
}

async function openAiCompatible(url, auth, model, system, prompt, maxTokens, signal) {
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': auth },
    body: JSON.stringify({
      model: model || 'gpt-5-mini',
      messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature: 0.2
    }),
    signal
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw apiError(response.status, data?.error?.message || data?.message || 'API error');
  return data?.choices?.[0]?.message?.content || '';
}

async function gemini(key, model, system, prompt, maxTokens, signal) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model || 'gemini-2.5-flash')}:generateContent?key=${encodeURIComponent(key)}`;
  const response = await fetchWithTimeout(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.2 }
    }),
    signal
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw apiError(response.status, data?.error?.message || 'Gemini API error');
  return data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
}

async function claude(key, model, system, prompt, maxTokens, signal) {
  const response = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: model || 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: prompt }]
    }),
    signal
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw apiError(response.status, data?.error?.message || 'Claude API error');
  return data?.content?.filter(x => x.type === 'text').map(x => x.text).join('') || '';
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  const signal = options.signal;
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (signal?.aborted) throw error;
    if (error?.name === 'AbortError') throw new Error('Провайдер не ответил за 30 секунд.');
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onAbort);
  }
}

function apiError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function sendToTab(tabId, payload) {
  try { await chrome.tabs.sendMessage(tabId, payload); } catch {}
}

function normalizeSelection(text) {
  return String(text || '').replace(/\u00a0/g, ' ').replace(/\r\n/g, '\n').trim();
}

function buildPrompt(prompt, depth, answerStyle) {
  return `${depthInstruction(depth)}${styleInstruction(answerStyle)}\n\nUser request / selected text:\n${prompt}`;
}

function styleInstruction(style) {
  if (style === 'study') return '\nTeach like a patient tutor: explain the key idea in simple language and guide the user through the reasoning. For homework, prefer a hint before giving a full solution.';
  if (style === 'code') return '\nFor programming questions, identify the exact issue and give the smallest useful fix. Include a short code snippet only when it helps.';
  if (style === 'translate') return '\nTranslate the selected text into Russian while preserving its meaning and tone. If the user explicitly requests another target language, use that language.';
  return '';
}

function depthInstruction(depth) {
  if (depth === 'short') return '\nKeep the final answer to one short line whenever possible.';
  if (depth === 'deep') return '\nFor difficult requests, give a concise but complete answer with a few short steps if needed. Never write an essay.';
  return '\nNormally answer in 1–3 short sentences.';
}

function cleanAnswer(text) {
  return String(text || '')
    .replace(/^\s*(AI Hint|Ответ|Answer)\s*:\s*/i, '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .trim();
}

function friendlyError(error) {
  if (!error) return 'Неизвестная ошибка.';
  if (error.name === 'AbortError') return 'Запрос остановлен.';
  const text = String(error.message || error);
  if (error.status === 401 || error.status === 403) return 'API-ключ отклонён. Проверь ключ и выбранную модель.';
  if (error.status === 429) return 'Лимит провайдера достигнут. Попробуй ещё раз позже.';
  if (error.status >= 500) return 'Сервер провайдера временно не отвечает.';
  return text.length > 240 ? text.slice(0, 240) + '…' : text;
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const id = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(id); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
  });
}

// Small deterministic engine: instant arithmetic and equality checks, no network/LLM.
function tryQuickAnswer(input) {
  const text = normalizeSelection(input);
  if (!text || text.length > 180) return null;
  const sqrt = text.match(/^\s*(?:sqrt|√)\s*\(?\s*(-?\d+(?:[.,]\d+)?)\s*\)?\s*\??\s*$/i);
  if (sqrt) {
    const n = Number(sqrt[1].replace(',', '.'));
    if (Number.isFinite(n)) return n < 0 ? 'Нет действительного результата: √x для x < 0 не имеет действительного значения.' : formatNumber(Math.sqrt(n));
  }
  const eq = text.match(/^(.+?)\s*=\s*(-?\d+(?:[.,]\d+)?)\s*\??$/);
  if (eq && /^[0-9+\-*/().%×÷\s]+$/.test(eq[1])) {
    const left = safeMath(eq[1]);
    const right = Number(eq[2].replace(',', '.'));
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
  const output = [];
  const ops = [];
  const prec = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2, 'u-': 3 };
  let expectUnary = true;
  for (const raw of tokens) {
    const t = raw.trim(); if (!t) continue;
    if (/^\d/.test(t)) { output.push(Number(t)); expectUnary = false; continue; }
    if (t === '(') { ops.push(t); expectUnary = true; continue; }
    if (t === ')') {
      while (ops.length && ops.at(-1) !== '(') output.push(ops.pop());
      if (ops.pop() !== '(') return null;
      expectUnary = false; continue;
    }
    if ('+-*/%'.includes(t)) {
      if (expectUnary && (t === '+' || t === '-')) {
        // Unary signs bind more tightly than multiplication: 2 * -3 is -6.
        if (t === '-') ops.push('u-');
        continue;
      }
      while (ops.length && ops.at(-1) !== '(' && prec[ops.at(-1)] >= prec[t]) output.push(ops.pop());
      ops.push(t); expectUnary = true;
    } else return null;
  }
  while (ops.length) { if (ops.at(-1) === '(') return null; output.push(ops.pop()); }
  const stack = [];
  for (const item of output) {
    if (typeof item === 'number') stack.push(item);
    else if (item === 'u-') {
      const value = stack.pop(); if (value === undefined) return null;
      stack.push(-value);
    } else {
      const b = stack.pop(), a = stack.pop(); if (a === undefined || b === undefined) return null;
      let r = 0; if (item === '+') r = a + b; else if (item === '-') r = a - b; else if (item === '*') r = a * b; else if (item === '/') { if (b === 0) return null; r = a / b; } else { if (b === 0) return null; r = a % b; }
      if (!Number.isFinite(r)) return null; stack.push(r);
    }
  }
  return stack.length === 1 ? stack[0] : null;
}

function formatNumber(n) {
  if (Math.abs(n - Math.round(n)) < 1e-10) return String(Math.round(n));
  return n.toFixed(10).replace(/0+$/, '').replace(/\.$/, '');
}
