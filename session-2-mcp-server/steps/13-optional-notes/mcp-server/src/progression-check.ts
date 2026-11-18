import { alternatives, barsInKey, type Chord, chordsInKey, chordToText, type Key } from './chord-engine.ts';

/** A common mistake in a custom progression, explained so a person (or a model) can fix it. */
export interface ProgressionWarning {
  code:
    | 'empty'
    | 'unclosed-asterisk'
    | 'separator-inside-asterisks'
    | 'empty-bar'
    | 'empty-chord'
    | 'too-many-chords'
    | 'no-numeral'
    | 'flat-before-numeral'
    | 'sharp-numeral'
    | 'type-outside-asterisks'
    | 'lowercase-not-minor';
  message: string;
}

export interface CheckedChord {
  /** The chord as plain text, for example 'Dm7'. */
  text: string;
  /** The note the chord is built on, null when the chord starts with no note name. */
  root: string | null;
  /** The part shown in superscript (the text between asterisks), '' when there is none. */
  superscript: string;
}

export interface CheckedAlternative {
  /** The alternative as written. */
  source: string;
  bars: { text: string; chords: CheckedChord[] }[];
}

export interface ProgressionCheck {
  progression: string;
  key: Key;
  alternatives: CheckedAlternative[];
  warnings: ProgressionWarning[];
}

/** Chords per bar the app supports (it plays a bass line for up to four). */
const MAX_CHORDS_PER_BAR = 4;

/** A numeral at the start of the text outside the asterisks, with the optional trailing b. */
const LEADING_NUMERAL = /^(VII|VI|V|IV|III|II|I)(b?)/i;
const ANY_NUMERAL = /VII|VI|V|IV|III|II|I/i;
const FLAT_BEFORE_NUMERAL = /(?:^|[^A-Za-z])b(VII|VI|V|IV|III|II|I)(?![a-z])/i;
/** Text that is a chord type and belongs between asterisks. */
const CHORD_TYPE = /\d|maj|min|dim|aug|sus|add|alt|ø|°|\+|Δ|\^/i;
/** Superscripts that already say the chord is minor or diminished. */
const MINOR_TYPE = /^(m(?!aj)|min|-|dim|ø|°)/i;

/** How the app reads a progression in a key, and the mistakes it probably contains. */
export function checkProgression(progression: string, key: Key): ProgressionCheck {
  return {
    progression,
    key,
    alternatives: alternatives(progression).map((source) => ({
      source: source.trim(),
      bars: barsInKey(source, key).map((bar) => ({
        text: bar.chords.map(chordToText).join(' – '),
        chords: bar.chords.map(checkedChord),
      })),
    })),
    warnings: findMistakes(progression),
  };
}

function checkedChord(chord: Chord): CheckedChord {
  return {
    text: chordToText(chord),
    root: chord.root,
    superscript: chord.parts
      .filter((part) => part.superscript)
      .map((part) => part.text)
      .join(''),
  };
}

/** The warnings for a progression, each one only once. */
export function findMistakes(progression: string): ProgressionWarning[] {
  const warnings: ProgressionWarning[] = [];
  const warn = (code: ProgressionWarning['code'], message: string) => {
    if (!warnings.some((w) => w.message === message)) {
      warnings.push({ code, message });
    }
  };

  if (progression.trim() === '') {
    warn('empty', 'The progression is empty. Write Roman numerals, for example iim*7* - V*7* | I*maj7*.');
    return warnings;
  }

  const asterisks = progression.split('*').length - 1;
  if (asterisks % 2 === 1) {
    warn(
      'unclosed-asterisk',
      `The progression has ${asterisks} asterisks, an odd number: one chord type is not closed. ` +
        'Every chord type needs an asterisk before and after it, as in iim*7*; an unpaired asterisk is shown as a literal "*". ' +
        'Fix this first: until the asterisks pair up, the chord types and chords around them are read wrongly.',
    );
    // With unpaired asterisks the pairing is off, so further checks would only report follow-on errors
    return warnings;
  }
  for (const [type] of progression.matchAll(/\*[^*]*\*/g)) {
    if (/\||\s-\s/.test(type)) {
      warn(
        'separator-inside-asterisks',
        `"${type}" contains a chord or bar separator between its asterisks, so the app shows it as part of one chord type. ` +
          'Close the asterisks right after the chord type, for example iim*7* - V*7*.',
      );
    }
  }
  if (warnings.length > 0) {
    return warnings; // the asterisks pair up wrongly; fix that before anything else
  }

  for (const alternative of alternatives(progression)) {
    const bars = alternative.split('|');
    for (const bar of bars) {
      if (bar.trim() === '') {
        if (bars.length > 1) {
          warn(
            'empty-bar',
            `"${alternative.trim()}" has an empty bar (two "|" in a row, or a "|" at the start or end); the app leaves it out. ` +
              'Use "||" only to separate alternatives.',
          );
        }
        continue;
      }
      const chords = chordSources(bar);
      if (chords.some((chord) => chord.trim() === '')) {
        warn(
          'empty-chord',
          `The bar "${bar.trim()}" has an empty chord (a "-" with nothing on one side); the app leaves it out.`,
        );
      }
      const filled = chords.filter((chord) => chord.trim() !== '');
      if (filled.length > MAX_CHORDS_PER_BAR) {
        warn(
          'too-many-chords',
          `The bar "${bar.trim()}" has ${filled.length} chords; the app supports up to ${MAX_CHORDS_PER_BAR} per bar ` +
            'and plays no bass line for more. Use "|" to start a new bar.',
        );
      }
      for (const chord of filled) {
        checkChord(chord.trim(), warn);
      }
    }
  }

  return warnings;
}

/** The chords of a bar as written, split at '-' outside asterisks. */
function chordSources(bar: string): string[] {
  const chords = [''];
  bar.split(/(\*[^*]*\*)/).forEach((token, index) => {
    if (index % 2 === 1) {
      chords[chords.length - 1] += token;
      return;
    }
    token.split('-').forEach((piece, pieceIndex) => {
      if (pieceIndex > 0) {
        chords.push('');
      }
      chords[chords.length - 1] += piece;
    });
  });
  return chords;
}

function checkChord(chord: string, warn: (code: ProgressionWarning['code'], message: string) => void): void {
  const tokens = chord.split(/(\*[^*]*\*)/);
  const plain = tokens.filter((_, index) => index % 2 === 0).join('');
  const types = tokens.filter((_, index) => index % 2 === 1).map((type) => type.slice(1, -1));
  const inC = chordsInKey(chord, 'C').map(chordToText).join(' ');

  if (FLAT_BEFORE_NUMERAL.test(plain)) {
    const [, numeral] = plain.match(FLAT_BEFORE_NUMERAL) ?? [];
    warn(
      'flat-before-numeral',
      `In "${chord}" the b comes before the numeral. The app expects it after the numeral: write ${numeral}b, not b${numeral} ` +
        `(as written it reads ${inC} in C).`,
    );
    return;
  }
  if (plain.includes('#')) {
    warn(
      'sharp-numeral',
      `"${chord}" uses #. The app has no raised scale degrees; write the lowered degree above instead, for example Vb for #IV.`,
    );
    return;
  }
  const leading = plain.trimStart().match(LEADING_NUMERAL);
  if (!leading) {
    if (!ANY_NUMERAL.test(plain) || /^[A-G]/.test(plain.trimStart())) {
      warn(
        'no-numeral',
        `"${chord}" does not start with a Roman numeral (in C it reads ${inC || 'as nothing'}): note names stay the same in every key. ` +
          'Write scale degrees I to VII instead of note names, for example V*7* instead of G7.',
      );
    }
    return;
  }
  const rest = plain.trimStart().slice(leading[0].length).trimEnd();
  const minor = /^m(?!aj|in)/i.test(rest) ? rest.slice(0, 1) : '';
  const quality = rest.slice(minor.length);
  if (quality !== '' && CHORD_TYPE.test(quality)) {
    warn(
      'type-outside-asterisks',
      `In "${chord}" the chord type "${quality}" is outside the asterisks, so it is not shown in superscript` +
        (/[iv]/i.test(quality) ? ' and its i and v are read as numerals' : '') +
        ` (in C it reads ${inC}). Write ${leading[0]}${minor}*${quality}${types.join('')}*.`,
    );
    return;
  }

  const numeral = leading[1] ?? '';
  const type = types.join('');
  if (rest === '' && numeral === numeral.toLowerCase() && !MINOR_TYPE.test(type)) {
    warn(
      'lowercase-not-minor',
      `"${chord}" reads ${inC} in C: a lower-case numeral does not make a chord minor. ` +
        `If you mean a minor chord, write ${leading[0]}m${type ? `*${type}*` : ''}.`,
    );
  }
}

/** The check as readable text. */
export function formatCheck(check: ProgressionCheck): string {
  const lines = [`How the app reads "${check.progression}" in ${check.key}:`];
  const several = check.alternatives.length > 1;
  check.alternatives.forEach((alternative, index) => {
    const indent = several ? '    ' : '  ';
    if (several) {
      lines.push(`  Alternative ${index + 1} of ${check.alternatives.length} ("${alternative.source}"):`);
    }
    alternative.bars.forEach((bar, barIndex) => {
      const chords = bar.chords.map((chord) =>
        chord.superscript ? `${chord.text} (superscript: ${chord.superscript})` : `${chord.text} (no superscript)`,
      );
      lines.push(
        `${indent}Bar ${barIndex + 1}: ${bar.text || '(empty)'}${chords.length ? ` — ${chords.join(', ')}` : ''}`,
      );
    });
  });
  if (several) {
    lines.push('  The app picks one alternative at random for each key.');
  }
  lines.push('');
  if (check.warnings.length === 0) {
    lines.push('No problems found.');
  } else {
    lines.push(`Warnings (${check.warnings.length}):`);
    for (const warning of check.warnings) {
      lines.push(`  - ${warning.message}`);
    }
  }
  return lines.join('\n');
}
