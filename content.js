(() => {
  const HOST_ID = '__ai_hint_host__';
  if (window.__AI_HINT_CONTENT_INSTALLED__) return;
  window.__AI_HINT_CONTENT_INSTALLED__ = true;

  let current = null;
  let hideTimer = null;
  let lastRequest = null;
  let autoCloseMs = 10000;
  let fallbackHotkeyGuard = 0;

  chrome.runtime.onMessage.addListener((message) => {
    if (!message) return;
    if (typeof message.autoCloseMs === 'number' && message.autoCloseMs > 0) autoCloseMs = message.autoCloseMs;
    if (message.type === 'AIHINT_CAPTURE') capture(message.requestId, message.action);
    if (message.type === 'AIHINT_SUMMARIZE_PAGE_CAPTURE') capturePage(message.requestId, message.maxChars);
    if (message.type === 'AIHINT_LOADING') updateLoading(message);
    if (message.type === 'AIHINT_PROGRESS') updateProgress(message);
    if (message.type === 'AIHINT_STREAM') updateAnswer(message);
    if (message.type === 'AIHINT_RESULT') updateAnswer(message, true);
    if (message.type === 'AIHINT_ERROR') showError(message.message, message.requestId);
  });

  // Esc closes the bubble (and cancels the in-flight request, if any).
  // Ctrl+Shift+Space is a fallback for the chrome://extensions/shortcuts
  // command: the registered command is intercepted by the browser and
  // never reaches page JS when it's bound correctly, so this only kicks
  // in when the shortcut is unassigned or taken by something else.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const host = document.getElementById(HOST_ID);
      const wrap = host?.__shadow?.querySelector('.wrap');
      if (!wrap || wrap.hidden) return;
      wrap.hidden = true;
      clearTimeout(hideTimer);
      if (current?.requestId) chrome.runtime.sendMessage({ type: 'AIHINT_CANCEL', requestId: current.requestId });
      return;
    }
    if (e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey && e.code === 'Space') {
      const now = Date.now();
      if (now - fallbackHotkeyGuard < 600) return;
      fallbackHotkeyGuard = now;
      e.preventDefault();
      capture(crypto.randomUUID());
    }
  }, true);

  function capture(requestId, action = 'ask') {
    const editableSelection = readEditableSelection();
    const selection = window.getSelection();
    const pageText = selection ? selection.toString() : '';
    const picked = editableSelection?.text?.trim() ? editableSelection : null;
    const text = (picked?.text || pageText).trim();
    if (!text) {
      chrome.runtime.sendMessage({ type: 'AIHINT_SELECTED', requestId, text: '', action });
      return;
    }
    let rect = null;
    if (picked?.rect) rect = picked.rect;
    else try {
      const range = selection.rangeCount ? selection.getRangeAt(0) : null;
      const r = range?.getBoundingClientRect();
      if (r) rect = { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    } catch {}
    const inputAction = picked && action === 'ask' ? 'rewrite' : action;
    lastRequest = { requestId, original: picked?.text || text, answer: '', editable: picked?.target || null, inputAction };
    showBubble({ requestId, rect, loading: true, text: '' });
    chrome.runtime.sendMessage({ type: 'AIHINT_SELECTED', requestId, text, rect, action: inputAction });
  }

  function readEditableSelection() {
    const element = document.activeElement;
    if (element instanceof HTMLTextAreaElement || (element instanceof HTMLInputElement && /^(text|search|url|tel|email)$/i.test(element.type))) {
      const start = element.selectionStart, end = element.selectionEnd;
      if (start === null || end === null || start === end) return null;
      const text = element.value.slice(start, end);
      const rect = getCaretRect(element, start, end);
      return { text, rect, target: { kind: 'input', element, start, end, value: element.value, text } };
    }
    const editable = element?.closest?.('[contenteditable="true"],[contenteditable=""],[role="textbox"]');
    const selection = window.getSelection();
    if (editable && selection?.rangeCount && !selection.isCollapsed) {
      const range = selection.getRangeAt(0);
      if (!editable.contains(range.commonAncestorContainer)) return null;
      const rect = range.getBoundingClientRect();
      return { text: selection.toString(), rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height }, target: { kind: 'contenteditable', element: editable, range: range.cloneRange(), text: selection.toString() } };
    }
    return null;
  }

  function getCaretRect(element, start, end) {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.5 || 20;
    const text = element.value.slice(0, start);
    const lines = text.split('\n');
    const line = lines.length - 1;
    const top = rect.top + Math.min(rect.height - lineHeight, line * lineHeight) - element.scrollTop;
    const left = rect.left + 8 - element.scrollLeft;
    return { left, top, right: Math.min(rect.right, left + 180), bottom: top + lineHeight, width: 180, height: lineHeight };
  }

  function replaceEditableSelection() {
    const target = lastRequest?.editable;
    const replacement = lastRequest?.answer;
    if (!target || !replacement || !target.element?.isConnected) return false;
    if (target.kind === 'input') {
      const { element, start, end, text, value } = target;
      if (element.value !== value || element.value.slice(start, end) !== text) return false;
      element.focus();
      element.setRangeText(replacement, start, end, 'end');
      element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText', data: replacement }));
      return true;
    }
    if (target.kind === 'contenteditable') {
      const { element, range, text } = target;
      if (!element.contains(range.commonAncestorContainer) || range.toString() !== text) return false;
      element.focus();
      range.deleteContents();
      const node = document.createTextNode(replacement);
      range.insertNode(node);
      range.setStartAfter(node); range.collapse(true);
      const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
      element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText', data: replacement }));
      return true;
    }
    return false;
  }

  function capturePage(requestId, maxChars = 4000) {
    const source = document.querySelector('article, main, [role="main"]') || document.body;
    const text = String(source?.innerText || '').replace(/\n{3,}/g, '\n\n').trim().slice(0, Math.max(500, Math.min(12000, Number(maxChars) || 4000)));
    if (!text) {
      chrome.runtime.sendMessage({ type: 'AIHINT_SELECTED', requestId, text: '' });
      return;
    }
    lastRequest = { requestId, original: text, answer: '' };
    showBubble({ requestId, rect: null, loading: true, text: '' });
    chrome.runtime.sendMessage({ type: 'AIHINT_SELECTED', requestId, text, action: 'summarize', rect: null });
  }

  function ensureHost() {
    let host = document.getElementById(HOST_ID);
    if (!host) {
      host = document.createElement('div');
      host.id = HOST_ID;
      host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;';
      document.documentElement.appendChild(host);
      const shadow = host.attachShadow({ mode: 'open' });
      shadow.innerHTML = `
        <style>
          :host{all:initial}
          .wrap{position:fixed;left:0;top:0;max-width:min(390px,calc(100vw - 24px));pointer-events:auto;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#19213a;animation:in .18s cubic-bezier(.2,.8,.2,1)}
          .card{box-sizing:border-box;min-width:150px;max-width:390px;border:1px solid rgba(255,255,255,.94);border-radius:17px;padding:12px 13px;background:rgba(255,255,255,.94);backdrop-filter:blur(20px) saturate(150%);-webkit-backdrop-filter:blur(20px) saturate(150%);box-shadow:0 14px 38px rgba(24,34,70,.19),0 2px 8px rgba(24,34,70,.08)}
          .pro .card{background:rgba(25,30,47,.96);border-color:rgba(255,255,255,.13);color:#f8f9ff;box-shadow:0 17px 45px rgba(10,13,25,.38)}
          .head{display:flex;align-items:center;gap:7px;margin-bottom:7px;color:#6678ed;font-size:9px;font-weight:850;letter-spacing:.12em}.pro .head{color:#a9b5ff}.mascot{position:relative;width:23px;height:23px;display:grid;place-items:end center;overflow:hidden;border-radius:9px;background:linear-gradient(145deg,#b7c2ff,#717df0);box-shadow:0 2px 7px #7784e944}.mascot i{position:absolute;top:2px;width:14px;height:13px;border-radius:55% 55% 42% 42%;background:#292d4d;box-shadow:-2px 4px 0 -1px #292d4d,2px 4px 0 -1px #292d4d}.mascot b{z-index:1;margin-bottom:2px;color:white;font-size:9px;font-style:normal;animation:mascot-think 2s ease-in-out infinite}.answer{font-size:14px;font-weight:500;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}.loading{display:flex;align-items:center;gap:5px;height:22px}.dot{width:5px;height:5px;border-radius:50%;background:#6879f0;opacity:.45;animation:b 1s infinite}.pro .dot{background:#a9b5ff}.dot:nth-child(2){animation-delay:.12s}.dot:nth-child(3){animation-delay:.24s}@keyframes b{0%,80%,100%{transform:translateY(0);opacity:.3}40%{transform:translateY(-3px);opacity:1}}@keyframes mascot-think{0%,100%{transform:translateY(0) rotate(-9deg)}50%{transform:translateY(-2px) rotate(9deg)}}
          .meta{display:flex;align-items:center;justify-content:space-between;margin-top:10px;padding-top:8px;border-top:1px solid rgba(28,39,76,.08);gap:8px;font-size:9px}.pro .meta{border-top-color:rgba(255,255,255,.12)}.source{white-space:nowrap;color:#77829a}.pro .source{color:#a5aec4}.actions{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}.btn{border:1px solid rgba(83,104,245,.12);border-radius:8px;padding:5px 7px;background:#f3f5ff;color:#5367d5;font:inherit;font-size:9px;font-weight:700;cursor:pointer;transition:background .14s,border-color .14s}.pro .btn{border-color:rgba(255,255,255,.11);background:rgba(255,255,255,.08);color:#c6ceff}.btn:hover{border-color:rgba(83,104,245,.26);background:#e8ecff}.pro .btn:hover{background:rgba(255,255,255,.15)}.btn:focus-visible{outline:2px solid #8392ff;outline-offset:2px}
          .error .card{background:rgba(255,248,248,.97);border-color:rgba(224,91,91,.28)}.error .head{color:#c74f4f}.pro.error .card{background:rgba(55,27,36,.97)}
          .theme-dark .card{background:rgba(25,30,47,.97);border-color:rgba(255,255,255,.12);color:#f8f9ff}.theme-dark .head{color:#a9b5ff}.theme-dark .meta{border-top-color:rgba(255,255,255,.12)}.theme-dark .source{color:#a5aec4}.theme-dark .btn{border-color:rgba(255,255,255,.11);background:rgba(255,255,255,.08);color:#c6ceff}.theme-dark .btn:hover{background:rgba(255,255,255,.15)}
          .theme-light .card,.pro.theme-light .card{background:rgba(255,255,255,.97);border-color:rgba(255,255,255,.94);color:#19213a;box-shadow:0 14px 38px rgba(24,34,70,.19),0 2px 8px rgba(24,34,70,.08)}.theme-light .head{color:#6678ed}.theme-light .meta{border-top-color:rgba(28,39,76,.08)}.theme-light .source{color:#77829a}.theme-light .btn{border-color:rgba(83,104,245,.12);background:#f3f5ff;color:#5367d5}.theme-light .btn:hover{background:#e8ecff}
          @media(prefers-color-scheme:dark){.wrap:not(.theme-light):not(.pro) .card{background:rgba(25,30,47,.97);border-color:rgba(255,255,255,.12);color:#f8f9ff}.wrap:not(.theme-light):not(.pro) .head{color:#a9b5ff}.wrap:not(.theme-light):not(.pro) .meta{border-top-color:rgba(255,255,255,.12)}.wrap:not(.theme-light):not(.pro) .source{color:#a5aec4}.wrap:not(.theme-light):not(.pro) .btn{border-color:rgba(255,255,255,.11);background:rgba(255,255,255,.08);color:#c6ceff}}
          @media(prefers-reduced-motion:reduce){.wrap,.dot{animation:none}}
          @keyframes in{from{opacity:0;transform:translateY(5px) scale(.98)}to{opacity:1;transform:none}}
        </style>
        <div class="wrap" hidden><div class="card"><div class="head"><span class="mascot" aria-hidden="true"><i></i><b>✦</b></span><span class="title">AI HINT</span></div><div class="answer"></div><div class="meta"><span class="source"></span><div class="actions"></div></div></div></div>`;
      const wrap = shadow.querySelector('.wrap');
      wrap.addEventListener('mouseenter', () => clearTimeout(hideTimer));
      wrap.addEventListener('mouseleave', () => scheduleHide());
      host.__shadow = shadow;
    }
    return { host, shadow: host.__shadow };
  }

  function showBubble({ requestId, rect, loading, text = '', source = '', mode = '', showFollowups, bubbleTheme }) {
    const { shadow } = ensureHost();
    const wrap = shadow.querySelector('.wrap');
    wrap.classList.toggle('pro', mode === 'pro' || source === 'openai' || source === 'gemini' || source === 'claude' || source === 'deepseek' || source === 'yandex');
    const theme = bubbleTheme || current?.bubbleTheme || 'auto';
    wrap.classList.toggle('theme-dark', theme === 'dark');
    wrap.classList.toggle('theme-light', theme === 'light');
    wrap.hidden = false;
    current = { requestId, rect: rect || current?.rect || null, source, mode: mode || current?.mode || 'lite', showFollowups: showFollowups ?? current?.showFollowups ?? true, bubbleTheme: theme };
    position(wrap, current.rect);
    const answer = shadow.querySelector('.answer');
    const actions = shadow.querySelector('.actions');
    answer.innerHTML = loading ? '<div class="loading"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>' : escapeHtml(text);
    shadow.querySelector('.source').textContent = sourceLabel(source);
    actions.innerHTML = '';
    if (loading) addStopAction(actions, requestId);
    else if (text) addActions(actions, current.showFollowups);
    scheduleHide();
  }

  function updateLoading(message) {
    if (!current || current.requestId !== message.requestId) showBubble({ requestId: message.requestId, rect: message.rect, loading: true, mode: message.mode || 'lite', showFollowups: message.showFollowups, bubbleTheme: message.bubbleTheme });
    else showBubble({ requestId: message.requestId, rect: current.rect, loading: true, mode: message.mode || current.mode, showFollowups: message.showFollowups, bubbleTheme: message.bubbleTheme || current.bubbleTheme });
  }

  function updateProgress(message) {
    const { shadow } = ensureHost();
    shadow.querySelector('.wrap').hidden = false;
    shadow.querySelector('.answer').textContent = message.message || 'Готовлю локальный AI…';
    shadow.querySelector('.source').textContent = 'LOCAL';
    shadow.querySelector('.wrap').classList.toggle('pro', message.mode === 'pro');
    position(shadow.querySelector('.wrap'), current?.rect);
    scheduleHide(15000);
  }

  function updateAnswer(message, done = false) {
    if (current && current.requestId !== message.requestId) return;
    if (lastRequest && lastRequest.requestId === message.requestId) lastRequest.answer = message.answer || '';
    showBubble({ requestId: message.requestId, rect: current?.rect, loading: false, text: message.answer || '', source: message.source || current?.source || 'LOCAL', mode: message.mode || current?.mode, bubbleTheme: current?.bubbleTheme, showFollowups: current?.showFollowups });
    if (done) {
      scheduleHide();
    }
  }

  function showError(message, requestId) {
    const { shadow } = ensureHost();
    current = { requestId, rect: current?.rect || null, source: 'ERROR', mode: 'lite' };
    const wrap = shadow.querySelector('.wrap');
    wrap.classList.add('error');
    wrap.hidden = false;
    shadow.querySelector('.answer').textContent = message || 'Что-то пошло не так.';
    shadow.querySelector('.source').textContent = 'AI HINT';
    shadow.querySelector('.actions').innerHTML = '';
    position(wrap, current.rect);
    scheduleHide(8000);
    setTimeout(() => wrap.classList.remove('error'), 250);
  }

  function addStopAction(container, requestId) {
    const stop = document.createElement('button'); stop.className = 'btn'; stop.textContent = 'Стоп';
    stop.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'AIHINT_CANCEL', requestId });
      const wrap = container.closest('.wrap');
      if (wrap) wrap.hidden = true;
    });
    container.appendChild(stop);
  }

  function addActions(container, showFollowups = true) {
    if (!lastRequest?.original) return;
    if (lastRequest.editable) {
      const insert = document.createElement('button'); insert.className = 'btn primary-action'; insert.textContent = 'Заменить выделение';
      insert.addEventListener('click', () => {
        if (replaceEditableSelection()) { insert.textContent = 'Вставлено ✓'; setTimeout(() => { if (insert.isConnected) insert.textContent = 'Заменить выделение'; }, 1200); }
        else insert.textContent = 'Поле изменилось — выдели текст заново';
      });
      container.appendChild(insert);
      const edits = [['rewrite','Улучшить'],['proofread','Исправить'],['translate','Перевести']];
      for (const [action, label] of edits) {
        const btn = document.createElement('button'); btn.className = 'btn'; btn.textContent = label;
        btn.addEventListener('click', () => runEditableAction(action));
        container.appendChild(btn);
      }
    }
    if (showFollowups && !lastRequest.editable) {
      const items = [['why','Почему?'],['example','Пример'],['simpler','Проще'],['shorter','Короче'],['detailed','Подробнее'],['regenerate','Заново']];
      for (const [action, label] of items) {
        const btn = document.createElement('button'); btn.className = 'btn'; btn.textContent = label;
        btn.addEventListener('click', () => {
          const requestId = crypto.randomUUID();
          current = { requestId, rect: current?.rect || null, source: 'LOCAL', showFollowups, mode: current?.mode || 'lite', bubbleTheme: current?.bubbleTheme || 'auto' };
          if (lastRequest) lastRequest.requestId = requestId;
          showBubble({ requestId, rect: current.rect, loading: true, showFollowups, bubbleTheme: current.bubbleTheme });
          chrome.runtime.sendMessage({ type: 'AIHINT_FOLLOWUP', requestId, action, original: lastRequest.original, previousAnswer: lastRequest.answer || '' });
        });
        container.appendChild(btn);
      }
    }
    const copy = document.createElement('button'); copy.className = 'btn'; copy.textContent = 'Копировать';
    copy.addEventListener('click', async () => {
      const answer = container.closest('.card')?.querySelector('.answer')?.textContent || '';
      if (!answer) return;
      const copied = await copyText(answer);
      copy.textContent = copied ? 'Скопировано ✓' : 'Не удалось скопировать';
      setTimeout(() => { if (copy.isConnected) copy.textContent = 'Копировать'; }, 1100);
    });
    container.appendChild(copy);
  }

  function runEditableAction(action) {
    if (!lastRequest?.editable) return;
    const requestId = crypto.randomUUID();
    lastRequest = { ...lastRequest, requestId, answer: '', inputAction: action };
    current = { requestId, rect: current?.rect || null, source: 'LOCAL', showFollowups: false, mode: current?.mode || 'lite', bubbleTheme: current?.bubbleTheme || 'auto' };
    showBubble({ requestId, rect: current.rect, loading: true, bubbleTheme: current.bubbleTheme });
    chrome.runtime.sendMessage({ type: 'AIHINT_SELECTED', requestId, text: lastRequest.original, action });
  }

  async function copyText(value) {
    try { await navigator.clipboard.writeText(value); return true; } catch {
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

  function position(wrap, rect) {
    const margin = 12;
    const bubbleW = Math.min(390, Math.max(84, wrap.getBoundingClientRect().width || 260));
    let x = rect ? rect.left + rect.width / 2 - bubbleW / 2 : window.innerWidth / 2 - bubbleW / 2;
    let y = rect ? rect.bottom + 10 : 80;
    if (x < margin) x = margin;
    if (x + bubbleW > window.innerWidth - margin) x = window.innerWidth - margin - bubbleW;
    const h = wrap.getBoundingClientRect().height || 80;
    if (y + h > window.innerHeight - margin) y = rect ? Math.max(margin, rect.top - h - 10) : margin;
    wrap.style.left = `${Math.round(x)}px`;
    wrap.style.top = `${Math.round(y)}px`;
  }

  function scheduleHide(ms = autoCloseMs) {
    clearTimeout(hideTimer); hideTimer = setTimeout(() => {
      const { shadow } = ensureHost();
      const wrap = shadow.querySelector('.wrap');
      if (!wrap.matches(':hover')) wrap.hidden = true;
    }, ms);
  }

  function sourceLabel(source) {
    return ({ local: 'LOCAL · Chrome AI', instant: 'INSTANT', openai: 'OPENAI', gemini: 'GEMINI', claude: 'CLAUDE', deepseek: 'DEEPSEEK', yandex: 'YANDEX' }[source] || 'AI HINT');
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
})();
