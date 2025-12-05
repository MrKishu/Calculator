/* script.js (debug-friendly)
   - Logs every button click and key press
   - Falls back to button.textContent if dataset.value missing
   - Normalizes operator symbols (÷ × − -> / * -)
   - Wrapped in DOMContentLoaded and guarded
*/

(function () {
  'use strict';

  // Global error handler
  window.addEventListener('error', function (ev) {
    console.error('Global JS error:', ev.message, 'at', ev.filename + ':' + ev.lineno + ':' + ev.colno);
  });

  document.addEventListener('DOMContentLoaded', () => {
    console.log('DEBUG: DOMContentLoaded - initializing calculator');

    // DOM refs
    const displayEl = document.getElementById('display');
    const currentEl = document.getElementById('current');
    const historyEl = document.getElementById('history');
    const buttons = Array.from(document.querySelectorAll('.btn'));

    if (!displayEl || !currentEl || !historyEl) {
      console.error('DEBUG: Missing display elements. Ensure IDs: display, current, history');
      return;
    }
    if (!buttons || buttons.length === 0) {
      console.error('DEBUG: No .btn elements found. Check your HTML buttons markup.');
      return;
    }

    // State
    let current = '0';
    let history = '';
    let consumedResult = false;

    // Utility: normalize visual operator symbols to JS symbols
    function normalizeVisual(s) {
      if (typeof s !== 'string') return s;
      return s.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').trim();
    }

    // Safe evaluator
    function safeEval(expr) {
      expr = normalizeVisual(expr);
      expr = expr.replace(/\s+/g, '');
      if (/[^0-9+\-*/().%]/.test(expr)) throw new Error('Invalid characters in expression');
      if (/([+\-*/%]{2,})/.test(expr) && !/(\(\-)|(^\-)/.test(expr)) throw new Error('Malformed expression');
      if (expr.length > 180) throw new Error('Expression too long');
      // eslint-disable-next-line no-new-func
      return Function('"use strict"; return (' + expr + ')')();
    }

    // UI helpers
    function refreshDisplay() {
      try {
        currentEl.style.transform = 'translateY(-6px)';
        setTimeout(() => { currentEl.style.transform = ''; }, 140);
        currentEl.textContent = current;
        historyEl.textContent = history;
        console.log('DEBUG: display updated -> current:', current, 'history:', history);
      } catch (err) {
        console.error('DEBUG refreshDisplay error:', err);
      }
    }

    function flashEquals() {
      try {
        currentEl.animate([
          { transform: 'scale(1)' },
          { transform: 'scale(1.03)' },
          { transform: 'scale(1)' }
        ], { duration: 300, easing: 'ease-out' });
      } catch (e) {}
    }

    function showError() {
      currentEl.textContent = 'Err';
      try {
        currentEl.animate([
          { transform: 'translateX(0)' },
          { transform: 'translateX(-8px)' },
          { transform: 'translateX(8px)' },
          { transform: 'translateX(0)' }
        ], { duration: 360 });
      } catch (e) {}
      setTimeout(() => { current = '0'; refreshDisplay(); }, 700);
    }

    // Core actions
    function appendDigit(d) {
      console.log('DEBUG action appendDigit(', d, ')');
      if (consumedResult) {
        current = (d === '.') ? '0.' : d;
        consumedResult = false;
        refreshDisplay();
        return;
      }
      if (current === '0' && d !== '.') current = d;
      else if (d === '.' && current.includes('.')) return;
      else current = current + d;
      refreshDisplay();
    }

    function applyOperator(op) {
      console.log('DEBUG action applyOperator(', op, ')');
      if (consumedResult) {
        history = current + op;
        consumedResult = false;
        current = '0';
        refreshDisplay();
        return;
      }
      if (/[+\-*/%]$/.test(history)) history = history.slice(0, -1) + op;
      else history = history + current + op;
      current = '0';
      refreshDisplay();
    }

    function doPercent() {
      console.log('DEBUG action percent');
      try {
        const val = safeEval(current);
        current = String(val / 100);
        refreshDisplay();
      } catch (e) {
        console.error('DEBUG percent error:', e);
        showError();
      }
    }

    function backspace() {
      console.log('DEBUG action backspace');
      if (consumedResult) {
        current = '0';
        consumedResult = false;
        refreshDisplay();
        return;
      }
      current = (current.length <= 1) ? '0' : current.slice(0, -1);
      refreshDisplay();
    }

    function clearAll() {
      console.log('DEBUG action clearAll');
      current = '0'; history = ''; consumedResult = false; refreshDisplay();
    }

    function evaluateExpression() {
      console.log('DEBUG action evaluateExpression');
      try {
        let expr = (history || '') + current;
        expr = normalizeVisual(expr);
        if (!expr) return;
        const result = safeEval(expr);
        if (!isFinite(result)) throw new Error('Result not finite');
        const out = Number.isInteger(result) ? String(result) : String(parseFloat(result.toFixed(10)).toString());
        history = expr + ' =';
        current = out;
        consumedResult = true;
        refreshDisplay();
        flashEquals();
      } catch (e) {
        console.error('DEBUG evaluate error:', e);
        showError();
      }
    }

    // Helper to resolve button "value"
    function resolveButtonValue(btn) {
      // Prefer data-value attribute; fallback to textContent trimmed.
      const dataVal = typeof btn.dataset.value !== 'undefined' ? btn.dataset.value : null;
      const raw = (dataVal !== null && dataVal !== '') ? dataVal : (btn.textContent || '').trim();
      return normalizeVisual(raw);
    }

    // Attach click listeners
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action || null;
        const v = resolveButtonValue(btn);
        console.log('DEBUG click:', { text: btn.textContent.trim(), dataValue: btn.dataset.value, resolved: v, action });

        // Visual pulse (non-critical)
        try {
          btn.animate([
            { transform: 'translateY(0)' },
            { transform: 'translateY(4px)' },
            { transform: 'translateY(0)' }
          ], { duration: 160, easing: 'ease-out' });
        } catch (e) {}

        if (action === 'clear') { clearAll(); return; }
        if (action === 'back') { backspace(); return; }
        if (action === 'percent') { doPercent(); return; }
        if (action === 'equals') { evaluateExpression(); return; }

        if (btn.classList.contains('num')) {
          appendDigit(v);
        } else if (btn.classList.contains('op')) {
          applyOperator(v);
        } else {
          // fallback: if resolved value looks numeric, append; if operator-like, apply operator
          if (/^[0-9.]$/.test(v)) appendDigit(v);
          else if (/^[+\-*/%]$/.test(v)) applyOperator(v);
          else console.warn('DEBUG unknown button type for value:', v);
        }
      });
    });

    // Keyboard support (with logging)
    window.addEventListener('keydown', (e) => {
      if ([' ', 'Enter', 'Backspace', 'Escape'].includes(e.key)) e.preventDefault();
      console.log('DEBUG keydown:', e.key);

      if ((e.key >= '0' && e.key <= '9') || e.key === '.') { appendDigit(e.key); highlightKey(e.key); return; }
      if (e.key === 'Enter' || e.key === '=') { evaluateExpression(); highlightKey('='); return; }
      if (e.key === 'Backspace') { backspace(); highlightKey('backspace'); return; }
      if (e.key === 'Escape') { clearAll(); highlightKey('esc'); return; }
      if (['+', '-', '*', '/'].includes(e.key)) { applyOperator(e.key); highlightKey(e.key); return; }
      if (e.key === '%') { doPercent(); highlightKey('%'); return; }
    });

    function highlightKey(k) {
      let selector;
      if (k === 'backspace') selector = '[data-action="back"]';
      else if (k === 'esc') selector = '[data-action="clear"]';
      else if (k === '=') selector = '[data-action="equals"]';
      else selector = `[data-value="${k}"], button[data-value="${k}"]`;
      const btn = document.querySelector(selector) || document.querySelector(`[data-value="${normalizeVisual(k)}"]`);
      if (!btn) return;
      btn.classList.add('flash');
      setTimeout(() => btn.classList.remove('flash'), 160);
    }

    // Initial render
    refreshDisplay();
    console.log('DEBUG: Calculator initialized. Buttons found:', buttons.length);
  }); // DOMContentLoaded
})()
