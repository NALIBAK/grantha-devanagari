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

  // ── Tamil digits (U+0BE7–U+0BEF, U+0BE6) ─────────────────────────────────
  /** Map: Tamil digit char → ASCII digit char (0–9) */
  const TAMIL_DIGIT_TO_ASCII = new Map([
    ['௧','1'],['௨','2'],['௩','3'],['௪','4'],['௫','5'],
    ['௬','6'],['௭','7'],['௮','8'],['௯','9'],['௦','0'],
  ]);
  /** Map: ASCII digit char → Devanagari digit char */
  const ASCII_TO_DEVA_DIGIT = new Map([
    ['1','१'],['2','२'],['3','३'],['4','४'],['5','५'],
    ['6','६'],['7','७'],['8','८'],['9','९'],['0','०'],
  ]);

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
    ['e','ே'],['ai','ை'],['o','ோ'],['au','ௌ'],
  ]);

  /* ── Numbered Tamil (Sanskrit varga subscript notation) ──
     Sound 1 (alpapraṇa / unvoiced unaspirated): plain base letter (traditional print style)
     Sound 2 (mahāpraṇa / unvoiced aspirated):   base + ₂
     Sound 3 (ghosa / voiced unaspirated):        base + ₃
     Sound 4 (mahāghosa / voiced aspirated):      base + ₄              */
  const IT_CONS_NUMBERED = new Map([
    ['k','க'],  ['kh','க₂'], ['g','க₃'], ['gh','க₄'], ['ṅ','ங'],
    ['c','ச'],  ['ch','ச₂'], ['j','ஜ'],  ['jh','ஜ₂'], ['ñ','ஞ'],
    ['ṭ','ட'],  ['ṭh','ட₂'], ['ḍ','ட₃'], ['ḍh','ட₄'], ['ṇ','ண'],
    ['t','த'],  ['th','த₂'], ['d','த₃'], ['dh','த₄'], ['n','ந'],
    ['p','ப'],  ['ph','ப₂'], ['b','ப₃'], ['bh','ப₄'], ['m','ம'],
    ['y','ய'],  ['r','ர'],   ['l','ல'],  ['ḷc','ள'],  ['ḻ','ழ'],
    ['v','வ'],  ['ś','ஶ'],   ['ṣ','ஷ'],  ['s','ஸ'],   ['h','ஹ'],
  ]);

  /* ── Subscript digit → variant offset map (for bidirectional input parsing) ──
     ₁ = variant 1 (same as plain), ₂ = variant 2, ₃ = variant 3, ₄ = variant 4
     Also accept plain ASCII 1–4 after a Tamil consonant.                        */
  const SUB_DIGITS = new Map([
    ['₁', 1], ['₂', 2], ['₃', 3], ['₄', 4],
    ['¹', 1], ['²', 2], ['³', 3], ['⁴', 4],
    ['1', 1], ['2', 2], ['3', 3], ['4', 4],
  ]);

  /* Map: Tamil base consonant → [key_sound1, key_sound2, key_sound3, key_sound4]
     For consonants with fewer than 4 variants, repeats the last valid key.      */
  const T_CONS_VARIANTS = new Map([
    ['க', ['k',  'kh', 'g',   'gh' ]],
    ['ச', ['c',  'ch', 'j',   'jh' ]],
    ['ட', ['ṭ',  'ṭh', 'ḍ',   'ḍh' ]],
    ['த', ['t',  'th', 'd',   'dh' ]],
    ['ப', ['p',  'ph', 'b',   'bh' ]],
    ['ஜ', ['j',  'jh', 'j',   'jh' ]],
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
        tokens.push({ type:'avagraha' }); i++; continue;
      }

      // ── Tamil / Grantha digits ─────────────────────────────────────────────
      if (TAMIL_DIGIT_TO_ASCII.has(ch)) {
        tokens.push({ type:'digit', value: TAMIL_DIGIT_TO_ASCII.get(ch) }); i++; continue;
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
        case 'avagraha':
          out += G_AVAGRAHA; break;      // 𑌽
        case 'digit':
          // Grantha manuscripts use Tamil numerals — keep Tamil digit
          for (const [tamil, ascii] of TAMIL_DIGIT_TO_ASCII)
            if (ascii === tok.value) { out += tamil; break; }
          break;
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
        case 'avagraha':
          out += D_AVAGRAHA; break;     // ऽ
        case 'digit':
          out += ASCII_TO_DEVA_DIGIT.get(tok.value) ?? tok.value; break; // १–०
        default:
          out += tok.value;
      }
    }
    return out;
  }

  function renderTamil(tokens) {
    const T_VIRAMA  = '்';
    const T_VISARGA = 'ஃ';
    // Subscript digit → ASCII char for ṛ-matra variant suffix
    const SUB_TO_ASCII = { '₂':'2', '₃':'3', '₄':'4' };
    let out = '';

    for (const tok of tokens) {
      switch (tok.type) {
        case 'syllable': {
          // Parse each consonant into { tBase, tSuffix } from IT_CONS_NUMBERED
          const parts = tok.consonants.map(c => {
            const r    = IT_CONS_NUMBERED.get(c) ?? '';
            const cps  = [...r];
            const bi   = cps.findIndex(ch => ch >= '\u0B80' && ch <= '\u0BFF');
            const tBase   = bi >= 0 ? cps[bi] : (cps[0] ?? '');
            const tSuffix = cps.slice(bi + 1).join(''); // '' | '₂' | '₃' | '₄'
            return { tBase, tSuffix };
          });

          if (tok.vowel === 'ṛ' || tok.vowel === 'ṝ') {
            // ṛ / ṝ matra → [consonant-cluster]்ரு/ரூ + variant-digit
            // e.g. kha+ṛ → க்ரு2  ;  ṅa+ṛ → ங்ரு (no digit)
            const longU = tok.vowel === 'ṝ';
            for (let ci = 0; ci < parts.length; ci++) {
              if (ci > 0) out += T_VIRAMA;
              out += parts[ci].tBase;
              if (ci < parts.length - 1) out += parts[ci].tSuffix;
            }
            out += T_VIRAMA + 'ர' + (longU ? 'ூ' : 'ு');
            const last = parts[parts.length - 1];
            if (last.tSuffix) {
              // ₂/₃/₄ → ASCII 2/3/4
              out += SUB_TO_ASCII[last.tSuffix] ?? last.tSuffix;
            } else if (T_CONS_VARIANTS.has(last.tBase)) {
              // Variant 1 (no subscript but base has variants) → show '1'
              out += '1';
            }
            // Unique consonant (not in T_CONS_VARIANTS): no digit
          } else {
            // Normal matra — subscript goes AFTER matra (not between consonant & matra)
            for (let ci = 0; ci < parts.length; ci++) {
              if (ci > 0) out += T_VIRAMA;
              out += parts[ci].tBase;
              if (ci < parts.length - 1) out += parts[ci].tSuffix;
            }
            const last = parts[parts.length - 1];
            if (tok.vowel === '') {
              out += T_VIRAMA + last.tSuffix;
            } else if (tok.vowel !== 'a') {
              out += (IT_MATRA.get(tok.vowel) ?? '') + last.tSuffix;
            } else {
              out += last.tSuffix; // inherent 'a': suffix after bare consonant
            }
          }
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
        case 'avagraha':
          out += 'ऽ'; break;
        case 'digit':
          for (const [tamil, ascii] of TAMIL_DIGIT_TO_ASCII)
            if (ascii === tok.value) { out += tamil; break; }
          break;
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
        case 'avagraha': out += 'ʼ'; break;   // U+02BC modifier letter apostrophe (standard IAST)
        case 'digit':    out += tok.value; break; // ASCII 1–0
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
        case 'avagraha': out += "'"; break;   // plain apostrophe
        case 'digit':    out += tok.value; break; // ASCII 1–0
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

  /**
   * IAST key → Tamil base letter (for ṛ-matra reverse resolution and resolveVariant).
   * Built from T_CONS_VARIANTS + T_CONSONANTS at module load time.
   */
  const IAST_TO_TAMIL_BASE = (() => {
    const m = new Map();
    // From variant table: all four variant IAST keys map to the same Tamil base
    for (const [tamilChar, variants] of T_CONS_VARIANTS) {
      for (const key of variants) m.set(key, tamilChar);
    }
    // Unique consonants not in variant table
    for (const [tamilChar, iastKey] of T_CONSONANTS) {
      if (!m.has(iastKey)) m.set(iastKey, tamilChar);
    }
    return m;
  })();

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

    /**
     * Resolve a raw T_CONSONANTS IAST key to a specific variant key using
     * the subscript/superscript/ASCII digit that immediately follows in the
     * input stream.  Returns { key: string, advance: number }.
     * advance = number of extra chars consumed (0 if no digit found).
     */
    function resolveVariant(baseKey, lookAheadIdx) {
      if (lookAheadIdx >= n) return { key: baseKey, advance: 0 };
      const nextCh = chars[lookAheadIdx];
      if (!SUB_DIGITS.has(nextCh)) return { key: baseKey, advance: 0 };
      const variantNum = SUB_DIGITS.get(nextCh); // 1, 2, 3, or 4

      // Use the precomputed IAST→Tamil-base map
      const tamilBase = IAST_TO_TAMIL_BASE.get(baseKey) ?? null;

      if (!tamilBase || !T_CONS_VARIANTS.has(tamilBase)) {
        return { key: baseKey, advance: 0 };
      }

      const variants = T_CONS_VARIANTS.get(tamilBase);
      const resolvedKey = variants[variantNum - 1] ?? baseKey;
      return { key: resolvedKey, advance: 1 };
    }

    while (i < n) {
      const ch = chars[i];

      if (ch === T_VISARGA) { tokens.push({ type:'modifier', value:'ḥ' }); i++; continue; }
      if (ch === T_OM)      { tokens.push({ type:'special',  value:'oṃ' }); i++; continue; }

      // Tamil digits typed into Tamil input field
      if (TAMIL_DIGIT_TO_ASCII.has(ch)) {
        tokens.push({ type:'digit', value: TAMIL_DIGIT_TO_ASCII.get(ch) }); i++; continue;
      }

      if (T_CONSONANTS.has(ch)) {
        // Resolve possible subscript variant digit immediately after consonant
        const raw0 = T_CONSONANTS.get(ch);
        const r0   = resolveVariant(raw0, i + 1);
        const consList = [r0.key];
        i += 1 + r0.advance;  // consonant char + optional digit char

        // Consume virama + next consonant chains (conjuncts).
        // STOP before virama+ர+ு/ூ which signals ṛ/ṝ matra, not a conjunct.
        while (
          i < n &&
          chars[i] === T_VIRAMA &&
          i + 1 < n &&
          T_CONSONANTS.has(chars[i + 1]) &&
          !(chars[i + 1] === 'ர' && i + 2 < n &&
            (chars[i + 2] === 'ு' || chars[i + 2] === 'ூ')) // not ṛ/ṝ matra
        ) {
          i++; // consume virama
          const rawN = T_CONSONANTS.get(chars[i]);
          const rN   = resolveVariant(rawN, i + 1);
          consList.push(rN.key);
          i += 1 + rN.advance;
        }

        let vowel = 'a';

        // ṛ/ṝ matra pattern: ் + ர + ு/ூ + optional-digit
        if (i < n && chars[i] === T_VIRAMA &&
            i + 1 < n && chars[i + 1] === 'ர' &&
            i + 2 < n && (chars[i + 2] === 'ு' || chars[i + 2] === 'ூ')) {
          const isLong = chars[i + 2] === 'ூ';
          i += 3; // consume ் + ர + ு/ூ
          // Optionally consume variant digit (ASCII 1-4 or subscript ₁-₄)
          const lastKey   = consList[consList.length - 1];
          const tamilBase = IAST_TO_TAMIL_BASE.get(lastKey);
          if (i < n && SUB_DIGITS.has(chars[i])) {
            const vNum = SUB_DIGITS.get(chars[i]);
            i++; // consume digit
            if (tamilBase && T_CONS_VARIANTS.has(tamilBase)) {
              consList[consList.length - 1] =
                T_CONS_VARIANTS.get(tamilBase)[vNum - 1] ?? lastKey;
            }
          } else if (tamilBase && T_CONS_VARIANTS.has(tamilBase)) {
            // No digit but base has variants → default to variant 1
            consList[consList.length - 1] = T_CONS_VARIANTS.get(tamilBase)[0];
          }
          vowel = isLong ? 'ṝ' : 'ṛ';

        } else if (i < n && chars[i] === T_VIRAMA) {
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

      // Skip lone subscript digits that weren't consumed as part of a consonant
      if (SUB_DIGITS.has(ch)) { i++; continue; }

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

