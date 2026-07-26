/**
 * translator.js
 * Grantha ↔ Devanagari ↔ IAST ↔ Tamil ↔ English Transliteration Engine
 *
 * Architecture:
 *   Input (Grantha | Devanagari)
 *     → tokenize()  →  Token[]  (pivot: IAST consonant/vowel keys)
 *     → render*()   →  Output string per script
 *
 * Internal consonant keys used (never shown to user):
 *   'ḷc'  = Dravidian ḷ consonant (ள / 𑌳)  — distinct from vocalic vowel 'ḷ'
 *   'ḻ'   = Tamil zh consonant     (ழ / 𑌴)
 */

const Translator = (() => {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  //  Script Constants
  // ═══════════════════════════════════════════════════════════════════════════

  const G_VIRAMA       = '𑍍';  // U+1134D
  const G_ANUSVARA     = '𑌂';  // U+11302
  const G_VISARGA      = '𑌃';  // U+11303
  const G_CHANDRABINDU = '𑌁';  // U+11301
  const G_OM           = '𑍐';  // U+11350
  const G_AVAGRAHA     = '𑌽';  // U+1133D

  const D_VIRAMA       = '्';   // U+094D
  const D_ANUSVARA     = 'ं';   // U+0902
  const D_VISARGA      = 'ः';   // U+0903
  const D_CHANDRABINDU = 'ँ';   // U+0901
  const D_OM           = 'ॐ';   // U+0950
  const D_AVAGRAHA     = 'ऽ';   // U+093D

  // ═══════════════════════════════════════════════════════════════════════════
  //  Grantha → IAST Maps
  // ═══════════════════════════════════════════════════════════════════════════

  const G_VOWELS = new Map([
    ['𑌅','a'], ['𑌆','ā'], ['𑌇','i'], ['𑌈','ī'],
    ['𑌉','u'], ['𑌊','ū'], ['𑌋','ṛ'], ['𑌌','ḷ'],
    ['𑌏','e'], ['𑌐','ai'], ['𑌓','o'], ['𑌔','au'],
  ]);

  const G_MATRAS = new Map([
    ['𑌾','ā'],  ['𑌿','i'],  ['𑍀','ī'],  ['𑍁','u'],
    ['𑍂','ū'],  ['𑍃','ṛ'],  ['𑍄','ṝ'],
    ['𑍇','e'],  ['𑍈','ai'], ['𑍋','o'],  ['𑍌','au'],
  ]);

  const G_CONSONANTS = new Map([
    ['𑌕','k'],  ['𑌖','kh'], ['𑌗','g'],  ['𑌘','gh'], ['𑌙','ṅ'],
    ['𑌚','c'],  ['𑌛','ch'], ['𑌜','j'],  ['𑌝','jh'], ['𑌞','ñ'],
    ['𑌟','ṭ'],  ['𑌠','ṭh'], ['𑌡','ḍ'],  ['𑌢','ḍh'], ['𑌣','ṇ'],
    ['𑌤','t'],  ['𑌥','th'], ['𑌦','d'],  ['𑌧','dh'], ['𑌨','n'],
    ['𑌪','p'],  ['𑌫','ph'], ['𑌬','b'],  ['𑌭','bh'], ['𑌮','m'],
    ['𑌯','y'],  ['𑌰','r'],  ['𑌲','l'],  ['𑌳','ḷc'], ['𑌴','ḻ'],
    ['𑌵','v'],  ['𑌶','ś'],  ['𑌷','ṣ'],  ['𑌸','s'],  ['𑌹','h'],
  ]);

  // ═══════════════════════════════════════════════════════════════════════════
  //  Devanagari → IAST Maps
  // ═══════════════════════════════════════════════════════════════════════════

  const D_VOWELS = new Map([
    ['अ','a'],  ['आ','ā'],  ['इ','i'],  ['ई','ī'],
    ['उ','u'],  ['ऊ','ū'],  ['ऋ','ṛ'],  ['ॠ','ṝ'],
    ['ऌ','ḷ'],  ['ए','e'],  ['ऐ','ai'], ['ओ','o'],  ['औ','au'],
  ]);

  const D_MATRAS = new Map([
    ['ा','ā'],  ['ि','i'],  ['ी','ī'],  ['ु','u'],
    ['ू','ū'],  ['ृ','ṛ'],  ['ॄ','ṝ'],
    ['े','e'],  ['ै','ai'], ['ो','o'],  ['ौ','au'],
  ]);

  const D_CONSONANTS = new Map([
    ['क','k'],  ['ख','kh'], ['ग','g'],  ['घ','gh'], ['ङ','ṅ'],
    ['च','c'],  ['छ','ch'], ['ज','j'],  ['झ','jh'], ['ञ','ñ'],
    ['ट','ṭ'],  ['ठ','ṭh'], ['ड','ḍ'],  ['ढ','ḍh'], ['ण','ṇ'],
    ['त','t'],  ['थ','th'], ['द','d'],  ['ध','dh'], ['न','n'],
    ['प','p'],  ['फ','ph'], ['ब','b'],  ['भ','bh'], ['म','m'],
    ['य','y'],  ['र','r'],  ['ल','l'],  ['ळ','ḷc'],
    ['व','v'],  ['श','ś'],  ['ष','ṣ'],  ['स','s'],  ['ह','h'],
  ]);

  // ═══════════════════════════════════════════════════════════════════════════
  //  IAST Keys → Target Script Maps
  // ═══════════════════════════════════════════════════════════════════════════

  /* ── Grantha ── */
  const IG_VOWEL = new Map([
    ['a','𑌅'],['ā','𑌆'],['i','𑌇'],['ī','𑌈'],['u','𑌉'],['ū','𑌊'],
    ['ṛ','𑌋'],['ṝ','𑌋'],['ḷ','𑌌'],['e','𑌏'],['ai','𑌐'],['o','𑌓'],['au','𑌔'],
  ]);
  const IG_MATRA = new Map([
    ['ā','𑌾'],['i','𑌿'],['ī','𑍀'],['u','𑍁'],['ū','𑍂'],
    ['ṛ','𑍃'],['ṝ','𑍄'],['e','𑍇'],['ai','𑍈'],['o','𑍋'],['au','𑍌'],
  ]);
  const IG_CONS = new Map([
    ['k','𑌕'],['kh','𑌖'],['g','𑌗'],['gh','𑌘'],['ṅ','𑌙'],
    ['c','𑌚'],['ch','𑌛'],['j','𑌜'],['jh','𑌝'],['ñ','𑌞'],
    ['ṭ','𑌟'],['ṭh','𑌠'],['ḍ','𑌡'],['ḍh','𑌢'],['ṇ','𑌣'],
    ['t','𑌤'],['th','𑌥'],['d','𑌦'],['dh','𑌧'],['n','𑌨'],
    ['p','𑌪'],['ph','𑌫'],['b','𑌬'],['bh','𑌭'],['m','𑌮'],
    ['y','𑌯'],['r','𑌰'],['l','𑌲'],['ḷc','𑌳'],['ḻ','𑌴'],
    ['v','𑌵'],['ś','𑌶'],['ṣ','𑌷'],['s','𑌸'],['h','𑌹'],
  ]);

  /* ── Devanagari ── */
  const ID_VOWEL = new Map([
    ['a','अ'],['ā','आ'],['i','इ'],['ī','ई'],['u','उ'],['ū','ऊ'],
    ['ṛ','ऋ'],['ṝ','ॠ'],['ḷ','ऌ'],['e','ए'],['ai','ऐ'],['o','ओ'],['au','औ'],
  ]);
  const ID_MATRA = new Map([
    ['ā','ा'],['i','ि'],['ī','ी'],['u','ु'],['ū','ू'],
    ['ṛ','ृ'],['ṝ','ॄ'],['e','े'],['ai','ै'],['o','ो'],['au','ौ'],
  ]);
  const ID_CONS = new Map([
    ['k','क'],['kh','ख'],['g','ग'],['gh','घ'],['ṅ','ङ'],
    ['c','च'],['ch','छ'],['j','ज'],['jh','झ'],['ñ','ञ'],
    ['ṭ','ट'],['ṭh','ठ'],['ḍ','ड'],['ḍh','ढ'],['ṇ','ण'],
    ['t','त'],['th','थ'],['d','द'],['dh','ध'],['n','न'],
    ['p','प'],['ph','फ'],['b','ब'],['bh','भ'],['m','म'],
    ['y','य'],['r','र'],['l','ल'],['ḷc','ळ'],['ḻ','ल'],
    ['v','व'],['ś','श'],['ṣ','ष'],['s','स'],['h','ह'],
  ]);

  /* ── Tamil ──
     Sanskrit 'e' and 'o' are always long in Sanskrit/Grantha context → ே / ோ
     Sanskrit consonant groups map to single Tamil base letter (phonological merger)
     Sanskrit-specific sounds use Grantha-Tamil hybrid letters: ஜ ஶ ஷ ஸ ஹ         */
  const IT_VOWEL = new Map([
    ['a','அ'],['ā','ஆ'],['i','இ'],['ī','ஈ'],['u','உ'],['ū','ஊ'],
    ['ṛ','ரு'],['ṝ','ரூ'],['ḷ','லு'],['e','ஏ'],['ai','ஐ'],['o','ஓ'],['au','ஔ'],
  ]);
  const IT_MATRA = new Map([
    ['ā','ா'],['i','ி'],['ī','ீ'],['u','ு'],['ū','ூ'],
    ['ṛ','ு'],['ṝ','ூ'],['e','ே'],['ai','ை'],['o','ோ'],['au','ௌ'],
  ]);
  const IT_CONS = new Map([
    ['k','க'],['kh','க'],['g','க'],['gh','க'],['ṅ','ங'],
    ['c','ச'],['ch','ச'],['j','ஜ'],['jh','ஜ'],['ñ','ஞ'],
    ['ṭ','ட'],['ṭh','ட'],['ḍ','ட'],['ḍh','ட'],['ṇ','ண'],
    ['t','த'],['th','த'],['d','த'],['dh','த'],['n','ந'],
    ['p','ப'],['ph','ப'],['b','ப'],['bh','ப'],['m','ம'],
    ['y','ய'],['r','ர'],['l','ல'],['ḷc','ள'],['ḻ','ழ'],
    ['v','வ'],['ś','ஶ'],['ṣ','ஷ'],['s','ஸ'],['h','ஹ'],
  ]);

  /* ── English (simple ASCII transliteration) ── */
  const IE_VOWEL = new Map([
    ['a','a'],['ā','aa'],['i','i'],['ī','ii'],['u','u'],['ū','uu'],
    ['ṛ','ri'],['ṝ','rii'],['ḷ','l'],['e','e'],['ai','ai'],['o','o'],['au','au'],
  ]);
  const IE_CONS = new Map([
    ['k','k'],['kh','kh'],['g','g'],['gh','gh'],['ṅ','n'],
    ['c','ch'],['ch','chh'],['j','j'],['jh','jh'],['ñ','n'],
    ['ṭ','t'],['ṭh','th'],['ḍ','d'],['ḍh','dh'],['ṇ','n'],
    ['t','t'],['th','th'],['d','d'],['dh','dh'],['n','n'],
    ['p','p'],['ph','ph'],['b','b'],['bh','bh'],['m','m'],
    ['y','y'],['r','r'],['l','l'],['ḷc','l'],['ḻ','zh'],
    ['v','v'],['ś','sh'],['ṣ','sh'],['s','s'],['h','h'],
  ]);

  /* IAST display fix: internal keys → visible IAST characters */
  const IAST_FIX = new Map([['ḷc','ḷ'], ['ḻ','ḻ']]);

  // ═══════════════════════════════════════════════════════════════════════════
  //  Tokenizer
  //  Produces an array of Tokens from a source script string.
  //
  //  Token shapes:
  //    { type:'syllable',  consonants:[iast_key, ...], vowel: iast_vowel }
  //      vowel=''  → pure consonant (explicit virama / halant at end of cluster)
  //      vowel='a' → implicit inherent 'a'
  //    { type:'vowel',    vowel: iast_vowel }   — standalone vowel
  //    { type:'modifier', value: 'ṃ'|'ḥ'|'m̐' } — anusvara / visarga / chandrabindu
  //    { type:'special',  value: 'oṃ' }         — OM symbol
  //    { type:'other',    value: string }        — space / punct / ASCII etc.
  // ═══════════════════════════════════════════════════════════════════════════

  function tokenize(text, CONS_MAP, MATRA_MAP, VOWEL_MAP,
                    VIRAMA, ANUSVARA, VISARGA, CHANDRABINDU) {
    const tokens = [];
    // [...text] yields Unicode code points (handles Grantha surrogate pairs)
    const chars  = [...text];
    const n      = chars.length;
    let i = 0;

    while (i < n) {
      const ch = chars[i];

      // ── Modifiers ──────────────────────────────────────────────────────────
      if (ch === ANUSVARA)     { tokens.push({ type:'modifier', value:'ṃ' });  i++; continue; }
      if (ch === VISARGA)      { tokens.push({ type:'modifier', value:'ḥ' });  i++; continue; }
      if (ch === CHANDRABINDU) { tokens.push({ type:'modifier', value:'m̐' }); i++; continue; }

      // ── OM symbol ──────────────────────────────────────────────────────────
      if (ch === G_OM || ch === D_OM) {
        tokens.push({ type:'special', value:'oṃ' }); i++; continue;
      }

      // ── Avagraha ───────────────────────────────────────────────────────────
      if (ch === G_AVAGRAHA || ch === D_AVAGRAHA) {
        tokens.push({ type:'other', value:'\'' }); i++; continue;
      }

      // ── Consonant (+ optional conjunct chain + optional vowel sign) ────────
      if (CONS_MAP.has(ch)) {
        const consList = [CONS_MAP.get(ch)];
        i++;

        // Consume virama + following consonant chains (conjuncts)
        while (
          i < n &&
          chars[i] === VIRAMA &&
          i + 1 < n &&
          CONS_MAP.has(chars[i + 1])
        ) {
          i++;                              // consume virama
          consList.push(CONS_MAP.get(chars[i]));
          i++;
        }

        // Determine the vowel following the cluster
        let vowel = 'a'; // default: implicit inherent 'a'
        if (i < n && chars[i] === VIRAMA) {
          vowel = '';     // explicit virama (halant) — pure consonant, no vowel
          i++;
        } else if (i < n && MATRA_MAP.has(chars[i])) {
          vowel = MATRA_MAP.get(chars[i]);
          i++;
        }

        tokens.push({ type:'syllable', consonants: consList, vowel });
        continue;
      }

      // ── Standalone vowel ───────────────────────────────────────────────────
      if (VOWEL_MAP.has(ch)) {
        tokens.push({ type:'vowel', vowel: VOWEL_MAP.get(ch) });
        i++; continue;
      }

      // ── Orphan virama (skip silently) ──────────────────────────────────────
      if (ch === VIRAMA) { i++; continue; }

      // ── Everything else (space, punctuation, ASCII, digits, newlines) ──────
      tokens.push({ type:'other', value: ch });
      i++;
    }

    return tokens;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  Renderers:  Token[] → target script string
  // ═══════════════════════════════════════════════════════════════════════════

  function renderGrantha(tokens) {
    let out = '';
    for (const tok of tokens) {
      switch (tok.type) {
        case 'syllable': {
          const cons = tok.consonants.map(c => IG_CONS.get(c) ?? '');
          out += cons.join(G_VIRAMA);
          if      (tok.vowel === '')  out += G_VIRAMA;
          else if (tok.vowel !== 'a') out += IG_MATRA.get(tok.vowel) ?? '';
          break;
        }
        case 'vowel':
          out += IG_VOWEL.get(tok.vowel) ?? tok.vowel; break;
        case 'modifier':
          if      (tok.value === 'ṃ')  out += G_ANUSVARA;
          else if (tok.value === 'ḥ')  out += G_VISARGA;
          else if (tok.value === 'm̐') out += G_CHANDRABINDU;
          else out += tok.value; break;
        case 'special':
          out += G_OM; break;
        default:
          out += tok.value;
      }
    }
    return out;
  }

  function renderDevanagari(tokens) {
    let out = '';
    for (const tok of tokens) {
      switch (tok.type) {
        case 'syllable': {
          const cons = tok.consonants.map(c => ID_CONS.get(c) ?? '');
          out += cons.join(D_VIRAMA);
          if      (tok.vowel === '')  out += D_VIRAMA;
          else if (tok.vowel !== 'a') out += ID_MATRA.get(tok.vowel) ?? '';
          break;
        }
        case 'vowel':
          out += ID_VOWEL.get(tok.vowel) ?? tok.vowel; break;
        case 'modifier':
          if      (tok.value === 'ṃ')  out += D_ANUSVARA;
          else if (tok.value === 'ḥ')  out += D_VISARGA;
          else if (tok.value === 'm̐') out += D_CHANDRABINDU;
          else out += tok.value; break;
        case 'special':
          out += D_OM; break;
        default:
          out += tok.value;
      }
    }
    return out;
  }

  function renderTamil(tokens) {
    const T_VIRAMA  = '்';
    const T_VISARGA = 'ஃ';
    let out = '';
    for (const tok of tokens) {
      switch (tok.type) {
        case 'syllable': {
          const cons = tok.consonants.map(c => IT_CONS.get(c) ?? '');
          out += cons.join(T_VIRAMA);
          if      (tok.vowel === '')  out += T_VIRAMA;
          else if (tok.vowel !== 'a') out += IT_MATRA.get(tok.vowel) ?? '';
          break;
        }
        case 'vowel':
          out += IT_VOWEL.get(tok.vowel) ?? tok.vowel; break;
        case 'modifier':
          if      (tok.value === 'ṃ')  out += 'ம்';  // nasal approximation
          else if (tok.value === 'ḥ')  out += T_VISARGA;
          else out += tok.value; break;
        case 'special':
          out += 'ௐ'; break;
        default:
          out += tok.value;
      }
    }
    return out;
  }

  function renderIAST(tokens) {
    let out = '';
    for (const tok of tokens) {
      switch (tok.type) {
        case 'syllable': {
          // Map internal keys (ḷc, ḻ) to their visible IAST form
          const cons = tok.consonants.map(c => IAST_FIX.get(c) ?? c);
          out += cons.join('');
          if (tok.vowel !== '') out += tok.vowel;
          break;
        }
        case 'vowel':    out += tok.vowel; break;
        case 'modifier': out += tok.value; break;
        case 'special':  out += 'oṃ'; break;
        default:         out += tok.value;
      }
    }
    return out;
  }

  function renderEnglish(tokens) {
    let out = '';
    for (const tok of tokens) {
      switch (tok.type) {
        case 'syllable': {
          const cons = tok.consonants.map(c => IE_CONS.get(c) ?? c);
          out += cons.join('');
          if (tok.vowel !== '') out += IE_VOWEL.get(tok.vowel) ?? tok.vowel;
          break;
        }
        case 'vowel':
          out += IE_VOWEL.get(tok.vowel) ?? tok.vowel; break;
        case 'modifier':
          if      (tok.value === 'ṃ')  out += 'm';
          else if (tok.value === 'ḥ')  out += 'h';
          else out += tok.value; break;
        case 'special':  out += 'om'; break;
        default:         out += tok.value;
      }
    }
    return out;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  Tamil → IAST Maps
  // ═══════════════════════════════════════════════════════════════════════════

  const T_VIRAMA   = '்';
  const T_VISARGA  = 'ஃ';
  const T_OM       = 'ௐ';

  const T_VOWELS = new Map([
    ['அ','a'], ['ஆ','ā'], ['இ','i'], ['ஈ','ī'],
    ['உ','u'], ['ஊ','ū'], ['எ','e'], ['ஏ','e'],
    ['ஐ','ai'],['ஒ','o'], ['ஓ','o'], ['ஔ','au'],
  ]);

  const T_MATRAS = new Map([
    ['ா','ā'],  ['ி','i'],  ['ீ','ī'],  ['ு','u'],
    ['ூ','ū'],  ['ெ','e'],  ['ே','e'],  ['ை','ai'],
    ['ொ','o'],  ['ோ','o'],  ['ௌ','au'],
  ]);

  const T_CONSONANTS = new Map([
    ['க','k'],  ['ங','ṅ'],  ['ச','c'],  ['ஞ','ñ'],
    ['ட','ṭ'],  ['ண','ṇ'],  ['த','t'],  ['ந','n'],  ['ன','n'],
    ['ப','p'],  ['ம','m'],  ['ய','y'],  ['ர','r'],  ['ற','r'],
    ['ல','l'],  ['ள','ḷc'], ['ழ','ḻ'],  ['வ','v'],
    ['ஶ','ś'],  ['ஷ','ṣ'],  ['ஸ','s'],  ['ஹ','h'],  ['ஜ','j'],
  ]);

  // ═══════════════════════════════════════════════════════════════════════════
  //  Public API
  // ═══════════════════════════════════════════════════════════════════════════

  function fromGrantha(text) {
    if (!text || !text.trim()) return _empty();
    const tokens = tokenize(
      text, G_CONSONANTS, G_MATRAS, G_VOWELS,
      G_VIRAMA, G_ANUSVARA, G_VISARGA, G_CHANDRABINDU
    );
    return _render(tokens);
  }

  function fromDevanagari(text) {
    if (!text || !text.trim()) return _empty();
    const tokens = tokenize(
      text, D_CONSONANTS, D_MATRAS, D_VOWELS,
      D_VIRAMA, D_ANUSVARA, D_VISARGA, D_CHANDRABINDU
    );
    return _render(tokens);
  }

  function fromTamil(text) {
    if (!text || !text.trim()) return _empty();
    const tokens = tokenizeTamil(text);
    return _render(tokens);
  }

  function tokenizeTamil(text) {
    const tokens = [];
    const chars  = [...text];
    const n      = chars.length;
    let i = 0;

    while (i < n) {
      const ch = chars[i];

      if (ch === T_VISARGA) { tokens.push({ type:'modifier', value:'ḥ' }); i++; continue; }
      if (ch === T_OM)      { tokens.push({ type:'special',  value:'oṃ' }); i++; continue; }

      if (T_CONSONANTS.has(ch)) {
        const consList = [T_CONSONANTS.get(ch)];
        i++;

        while (
          i < n &&
          chars[i] === T_VIRAMA &&
          i + 1 < n &&
          T_CONSONANTS.has(chars[i + 1])
        ) {
          i++;
          consList.push(T_CONSONANTS.get(chars[i]));
          i++;
        }

        let vowel = 'a';
        if (i < n && chars[i] === T_VIRAMA) {
          vowel = '';
          i++;
        } else if (i < n && T_MATRAS.has(chars[i])) {
          vowel = T_MATRAS.get(chars[i]);
          i++;
        }

        tokens.push({ type:'syllable', consonants: consList, vowel });
        continue;
      }

      if (T_VOWELS.has(ch)) {
        tokens.push({ type:'vowel', vowel: T_VOWELS.get(ch) });
        i++; continue;
      }

      if (ch === T_VIRAMA) { i++; continue; }

      tokens.push({ type:'other', value: ch });
      i++;
    }

    return tokens;
  }

  function fromEnglish(text) {
    if (!text || !text.trim()) return _empty();
    const tokens = tokenizeEnglish(text);
    return _render(tokens);
  }

  function tokenizeEnglish(text) {
    const tokens = [];
    const n = text.length;
    let i = 0;

    function matchSub(idx, list) {
      const sub = text.substring(idx).toLowerCase();
      for (const [pattern, key] of list) {
        if (sub.startsWith(pattern)) {
          return { length: pattern.length, key };
        }
      }
      return null;
    }

    const CONS_PATTERNS = [
      ['ksh', ['k','ṣ']], ['kṣ', ['k','ṣ']], ['gny', ['j','ñ']], ['jñ', ['j','ñ']],
      ['chh', ['ch']], ['kh', ['kh']], ['gh', ['gh']], ['ch', ['c']], ['jh', ['jh']],
      ['th', ['th']], ['dh', ['dh']], ['ph', ['ph']], ['bh', ['bh']], ['sh', ['ś']],
      ['zh', ['ḻ']], ['ng', ['ṅ']], ['nj', ['ñ']],
      ['k', ['k']], ['g', ['g']], ['c', ['c']], ['j', ['j']],
      ['ṭ', ['ṭ']], ['ḍ', ['ḍ']], ['ṇ', ['ṇ']], ['t', ['t']], ['d', ['d']],
      ['n', ['n']], ['p', ['p']], ['b', ['b']], ['m', ['m']], ['y', ['y']],
      ['r', ['r']], ['l', ['l']], ['v', ['v']], ['w', ['v']],
      ['ś', ['ś']], ['ṣ', ['ṣ']], ['s', ['s']], ['h', ['h']], ['q', ['k']], ['z', ['s']]
    ];

    const VOWEL_PATTERNS = [
      ['aa', 'ā'], ['ā', 'ā'], ['ee', 'ī'], ['ii', 'ī'], ['ī', 'ī'],
      ['oo', 'ū'], ['uu', 'ū'], ['ū', 'ū'], ['ai', 'ai'], ['au', 'au'],
      ['ṛ', 'ṛ'], ['ri', 'ṛ'], ['ru', 'ṛ'],
      ['a', 'a'], ['i', 'i'], ['u', 'u'], ['e', 'e'], ['ē', 'e'], ['o', 'o'], ['ō', 'o']
    ];

    while (i < n) {
      const lower = text.substring(i).toLowerCase();
      if (lower.startsWith('om') && (i + 2 === n || !/[a-z]/i.test(text[i + 2]))) {
        tokens.push({ type: 'special', value: 'oṃ' });
        i += 2;
        continue;
      }
      if (lower.startsWith('aum') && (i + 3 === n || !/[a-z]/i.test(text[i + 3]))) {
        tokens.push({ type: 'special', value: 'oṃ' });
        i += 3;
        continue;
      }

      let cMatch = matchSub(i, CONS_PATTERNS);
      if (cMatch) {
        const consList = [...cMatch.key];
        i += cMatch.length;

        while (i < n) {
          const nextC = matchSub(i, CONS_PATTERNS);
          if (nextC) {
            const vCheck = matchSub(i, VOWEL_PATTERNS);
            if (vCheck && vCheck.key === 'ṛ' && (text.substring(i, i+2).toLowerCase()==='ri' || text.substring(i, i+2).toLowerCase()==='ru')) {
              break;
            }
            consList.push(...nextC.key);
            i += nextC.length;
          } else {
            break;
          }
        }

        let vowel = '';
        const vMatch = matchSub(i, VOWEL_PATTERNS);
        if (vMatch) {
          vowel = vMatch.key;
          i += vMatch.length;
        }

        tokens.push({ type: 'syllable', consonants: consList, vowel });
        continue;
      }

      const vMatch = matchSub(i, VOWEL_PATTERNS);
      if (vMatch) {
        tokens.push({ type: 'vowel', vowel: vMatch.key });
        i += vMatch.length;
        continue;
      }

      tokens.push({ type: 'other', value: text[i] });
      i++;
    }

    return tokens;
  }

  function _render(tokens) {
    return {
      grantha:    renderGrantha(tokens),
      devanagari: renderDevanagari(tokens),
      iast:       renderIAST(tokens),
      tamil:      renderTamil(tokens),
      english:    renderEnglish(tokens),
    };
  }

  function _empty() {
    return { grantha:'', devanagari:'', iast:'', tamil:'', english:'' };
  }

  return { fromGrantha, fromDevanagari, fromTamil, fromEnglish };
})();

