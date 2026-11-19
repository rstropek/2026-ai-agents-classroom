// How the app reads a progression, and the mistakes people typically make when they write one.
import {
  alternatives,
  barsInKey,
  type ChordPart,
  chordInKey,
  chordToHtml,
  chordToText,
  type Key,
  parseAlternative,
} from '../../src/app/chord-engine/index.ts';
import { barsToText, type SheetChord } from './sheet.ts';

export const WARNING_CODES = [
  'no-chords',
  'empty-alternative',
  'empty-bar',
  'too-many-chords',
  'unpaired-asterisk',
  'no-numeral',
  'flat-before-numeral',
  'sharp',
  'chord-type-outside-asterisks',
  'numeral-in-chord-type',
  'text-after-chord-type',
  'lowercase-is-not-minor',
] as const;
export type WarningCode = (typeof WARNING_CODES)[number];

export interface ProgressionWarning {
  code: WarningCode;
  message: string;
  /** Where, counted from 1; missing when the warning is about the whole progression or alternative. */
  alternative?: number;
  bar?: number;
  chord?: number;
}

export interface CheckedChord extends SheetChord {
  /** The chord symbol as the user wrote it. */
  written: string;
  /** As the app shows it: the chord type in <sup>. */
  html: string;
}

export interface CheckedAlternative {
  /** The alternative as written. */
  written: string;
  /** The bars as the app shows them: empty bars are left out. */
  bars: { chords: CheckedChord[] }[];
  text: string;
}

export interface ProgressionCheck {
  alternatives: CheckedAlternative[];
  warnings: ProgressionWarning[];
  /** False when no alternative has a chord, so there is nothing to practice. */
  usable: boolean;
}

/** The app shows up to four chords per bar. */
const MAX_CHORDS_PER_BAR = 4;

/** A numeral at the start of a chord, as the engine reads it: longest first, a trailing b lowers it. */
const LEADING_NUMERAL = /^(VII|VI|V|IV|III|II|I)(b?)/i;
const FLAT_FIRST = /^b(VII|VI|V|IV|III|II|I)/i;
const SLASH_BASS = /^\/(VII|VI|V|IV|III|II|I)b?$/i;

/** How the app reads the progression in the key, with a warning for each likely mistake. */
export function checkProgression(progression: string | readonly string[], key: Key): ProgressionCheck {
  const warnings: ProgressionWarning[] = [];
  const list = alternatives(progression);
  const checked = list.map((alternative, a): CheckedAlternative => {
    const where = list.length > 1 ? { alternative: a + 1 } : {};
    const symbolsByBar = parseAlternative(alternative);
    const nonEmpty = symbolsByBar.filter((symbols) => symbols.length > 0);

    if (nonEmpty.length === 0 && list.length > 1) {
      warnings.push({
        code: 'empty-alternative',
        message: `Alternative ${a + 1} has no chords; when it is picked, the bar stays empty. Check for a stray "||".`,
        ...where,
      });
    }

    let bar = 0;
    symbolsByBar.forEach((symbols, index) => {
      if (symbols.length === 0) {
        if (nonEmpty.length > 0) {
          warnings.push({
            code: 'empty-bar',
            message: `${at(where, index + 1)}: the bar is empty and is left out. Check for a stray "|" (a bar line between bars only).`,
            ...where,
            bar: index + 1,
          });
        }
        return;
      }
      bar++;
      if (symbols.length > MAX_CHORDS_PER_BAR) {
        warnings.push({
          code: 'too-many-chords',
          message: `${at(where, bar)} has ${symbols.length} chords; the app shows up to ${MAX_CHORDS_PER_BAR} per bar and plays no bass line for more. Use "|" to start a new bar.`,
          ...where,
          bar,
        });
      }
      symbols.forEach((symbol, c) => {
        for (const warning of checkSymbol(symbol, key)) {
          warnings.push({
            ...warning,
            message: `${at(where, bar)}, chord ${c + 1} "${writtenSymbol(symbol)}": ${warning.message}`,
            ...where,
            bar,
            chord: c + 1,
          });
        }
      });
    });

    const bars = barsInKey(alternative, key)
      .filter((b) => b.chords.length > 0)
      .map((b, i) => ({
        chords: b.chords.map((chord, c) => ({
          text: chordToText(chord),
          parts: chord.parts,
          html: chordToHtml(chord),
          written: writtenSymbol(nonEmpty[i]?.[c] ?? []),
        })),
      }));
    return { written: alternative.trim(), bars, text: barsToText(bars) };
  });

  const usable = checked.some((alternative) => alternative.bars.length > 0);
  if (!usable) {
    // One warning for the whole progression instead of one per empty alternative
    return {
      alternatives: checked,
      warnings: [{ code: 'no-chords', message: 'The progression has no chords, so there is nothing to practice.' }],
      usable,
    };
  }
  return { alternatives: checked, warnings, usable };
}

/** A chord symbol written back in the progression syntax. */
function writtenSymbol(symbol: readonly ChordPart[]): string {
  return symbol.map((part) => (part.superscript ? `*${part.text}*` : part.text)).join('');
}

function at(where: { alternative?: number }, bar: number): string {
  return where.alternative ? `Alternative ${where.alternative}, bar ${bar}` : `Bar ${bar}`;
}

/** The mistakes in one chord symbol; the messages say what the app makes of it and how to write it instead. */
function checkSymbol(symbol: readonly ChordPart[], key: Key): { code: WarningCode; message: string }[] {
  const warnings: { code: WarningCode; message: string }[] = [];
  const shown = chordToText(chordInKey(symbol, key));
  const [head, ...tail] = symbol;
  if (!head) {
    return warnings;
  }

  if (symbol.some((part) => !part.superscript && part.text.includes('*'))) {
    warnings.push({
      code: 'unpaired-asterisk',
      message:
        'an asterisk has no partner, so the chord type is not recognized. Put the chord type between two asterisks.',
    });
    return warnings;
  }

  if (head.superscript) {
    warnings.push({
      code: 'no-numeral',
      message: `there is no Roman numeral before the chord type, so the chord has no root in any key. Write the scale degree first, as in V*${head.text}*.`,
    });
    return warnings;
  }

  const numeral = head.text.match(LEADING_NUMERAL);
  if (!numeral) {
    const flatFirst = head.text.match(FLAT_FIRST);
    if (flatFirst) {
      warnings.push({
        code: 'flat-before-numeral',
        message: `the b goes after the numeral: write ${flatFirst[1]}b, not b${flatFirst[1]}. As written, the app shows "${shown}" in ${key}.`,
      });
    } else if (head.text.startsWith('#')) {
      warnings.push({
        code: 'sharp',
        message: `there are no sharp degrees. Write the flat degree a half step above instead (#IV is Vb, #V is VIb). As written, the app shows "${shown}" in ${key}.`,
      });
    } else {
      warnings.push({
        code: 'no-numeral',
        message: `it does not start with a Roman numeral (I to VII), so it is not transposed and reads "${shown}" in every key.`,
      });
    }
    return warnings;
  }

  const [degree = '', roman = '', flat = ''] = numeral;
  const rest = head.text.slice(degree.length);
  // 'm' (also written 'mi' or 'min', but not the m of 'maj') makes the chord minor; the rest is the chord type
  const minorMarker = rest.match(/^(min|mi|m)(?!aj)/)?.[0] ?? '';
  const minor = minorMarker ? 'm' : '';
  const type = rest.slice(minorMarker.length);
  const chordType = tail[0];
  const fix = `${roman}${flat}${minor}*${type}*`;

  if (rest.includes('#')) {
    warnings.push({
      code: 'sharp',
      message: `a sharp outside the asterisks is shown as plain text. Put alterations into the chord type, such as ${roman}${flat}${minor}*7(#11)*.`,
    });
  } else if (SLASH_BASS.test(rest)) {
    // A slash bass such as V/IV is read as intended
  } else if (/[iv]/i.test(rest)) {
    warnings.push({
      code: 'numeral-in-chord-type',
      message: `outside the asterisks every i and v is read as a numeral, so the app shows "${shown}" in ${key}. Write ${fix}.`,
    });
  } else if (type !== '') {
    warnings.push({
      code: 'chord-type-outside-asterisks',
      message: `the chord type "${type}" is outside the asterisks, so it is shown as plain text instead of superscript. Write ${fix}.`,
    });
  } else if (minor === '' && roman === roman.toLowerCase() && (!chordType || /^\d/.test(chordType.text))) {
    warnings.push({
      code: 'lowercase-is-not-minor',
      message: `lower case does not make a chord minor: "${roman}" is the same as "${roman.toUpperCase()}", so the app shows "${shown}" in ${key}. For a minor chord write ${roman}${flat}m${chordType ? `*${chordType.text}*` : ''}.`,
    });
  }

  // Text after the chord type (every plain part after the first one is): only a slash bass like /V is read as intended
  const afterType = tail.find((part) => !part.superscript);
  if (afterType && !SLASH_BASS.test(afterType.text)) {
    warnings.push({
      code: 'text-after-chord-type',
      message: `"${afterType.text}" after the chord type is shown as plain text, and any i or v in it is read as a numeral. Put it inside the asterisks; only a slash bass such as ${roman}${flat}*7*/V belongs outside.`,
    });
  }

  return warnings;
}
