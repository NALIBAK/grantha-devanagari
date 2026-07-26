/**
 * app.js
 * UI wiring for the Grantha ↔ Devanagari Translator.
 *
 * Responsibilities:
 *   - Bidirectional sync between the two input textareas
 *   - Updating the three output cards (IAST, Tamil, English)
 *   - Copy-to-clipboard for each card
 *   - Sample-word buttons
 *   - Dark / light theme toggle (persisted in localStorage)
 */

document.addEventListener('DOMContentLoaded', () => {

  // ── DOM references ──────────────────────────────────────────────────────────
  const granthaInput    = document.getElementById('granthaInput');
  const devanagariInput = document.getElementById('devanagariInput');
  const iastOutput      = document.getElementById('iastOutput');
  const tamilOutput     = document.getElementById('tamilOutput');
  const englishOutput   = document.getElementById('englishOutput');
  const themeToggle     = document.getElementById('themeToggle');
  const clearGrantha    = document.getElementById('clearGrantha');
  const clearDevanagari = document.getElementById('clearDevanagari');

  // ── Helpers ─────────────────────────────────────────────────────────────────

  /** Trigger a brief opacity-flash animation on an element. */
  function flash(el) {
    el.classList.remove('flash');
    void el.offsetWidth;            // force reflow so CSS animation restarts
    el.classList.add('flash');
  }

  /** Render translation results into the three output cards. */
  function applyResult(result) {
    const cards = [
      { el: iastOutput,    text: result.iast },
      { el: tamilOutput,   text: result.tamil },
      { el: englishOutput, text: result.english },
    ];

    for (const { el, text } of cards) {
      const isEmpty = !text || !text.trim();
      el.textContent = isEmpty ? '—' : text;
      el.classList.toggle('is-empty', isEmpty);
      flash(el);
    }
  }

  // ── Bidirectional Translation ───────────────────────────────────────────────
  // The `busy` flag prevents the pair of `input` listeners from triggering
  // each other in an infinite loop when one textarea updates the other.

  let busy = false;

  granthaInput.addEventListener('input', () => {
    if (busy) return;
    busy = true;
    try {
      const result = Translator.fromGrantha(granthaInput.value);
      devanagariInput.value = result.devanagari;
      applyResult(result);
    } finally {
      busy = false;
    }
  });

  devanagariInput.addEventListener('input', () => {
    if (busy) return;
    busy = true;
    try {
      const result = Translator.fromDevanagari(devanagariInput.value);
      granthaInput.value = result.grantha;
      applyResult(result);
    } finally {
      busy = false;
    }
  });

  // ── Clear Buttons ───────────────────────────────────────────────────────────

  function clearAll(focusTarget) {
    granthaInput.value    = '';
    devanagariInput.value = '';
    applyResult({ iast: '', tamil: '', english: '' });
    focusTarget.focus();
  }

  clearGrantha.addEventListener('click',    () => clearAll(granthaInput));
  clearDevanagari.addEventListener('click', () => clearAll(devanagariInput));

  // ── Copy Buttons ────────────────────────────────────────────────────────────

  function bindCopy(btnId, getContent) {
    const btn = document.getElementById(btnId);
    btn.addEventListener('click', async () => {
      const text = getContent();
      if (!text || text === '—') return;

      try {
        await navigator.clipboard.writeText(text);
        const orig = btn.textContent;
        btn.textContent = '✓ Copied';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = orig;
          btn.classList.remove('copied');
        }, 2200);
      } catch {
        /* clipboard access denied — silently ignore */
      }
    });
  }

  bindCopy('copyIAST',    () => iastOutput.textContent);
  bindCopy('copyTamil',   () => tamilOutput.textContent);
  bindCopy('copyEnglish', () => englishOutput.textContent);

  // ── Sample Word Buttons ──────────────────────────────────────────────────────

  document.querySelectorAll('.sample-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const g = btn.dataset.grantha;
      const d = btn.dataset.devanagari;

      if (g) {
        granthaInput.value = g;
        // Dispatch 'input' so the listener runs and updates everything
        granthaInput.dispatchEvent(new Event('input'));
        granthaInput.focus();
      } else if (d) {
        devanagariInput.value = d;
        devanagariInput.dispatchEvent(new Event('input'));
        devanagariInput.focus();
      }
    });
  });

  // ── Theme Toggle ─────────────────────────────────────────────────────────────

  const THEME_KEY = 'gd-translator-theme';

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
    themeToggle.setAttribute('aria-label',
      theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  }

  // Restore saved theme (fallback: dark)
  applyTheme(localStorage.getItem(THEME_KEY) || 'dark');

  themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next    = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem(THEME_KEY, next);
  });

});
