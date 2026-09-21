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
 *   - Auto-save textarea content to localStorage (survives back-button / reload)
 *   - History API guard (first back-button press stays on page)
 *   - Anonymous translation logging to Supabase (no Google, insert-only RLS)
 */

// ── Supabase Analytics Config ──────────────────────────────────────────────────
// anon/publishable key — safe to be in public code because RLS blocks all reads.
// NEVER put the service_role key here.
const SUPABASE_URL  = 'https://ixavrsafjjfpyidkkdom.supabase.co';
const SUPABASE_ANON = 'sb_publishable_54pPxPH9xkTTYcsdwuaYLQ_VGx_M6f0';

// ── Translation Logger ─────────────────────────────────────────────────────────
// Debounced: only fires 1.5 s after the user stops typing to avoid flooding.
let _logTimer = null;

async function logTranslation(inputScript, inputText, result) {
  if (!inputText || inputText.trim().length < 2) return; // skip empty / single-char

  clearTimeout(_logTimer);
  _logTimer = setTimeout(async () => {
    try {
      const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
      await fetch(`${SUPABASE_URL}/rest/v1/translation_logs`, {
        method : 'POST',
        headers: {
          'Content-Type' : 'application/json',
          'apikey'       : SUPABASE_ANON,
          'Authorization': `Bearer ${SUPABASE_ANON}`,
          'Prefer'       : 'return=minimal'   // don't send body back — faster
        },
        body: JSON.stringify({
          input_script : inputScript,
          input_text   : inputText.trim(),
          grantha_out  : result.grantha    || '',
          devnagari_out: result.devanagari || '',
          tamil_out    : result.tamil      || '',
          english_out  : result.english    || '',
          char_count   : inputText.trim().length,
          device_type  : isMobile ? 'mobile' : 'desktop',
          timezone     : Intl.DateTimeFormat().resolvedOptions().timeZone,
          browser_lang : navigator.language || ''
        })
      });
    } catch {
      // Silently ignore — never break the translator because of a logging failure
    }
  }, 1500);
}

// ─────────────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {

  // ── DOM references ──────────────────────────────────────────────────────────
  const granthaInput    = document.getElementById('granthaInput');
  const devanagariInput = document.getElementById('devanagariInput');
  const tamilInput      = document.getElementById('tamilInput');
  const englishInput    = document.getElementById('englishInput');
  const iastOutput      = document.getElementById('iastOutput');

  const themeToggle     = document.getElementById('themeToggle');
  const tamilModeToggle = document.getElementById('tamilModeToggle');

  const clearGrantha    = document.getElementById('clearGrantha');
  const clearDevanagari = document.getElementById('clearDevanagari');
  const clearTamil      = document.getElementById('clearTamil');
  const clearEnglish    = document.getElementById('clearEnglish');

  // ── Auto-save to localStorage (survives back button / page reload) ──────────
  const SAVE_KEY = 'gd-translator-saved';

  function saveState() {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      grantha   : granthaInput.value,
      devanagari: devanagariInput.value,
      tamil     : tamilInput.value,
      english   : englishInput.value
    }));
  }

  function restoreState() {
    try {
      const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
      // Restore only one panel (the one that was the source), then let it
      // drive the others via its input event.
      if (saved.grantha && saved.grantha.trim()) {
        granthaInput.value = saved.grantha;
        granthaInput.dispatchEvent(new Event('input'));
      } else if (saved.devanagari && saved.devanagari.trim()) {
        devanagariInput.value = saved.devanagari;
        devanagariInput.dispatchEvent(new Event('input'));
      } else if (saved.tamil && saved.tamil.trim()) {
        tamilInput.value = saved.tamil;
        tamilInput.dispatchEvent(new Event('input'));
      } else if (saved.english && saved.english.trim()) {
        englishInput.value = saved.english;
        englishInput.dispatchEvent(new Event('input'));
      }
    } catch { /* ignore corrupt saved data */ }
  }

  // ── History API Guard (back-button safety on mobile) ───────────────────────
  // When the user starts typing, we push an extra history entry.
  // First back-button press pops that entry (stays on the page).
  // Second press actually leaves — giving users a chance to catch the mistake.
  let historyGuardPushed = false;

  function pushHistoryGuard() {
    if (historyGuardPushed) return;
    history.pushState({ gdGuard: true }, '');
    historyGuardPushed = true;
  }

  window.addEventListener('popstate', (e) => {
    if (e.state && e.state.gdGuard) {
      // Guard entry was popped — reset so it can be pushed again if user retypes
      historyGuardPushed = false;
    }
  });

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

  // ── Tamil Mode A / B Toggle ───────────────────────────────────────────────────

  const TAMIL_MODE_KEY = 'gd-translator-tamil-mode';

  /**
   * Apply a Tamil mode, update the toggle button appearance, persist to
   * localStorage, inform the Translator engine, and re-render any current
   * text through the Tamil output.
   */
  function applyTamilMode(mode) {
    Translator.setTamilMode(mode);

    if (tamilModeToggle) {
      const isNumbered = (mode === 'numbered');
      const modeLabel  = tamilModeToggle.querySelector('.tamil-mode-label');
      if (modeLabel) modeLabel.textContent = isNumbered ? 'Numbered' : 'Standard';
      tamilModeToggle.setAttribute('aria-label',
        isNumbered
          ? 'Tamil Mode B: Numbered (க க₂ க₃ க₄) — click to switch to Standard'
          : 'Tamil Mode A: Standard (plain க) — click to switch to Numbered'
      );
      tamilModeToggle.title = isNumbered
        ? 'Mode B: Numbered (க க₂ க₃ க₄) — click to switch'
        : 'Mode A: Standard Tamil — click to switch';
      tamilModeToggle.classList.toggle('mode-standard', !isNumbered);
      tamilModeToggle.classList.toggle('mode-numbered',  isNumbered);
    }

    localStorage.setItem(TAMIL_MODE_KEY, mode);

    // Re-render: find which panel has content and re-drive translation
    if (busy) return;
    busy = true;
    try {
      if (granthaInput.value.trim()) {
        const r = Translator.fromGrantha(granthaInput.value);
        tamilInput.value = r.tamil;
        applyResult(r);
      } else if (devanagariInput.value.trim()) {
        const r = Translator.fromDevanagari(devanagariInput.value);
        tamilInput.value = r.tamil;
        applyResult(r);
      } else if (englishInput.value.trim()) {
        const r = Translator.fromEnglish(englishInput.value);
        tamilInput.value = r.tamil;
        applyResult(r);
      } else if (tamilInput.value.trim()) {
        // Tamil driving: re-tokenize with new mode output
        const r = Translator.fromTamil(tamilInput.value);
        tamilInput.value = r.tamil;
        applyResult(r);
      }
    } finally {
      busy = false;
    }
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
      saveState();
      logTranslation('grantha', granthaInput.value, result);
      if (granthaInput.value.trim().length > 0) pushHistoryGuard();
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
      saveState();
      logTranslation('devanagari', devanagariInput.value, result);
      if (devanagariInput.value.trim().length > 0) pushHistoryGuard();
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
      saveState();
      logTranslation('tamil', tamilInput.value, result);
      if (tamilInput.value.trim().length > 0) pushHistoryGuard();
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
      saveState();
      logTranslation('english', englishInput.value, result);
      if (englishInput.value.trim().length > 0) pushHistoryGuard();
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
    localStorage.removeItem(SAVE_KEY);  // clear saved state so restore doesn't bring it back
    historyGuardPushed = false;          // reset guard so next typing pushes it again
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

  // ── Tamil Mode Restore & Toggle ───────────────────────────────────────────────

  // Restore saved Tamil mode (default: 'numbered' = Mode B)
  applyTamilMode(localStorage.getItem(TAMIL_MODE_KEY) || 'numbered');

  if (tamilModeToggle) {
    tamilModeToggle.addEventListener('click', () => {
      const current = Translator.getTamilMode();
      const next    = (current === 'numbered') ? 'standard' : 'numbered';
      applyTamilMode(next);
    });
  }

  // ── Restore saved textarea content (must run after Tamil mode is set) ────────
  restoreState();

});
