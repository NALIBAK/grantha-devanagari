/**
 * grantha-keyboard.js
 * On-screen Grantha Unicode keyboard — Samsung Sanskrit keyboard style.
 *
 * Layout:
 *   LEFT (3 cols × 5 rows): Mode-driven panel
 *     • CON mode + consonant active → shows that consonant + 15 matra combos
 *     • VOW mode → shows standalone vowels / specials (always)
 *     • MAT mode → shows standalone matra diacritics (always)
 *     • CON mode + no consonant → shows standalone vowels
 *   RIGHT (7 cols × 5 rows): Static consonant grid in Sanskrit varga order
 *   BOTTOM BAR: [VOW] [CON] [MAT] | [── 𑌗𑍍𑌰𑌨𑍍𑌥 ──] | [।] [↵]
 *
 * Mode buttons (replace the old !#1 / 🌐 / 😊):
 *   VOW — force left panel to standalone vowels
 *   CON — consonant mode (default): dynamic matra panel after tapping a consonant
 *   MAT — force left panel to bare matra diacritics
 *
 * Tapping a right-panel consonant always auto-switches to CON mode.
 * System keyboard suppressed via inputmode="none".
 */

const GranthaKeyboard = (() => {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  //  Grantha Unicode Data
  // ═══════════════════════════════════════════════════════════════════════════

  const CONSONANT_GRID = [
    ['𑌕', '𑌚', '𑌟', '𑌤', '𑌪', '𑌯', '𑌶'],
    ['𑌖', '𑌛', '𑌠', '𑌥', '𑌫', '𑌰', '𑌷'],
    ['𑌗', '𑌜', '𑌡', '𑌦', '𑌬', '𑌲', '𑌹'],
    ['𑌘', '𑌝', '𑌢', '𑌧', '𑌭', '𑌵', '𑌽'],
    ['𑌙', '𑌞', '𑌣', '𑌨', '𑌮', '𑌸', '𑌳'], // 𑌳 = Grantha ḷa
  ];

  const CONSONANT_SET = new Set([
    '𑌕','𑌖','𑌗','𑌘','𑌙',
    '𑌚','𑌛','𑌜','𑌝','𑌞',
    '𑌟','𑌠','𑌡','𑌢','𑌣',
    '𑌤','𑌥','𑌦','𑌧','𑌨',
    '𑌪','𑌫','𑌬','𑌭','𑌮',
    '𑌯','𑌰','𑌲','𑌳','𑌴',
    '𑌵','𑌶','𑌷','𑌸','𑌹',
    '𑌽',
  ]);

  /**
   * CON mode matra slots — shown when a consonant is pending.
   * Col layout:  anusvara | bare-a | ā
   *              visarga  | i      | ī
   *              chandrab | u      | ū
   *              ṛ        | e      | ai
   *              virama   | o      | au
   */
  const MATRA_SLOTS = [
    { suffix: '𑌂',  label: 'anusvara'      },
    { suffix: '',   label: 'inherent a'     },
    { suffix: '𑌾',  label: 'ā'             },
    { suffix: '𑌃',  label: 'visarga'       },
    { suffix: '𑌿',  label: 'i'             },
    { suffix: '𑍀',  label: 'ī'             },
    { suffix: '𑌁',  label: 'chandrabindu'  },
    { suffix: '𑍁',  label: 'u'             },
    { suffix: '𑍂',  label: 'ū'             },
    { suffix: '𑍃',  label: 'ṛ'             },
    { suffix: '𑍇',  label: 'e'             },
    { suffix: '𑍈',  label: 'ai'            },
    { suffix: '𑍍',  label: 'virama/halant' },
    { suffix: '𑍋',  label: 'o'             },
    { suffix: '𑍌',  label: 'au'            },
  ];

  /** VOW mode — standalone vowels & special characters. */
  const STANDALONE_VOWELS = [
    { char: '𑌂',  label: 'Anusvara (ṃ)'     },
    { char: '𑌅',  label: 'a'                },
    { char: '𑌆',  label: 'ā'                },
    { char: '𑌃',  label: 'Visarga (ḥ)'      },
    { char: '𑌇',  label: 'i'                },
    { char: '𑌈',  label: 'ī'                },
    { char: '𑌁',  label: 'Chandrabindu'     },
    { char: '𑌉',  label: 'u'                },
    { char: '𑌊',  label: 'ū'                },
    { char: '𑌋',  label: 'vocalic ṛ'        },
    { char: '𑌌',  label: 'vocalic ḷ'        },
    { char: '𑍍',  label: 'Virama / Halanta' },
    { char: '𑌏',  label: 'e'                },
    { char: '𑌓',  label: 'o'                },
    { char: '𑌔',  label: 'au'               },
  ];

  /**
   * MAT mode — standalone matra diacritics (attach to existing consonant in text).
   * Useful for adding a matra to a consonant the user already typed elsewhere.
   */
  const STANDALONE_MATRAS = [
    { char: '𑌾',  label: 'matra ā'          },
    { char: '𑌿',  label: 'matra i'          },
    { char: '𑍀',  label: 'matra ī'          },
    { char: '𑍁',  label: 'matra u'          },
    { char: '𑍂',  label: 'matra ū'          },
    { char: '𑍃',  label: 'matra ṛ'          },
    { char: '𑍄',  label: 'matra ṝ'          },
    { char: '𑍇',  label: 'matra e'          },
    { char: '𑍈',  label: 'matra ai'         },
    { char: '𑍋',  label: 'matra o'          },
    { char: '𑍌',  label: 'matra au'         },
    { char: '𑌂',  label: 'Anusvara (ṃ)'     },
    { char: '𑌃',  label: 'Visarga (ḥ)'      },
    { char: '𑌁',  label: 'Chandrabindu'     },
    { char: '𑍍',  label: 'Virama / Halanta' },
  ];

  /**
   * SPC mode — special characters panel.
   * 15 slots: first two populated, rest empty (to be filled later).
   */
  const SPECIAL_CHARS = [
    { char: 'ஸ்ரீ', label: 'Tamil Śrī'         },
    { char: '',     label: ''                   },
    { char: '',     label: ''                   },
    { char: '',     label: ''                   },
    { char: '',     label: ''                   },
    { char: '',     label: ''                   },
    { char: '',     label: ''                   },
    { char: '',     label: ''                   },
    { char: '',     label: ''                   },
    { char: '',     label: ''                   },
    { char: '',     label: ''                   },
    { char: '',     label: ''                   },
    { char: '',     label: ''                   },
    { char: '',     label: ''                   },
    { char: '',     label: ''                   },
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  //  State
  // ═══════════════════════════════════════════════════════════════════════════

  let textarea    = null;
  let keyboard    = null;
  let leftPanelEl = null;

  let lastConsonant = null;
  let lastInserted  = null;
  let suppressInput = false;
  let blurTimer     = null;

  /**
   * kbMode controls what the left panel shows:
   *   'con' — default: dynamic (matra combos after consonant, or vowels)
   *   'vow' — forced standalone vowels
   *   'mat' — forced standalone matra diacritics
   */
  let kbMode = 'con';

  // ═══════════════════════════════════════════════════════════════════════════
  //  Textarea helpers
  // ═══════════════════════════════════════════════════════════════════════════

  function triggerChange() {
    suppressInput = true;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    suppressInput = false;
  }

  function insertText(str) {
    const start = textarea.selectionStart;
    const end   = textarea.selectionEnd;
    const val   = textarea.value;
    textarea.value = val.slice(0, start) + str + val.slice(end);
    textarea.selectionStart = textarea.selectionEnd = start + str.length;
    triggerChange();
  }

  function backspace() {
    const pos = textarea.selectionStart;
    const val = textarea.value;
    if (pos === 0) return;

    const beforeCursor = val.slice(0, pos);
    const beforeArr    = [...beforeCursor];
    beforeArr.pop();
    const newBefore    = beforeArr.join('');

    textarea.value = newBefore + val.slice(pos);
    textarea.selectionStart = textarea.selectionEnd = newBefore.length;

    lastInserted  = null;
    lastConsonant = null;

    const newArr  = [...newBefore];
    const newLast = newArr[newArr.length - 1];
    if (newLast && CONSONANT_SET.has(newLast)) {
      lastConsonant = newLast;
      lastInserted  = newLast;
    }

    triggerChange();
    updateLeftPanel();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  Key handlers
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Tap a consonant from right panel:
   *   • Insert it, set as pending
   *   • Auto-switch to CON mode so matra panel appears immediately
   */
  function handleConsonant(char) {
    insertText(char);
    lastConsonant = char;
    lastInserted  = char;
    setMode('con');           // always switch to CON mode on consonant tap
  }

  /** Tap a matra combo from left panel (CON mode, consonant pending). */
  function handleMatraSlot(slot) {
    if (lastConsonant !== null && lastInserted !== null) {
      const pos      = textarea.selectionStart;
      const val      = textarea.value;
      const lastLen  = lastInserted.length;
      const before   = val.slice(0, pos - lastLen);
      const after    = val.slice(pos);
      const newCombo = lastConsonant + slot.suffix;
      textarea.value = before + newCombo + after;
      textarea.selectionStart = textarea.selectionEnd = before.length + newCombo.length;
      lastInserted = newCombo;
      triggerChange();
      updateLeftPanel();
    }
  }

  /** Tap a standalone vowel or matra diacritic (VOW / MAT mode, or CON with no pending). */
  function handleStandaloneChar(char) {
    insertText(char);
    // Keep lastConsonant so CON mode can continue if needed
    // but reset lastInserted since we just added something different
    lastInserted = null;
    if (kbMode !== 'con') lastConsonant = null;
    updateLeftPanel();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  Mode switching
  // ═══════════════════════════════════════════════════════════════════════════

  function setMode(mode) {
    kbMode = mode;
    // Update mode button highlights
    if (keyboard) {
      keyboard.querySelectorAll('.gk-mode-btn').forEach(btn => {
        btn.classList.toggle('gk-mode-btn--active', btn.dataset.mode === mode);
      });
    }
    updateLeftPanel();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  Left panel rendering
  // ═══════════════════════════════════════════════════════════════════════════

  function updateLeftPanel() {
    if (!leftPanelEl) return;
    while (leftPanelEl.firstChild) leftPanelEl.removeChild(leftPanelEl.firstChild);

    if (kbMode === 'vow') {
      // ── VOW mode: always show standalone vowels ─────────────────────────
      renderStandaloneList(STANDALONE_VOWELS);

    } else if (kbMode === 'mat') {
      // ── MAT mode: always show bare matra diacritics ─────────────────────
      renderStandaloneList(STANDALONE_MATRAS);

    } else if (kbMode === 'spc') {
      // ── SPC mode: special characters panel ──────────────────────────────
      renderStandaloneList(SPECIAL_CHARS);

    } else {
      // ── CON mode: dynamic ───────────────────────────────────────────────
      if (lastConsonant) {
        // Show consonant + matra combos
        MATRA_SLOTS.forEach(slot => {
          const displayStr = lastConsonant + slot.suffix;
          const btn = document.createElement('button');
          btn.className = 'gk-key gk-key--accent';
          btn.type      = 'button';
          btn.textContent = displayStr;
          btn.setAttribute('aria-label', `${lastConsonant} with ${slot.label}`);
          if (lastInserted === displayStr) btn.classList.add('gk-key--accent-active');
          btn.addEventListener('pointerdown', e => {
            e.preventDefault();
            handleMatraSlot(slot);
          });
          leftPanelEl.appendChild(btn);
        });
      } else {
        // No pending consonant — show standalone vowels as default
        renderStandaloneList(STANDALONE_VOWELS);
      }
    }
  }

  function renderStandaloneList(list) {
    list.forEach(item => {
      const btn = document.createElement('button');
      btn.className = 'gk-key gk-key--accent';
      btn.type      = 'button';
      btn.textContent = item.char;
      btn.setAttribute('aria-label', item.label || '');
      if (item.char) {
        btn.addEventListener('pointerdown', e => {
          e.preventDefault();
          handleStandaloneChar(item.char);
        });
      } else {
        btn.disabled = true;
        btn.style.opacity = '0';
        btn.style.pointerEvents = 'none';
      }
      leftPanelEl.appendChild(btn);
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  DOM Construction
  // ═══════════════════════════════════════════════════════════════════════════

  function buildKeyboard() {
    const existing = document.getElementById('granthaKeyboard');
    if (existing) existing.remove();

    const kb = document.createElement('div');
    kb.id = 'granthaKeyboard';
    kb.className = 'gk-keyboard';
    kb.setAttribute('role', 'toolbar');
    kb.setAttribute('aria-label', 'Grantha on-screen keyboard');

    // ── Body: left panel + right panel ──────────────────────────────────────
    const body = document.createElement('div');
    body.className = 'gk-body';

    const lp = document.createElement('div');
    lp.className = 'gk-left-panel';
    lp.id = 'gkLeftPanel';
    body.appendChild(lp);

    const rp = document.createElement('div');
    rp.className = 'gk-right-panel';

    CONSONANT_GRID.forEach(row => {
      row.forEach(char => {
        const btn = document.createElement('button');
        btn.className = 'gk-key gk-key--consonant';
        btn.type = 'button';
        btn.textContent = char;
        btn.setAttribute('aria-label', char);
        btn.addEventListener('pointerdown', e => {
          e.preventDefault();
          handleConsonant(char);
        });
        rp.appendChild(btn);
      });
    });

    body.appendChild(rp);
    kb.appendChild(body);

    // ── Bottom bar ───────────────────────────────────────────────────────────
    const bar = document.createElement('div');
    bar.className = 'gk-bottom-bar';

    // ── Mode buttons: VOW | CON | MAT | SPC ─────────────────────────────────
    const modes = [
      { mode: 'vow', label: 'VOW', title: 'Vowels — show standalone vowels' },
      { mode: 'con', label: 'CON', title: 'Consonants — dynamic matra panel' },
      { mode: 'mat', label: 'MAT', title: 'Matras — show bare matra diacritics' },
      { mode: 'spc', label: 'SPC', title: 'Special characters' },
    ];

    modes.forEach(({ mode, label, title }) => {
      const btn = document.createElement('button');
      btn.className = 'gk-key gk-key--action gk-mode-btn';
      btn.dataset.mode = mode;
      btn.type = 'button';
      btn.textContent = label;
      btn.setAttribute('aria-label', title);
      btn.setAttribute('title', title);
      if (mode === kbMode) btn.classList.add('gk-mode-btn--active');
      btn.addEventListener('pointerdown', e => {
        e.preventDefault();
        setMode(mode);
      });
      bar.appendChild(btn);
    });

    // ── Space bar ────────────────────────────────────────────────────────────
    const spaceBtn = document.createElement('button');
    spaceBtn.className = 'gk-key gk-key--space';
    spaceBtn.type = 'button';
    spaceBtn.textContent = '𑌗𑍍𑌰𑌨𑍍𑌥'; // "Grantha" in Grantha script
    spaceBtn.setAttribute('aria-label', 'Space');
    spaceBtn.addEventListener('pointerdown', e => {
      e.preventDefault();
      insertText(' ');
      lastConsonant = null;
      lastInserted  = null;
      if (kbMode === 'con') updateLeftPanel();
    });
    bar.appendChild(spaceBtn);

    // ── Danda (।) ────────────────────────────────────────────────────────────
    const dandaBtn = document.createElement('button');
    dandaBtn.className = 'gk-key gk-key--action gk-danda';
    dandaBtn.type = 'button';
    dandaBtn.innerHTML = '।';
    dandaBtn.setAttribute('aria-label', 'Danda (।)');
    dandaBtn.addEventListener('pointerdown', e => {
      e.preventDefault();
      insertText('।');
      lastConsonant = null;
      lastInserted  = null;
      updateLeftPanel();
    });
    bar.appendChild(dandaBtn);

    // ── Enter ────────────────────────────────────────────────────────────────
    const enterBtn = document.createElement('button');
    enterBtn.className = 'gk-key gk-key--action gk-enter';
    enterBtn.type = 'button';
    enterBtn.innerHTML = '&#8629;';
    enterBtn.setAttribute('aria-label', 'Return / New line');
    enterBtn.addEventListener('pointerdown', e => {
      e.preventDefault();
      insertText('\n');
      lastConsonant = null;
      lastInserted  = null;
      updateLeftPanel();
    });
    bar.appendChild(enterBtn);

    // ── Backspace ─────────────────────────────────────────────────────────────
    const bkspBtn = document.createElement('button');
    bkspBtn.className = 'gk-key gk-key--action gk-key--backspace';
    bkspBtn.type = 'button';
    bkspBtn.innerHTML = '&#x232B;';
    bkspBtn.setAttribute('aria-label', 'Backspace');
    bkspBtn.addEventListener('pointerdown', e => { e.preventDefault(); backspace(); });
    bar.appendChild(bkspBtn);

    kb.appendChild(bar);

    document.body.appendChild(kb);
    keyboard    = kb;
    leftPanelEl = lp;

    updateLeftPanel();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  Show / Hide
  // ═══════════════════════════════════════════════════════════════════════════

  function syncFromCursor() {
    const pos    = textarea.selectionStart || textarea.value.length;
    const before = textarea.value.slice(0, pos);
    const arr    = [...before];
    const last   = arr[arr.length - 1];
    if (last && CONSONANT_SET.has(last)) {
      lastConsonant = last;
      lastInserted  = last;
    } else {
      lastConsonant = null;
      lastInserted  = null;
    }
    updateLeftPanel();
  }

  function show() {
    if (!keyboard) buildKeyboard();
    syncFromCursor();
    keyboard.classList.add('gk-keyboard--visible');
    document.body.classList.add('gk-open');
  }

  function hide() {
    if (!keyboard) return;
    keyboard.classList.remove('gk-keyboard--visible');
    document.body.classList.remove('gk-open');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  Initialise
  // ═══════════════════════════════════════════════════════════════════════════

  function init() {
    textarea = document.getElementById('granthaInput');
    if (!textarea) return;

    textarea.setAttribute('inputmode', 'none');

    textarea.addEventListener('focus', show);
    textarea.addEventListener('blur',  () => { blurTimer = setTimeout(hide, 200); });

    document.addEventListener('pointerdown', e => {
      if (keyboard && keyboard.contains(e.target)) {
        clearTimeout(blurTimer);
        requestAnimationFrame(() => textarea.focus({ preventScroll: true }));
      }
    }, true);

    textarea.addEventListener('click',  syncFromCursor);
    textarea.addEventListener('keyup',  syncFromCursor);
    textarea.addEventListener('input',  () => { if (!suppressInput) syncFromCursor(); });
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => GranthaKeyboard.init());
