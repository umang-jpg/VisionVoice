/**
 * Braille conversion service.
 * Supports Unicode Braille (U+2800 block) and BRF (ASCII Braille) output.
 */

// ── Unicode Braille mapping (Grade 1 / uncontracted) ──────────
// Maps lowercase ASCII characters to Unicode Braille pattern codepoints.
const UNICODE_MAP = {
  'a': '\u2801', 'b': '\u2803', 'c': '\u2809', 'd': '\u2819',
  'e': '\u2811', 'f': '\u280B', 'g': '\u281B', 'h': '\u2813',
  'i': '\u280A', 'j': '\u281A', 'k': '\u2805', 'l': '\u2807',
  'm': '\u280D', 'n': '\u281D', 'o': '\u2815', 'p': '\u280F',
  'q': '\u281F', 'r': '\u2817', 's': '\u280E', 't': '\u281E',
  'u': '\u2825', 'v': '\u2827', 'w': '\u283A', 'x': '\u282D',
  'y': '\u283D', 'z': '\u2835',
  '1': '\u2801', '2': '\u2803', '3': '\u2809', '4': '\u2819',
  '5': '\u2811', '6': '\u280B', '7': '\u281B', '8': '\u2813',
  '9': '\u280A', '0': '\u281A',
  ' ': '\u2800',
  '.': '\u2832', ',': '\u2802', ';': '\u2806', ':': '\u2812',
  '!': '\u2816', '?': '\u2826', '-': '\u2824', '\'': '\u2804',
  '"': '\u2826', '(': '\u2836', ')': '\u2836',
};

// Number indicator: dots 3-4-5-6
const UNICODE_NUM_INDICATOR = '\u283C';

// Capital indicator: dot 6
const UNICODE_CAP_INDICATOR = '\u2820';

// ── BRF (ASCII Braille / NABCC) mapping ─────────────────────────
// North American Braille Computer Code (NABCC): each Braille cell
// maps to the ASCII character whose codepoint equals 0x20 | dot-pattern.
// The resulting file will look "scrambled" in a plain text editor —
// this is CORRECT and expected for a valid .brf file.
//
// Dot pattern → ASCII (decimal):
//   dots 1       → 0x21 = !   ... but offset from SPACE (0x20).
//   The standard printable mapping (letters a-z produce lowercase ASCII):
const BRF_MAP = {
  // Letters — each maps to its NABCC printable character
  'a': 'a',  // dots 1        → 0x61
  'b': 'b',  // dots 1,2      → 0x62 (actually dots 1-2: codepoint 3 + 0x20 = 0x23 = #, but
             //   NABCC uses the simpler direct-letter form for Grade 1 text output.
             //   We use the Grade 1 / Braille ASCII printable form that embossers consume:
  'c': 'c',  // dots 1,4
  'd': 'd',  // dots 1,4,5
  'e': 'e',  // dots 1,5
  'f': 'f',  // dots 1,2,4
  'g': 'g',  // dots 1,2,4,5
  'h': 'h',  // dots 1,2,5
  'i': 'i',  // dots 2,4
  'j': 'j',  // dots 2,4,5
  'k': 'k',  // dots 1,3
  'l': 'l',  // dots 1,2,3
  'm': 'm',  // dots 1,3,4
  'n': 'n',  // dots 1,3,4,5
  'o': 'o',  // dots 1,3,5
  'p': 'p',  // dots 1,2,3,4
  'q': 'q',  // dots 1,2,3,4,5
  'r': 'r',  // dots 1,2,3,5
  's': 's',  // dots 2,3,4
  't': 't',  // dots 2,3,4,5
  'u': 'u',  // dots 1,3,6
  'v': 'v',  // dots 1,2,3,6
  'w': 'w',  // dots 2,4,5,6
  'x': 'x',  // dots 1,3,4,6
  'y': 'y',  // dots 1,3,4,5,6
  'z': 'z',  // dots 1,3,5,6

  // Digits — mapped to letters a-j, prefixed by numeric indicator '#'
  '1': 'a', '2': 'b', '3': 'c', '4': 'd', '5': 'e',
  '6': 'f', '7': 'g', '8': 'h', '9': 'i', '0': 'j',

  // Space
  ' ': ' ',

  // Punctuation — standard NABCC Braille ASCII table
  '.': '4',  // dots 2,5,6       — period / full stop
  ',': '1',  // dots 2           — comma
  ';': '3',  // dots 2,3         — semicolon
  ':': '2',  // dots 2,5         — colon
  '!': '6',  // dots 2,3,5       — exclamation mark
  '?': '8',  // dots 2,6         — question mark
  '-': '-',  // dots 3,6         — hyphen/dash (NABCC: '-' )
  '\'': '\'', // dots 3          — apostrophe
  '"': '\"', // opening: dots 2,3,6 — in NABCC both open/close = '\"'
  '(': '<',  // dots 1,2,3,5,6   — opening paren → '<' in NABCC
  ')': '>',  // dots 2,3,4,5,6   — closing paren → '>' in NABCC
};

// Numeric indicator: dots 3,4,5,6 → '#' in NABCC
const BRF_NUM_INDICATOR = '#';

// Capital indicator: dot 6 → ',' in NABCC
const BRF_CAP_INDICATOR = ',';

/**
 * Convert plain text to Unicode Braille characters (Grade 1).
 * Suitable for visual display or Unicode-aware Braille rendering.
 * @param {string} text
 * @returns {string}
 */
export function textToBrailleUnicode(text) {
  if (!text) return '';
  let result = '';
  let inNumber = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (/[0-9]/.test(ch)) {
      if (!inNumber) {
        result += UNICODE_NUM_INDICATOR;
        inNumber = true;
      }
      result += UNICODE_MAP[ch] || '\u2800';
    } else {
      if (inNumber && ch !== ' ') {
        inNumber = false;
      } else if (ch === ' ') {
        inNumber = false;
      }

      if (/[A-Z]/.test(ch)) {
        result += UNICODE_CAP_INDICATOR;
        result += UNICODE_MAP[ch.toLowerCase()] || '\u2800';
      } else {
        result += UNICODE_MAP[ch.toLowerCase()] || '\u2800';
      }
    }
  }

  return result;
}

/**
 * Convert plain text to BRF format (ASCII Braille).
 * Standard format for embossers and refreshable Braille displays.
 * Lines are wrapped at 40 characters (standard Braille line width).
 * @param {string} text
 * @returns {string}
 */
export function textToBrf(text) {
  if (!text) return '';
  let result = '';
  let inNumber = false;
  let lineLength = 0;
  const MAX_LINE = 40;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (ch === '\n') {
      result += '\r\n';
      lineLength = 0;
      inNumber = false;
      continue;
    }

    let cell = '';

    if (/[0-9]/.test(ch)) {
      if (!inNumber) {
        cell += BRF_NUM_INDICATOR;
        inNumber = true;
      }
      cell += BRF_MAP[ch] || ' ';
    } else {
      if (inNumber && ch !== ' ') {
        inNumber = false;
      } else if (ch === ' ') {
        inNumber = false;
      }

      if (/[A-Z]/.test(ch)) {
        cell += BRF_CAP_INDICATOR;
        cell += BRF_MAP[ch.toLowerCase()] || ' ';
      } else {
        cell += BRF_MAP[ch.toLowerCase()] || ' ';
      }
    }

    // Line wrapping at word boundaries
    if (lineLength + cell.length > MAX_LINE) {
      result += '\r\n';
      lineLength = 0;
    }

    result += cell;
    lineLength += cell.length;
  }

  return result;
}
