/**
 * app.js
 * UI wiring for the Grantha ↔ Devanagari ↔ Tamil ↔ English Translator.
 *
 * Responsibilities:
 *   - Real-time 4-way bidirectional sync between Grantha, Devanagari, Tamil, and English textareas
 *   - Updating the IAST output card
 *   - Copy-to-clipboard for each script panel and IAST
 *   - Sample-word buttons
 *   - Dark / light theme toggle (persisted in localStorage)
 */

document.addEventListener('DOMContentLoaded', () => {

  // ── DOM references ──────────────────────────────────────────────────────────
  const granthaInput    = document.getElementById('granthaInput');
  const devanagariInput = document.getElementById('devanagariInput');
  const tamilInput      = document.getElementById('tamilInput');
  const englishInput    = document.getElementById('englishInput');
  const iastOutput      = document.getElementById('iastOutput');

  const themeToggle     = document.getElementById('themeToggle');

  const clearGrantha    = document.getElementById('clearGrantha');
  const clearDevanagari = document.getElementById('clearDevanagari');
  const clearTamil      = document.getElementById('clearTamil');
  const clearEnglish    = document.getElementById('clearEnglish');

  // ── Helpers ─────────────────────────────────────────────────────────────────

  /** Trigger a brief opacity-flash animation on an element. */
  function flash(el) {
    if (!el) return;
    el.classList.remove('flash');
    void el.offsetWidth;            // force reflow so CSS animation restarts
    el.classList.add('flash');
  }

  /** Render translation results into the output card. */
  function applyResult(result) {
    if (!iastOutput) return;
    const text = result.iast;
    const isEmpty = !text || !text.trim();
    iastOutput.textContent = isEmpty ? '—' : text;
    iastOutput.classList.toggle('is-empty', isEmpty);
    flash(iastOutput);
  }

  // ── 4-Way Bidirectional Translation ─────────────────────────────────────────
  // The `busy` flag prevents input listeners from triggering each other recursively.

  let busy = false;

  granthaInput.addEventListener('input', () => {
    if (busy) return;
    busy = true;
    try {
      const result = Translator.fromGrantha(granthaInput.value);
      devanagariInput.value = result.devanagari;
      tamilInput.value      = result.tamil;
      englishInput.value    = result.english;
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
      tamilInput.value   = result.tamil;
      englishInput.value = result.english;
      applyResult(result);
    } finally {
      busy = false;
    }
  });

  tamilInput.addEventListener('input', () => {
    if (busy) return;
    busy = true;
    try {
      const result = Translator.fromTamil(tamilInput.value);
      granthaInput.value    = result.grantha;
      devanagariInput.value = result.devanagari;
      englishInput.value    = result.english;
      applyResult(result);
    } finally {
      busy = false;
    }
  });

  englishInput.addEventListener('input', () => {
    if (busy) return;
    busy = true;
    try {
      const result = Translator.fromEnglish(englishInput.value);
      granthaInput.value    = result.grantha;
      devanagariInput.value = result.devanagari;
      tamilInput.value      = result.tamil;
      applyResult(result);
    } finally {
      busy = false;
    }
  });

  // ── Clear Buttons ───────────────────────────────────────────────────────────

  function clearAll(focusTarget) {
    granthaInput.value    = '';
    devanagariInput.value = '';
    tamilInput.value      = '';
    englishInput.value    = '';
    applyResult({ iast: '' });
    if (focusTarget) focusTarget.focus();
  }

  if (clearGrantha)    clearGrantha.addEventListener('click',    () => clearAll(granthaInput));
  if (clearDevanagari) clearDevanagari.addEventListener('click', () => clearAll(devanagariInput));
  if (clearTamil)      clearTamil.addEventListener('click',      () => clearAll(tamilInput));
  if (clearEnglish)    clearEnglish.addEventListener('click',    () => clearAll(englishInput));

  // ── Copy Buttons ────────────────────────────────────────────────────────────

  function bindCopy(btnId, getContent) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
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

  bindCopy('copyGrantha',    () => granthaInput.value);
  bindCopy('copyDevanagari', () => devanagariInput.value);
  bindCopy('copyTamil',      () => tamilInput.value);
  bindCopy('copyEnglish',    () => englishInput.value);
  bindCopy('copyIAST',       () => iastOutput.textContent);

  // ── Sample Word Buttons ──────────────────────────────────────────────────────

  document.querySelectorAll('.sample-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const g = btn.dataset.grantha;
      const d = btn.dataset.devanagari;
      const t = btn.dataset.tamil;
      const e = btn.dataset.english;

      if (g) {
        granthaInput.value = g;
        granthaInput.dispatchEvent(new Event('input'));
        granthaInput.focus();
      } else if (d) {
        devanagariInput.value = d;
        devanagariInput.dispatchEvent(new Event('input'));
        devanagariInput.focus();
      } else if (t) {
        tamilInput.value = t;
        tamilInput.dispatchEvent(new Event('input'));
        tamilInput.focus();
      } else if (e) {
        englishInput.value = e;
        englishInput.dispatchEvent(new Event('input'));
        englishInput.focus();
      }
    });
  });

  // ── Theme Toggle ─────────────────────────────────────────────────────────────

  const THEME_KEY = 'gd-translator-theme';

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    if (themeToggle) {
      themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
      themeToggle.setAttribute('aria-label',
        theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    }
  }

  // Restore saved theme (fallback: dark)
  applyTheme(localStorage.getItem(THEME_KEY) || 'dark');

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next    = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      localStorage.setItem(THEME_KEY, next);
    });
  }

});

