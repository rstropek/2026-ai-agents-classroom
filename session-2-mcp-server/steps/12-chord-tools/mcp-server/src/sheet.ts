import {
  alternatives,
  type Bar,
  ChordSequence,
  CUSTOM_EXERCISE,
  chordToText,
  DEFAULT_CUSTOM_PROGRESSION,
  EXERCISES,
  FLAT_KEYS,
  type Key,
  type KeyOrder,
  type KeyRatings,
  progressionInKey,
  type Random,
  type Rating,
  transposeKey,
} from './chord-engine.ts';

/** How the keys of a sheet are ordered. 'balanced' is the sheet's own order, the others are the app's. */
export const KEY_ORDER_OPTIONS = ['balanced', 'random', 'weighted-cycle', 'fourths-up', 'fourths-down'] as const;
export type KeyOrderOption = (typeof KEY_ORDER_OPTIONS)[number];

const ENGINE_KEY_ORDERS: Record<Exclude<KeyOrderOption, 'balanced'>, KeyOrder> = {
  random: 'R',
  'weighted-cycle': 'WC',
  'fourths-up': '5',
  'fourths-down': '-5',
};

/** Instruments the sheet can be written for: concert pitch (C) or a transposing instrument. */
export const INSTRUMENTS = ['C', 'Bb', 'Eb', 'F'] as const;
export type Instrument = (typeof INSTRUMENTS)[number];

/** Half steps from the concert key up to the key the instrument reads. */
const WRITTEN_OFFSET: Record<Instrument, number> = { C: 0, Bb: 2, Eb: 9, F: 7 };

/** Cells per row for the app's key orders, which have no natural row length. */
export const KEYS_PER_ROW = FLAT_KEYS.length;

/** The predefined exercises, without the app's placeholder for a custom progression. */
export const PREDEFINED_EXERCISES = EXERCISES.filter((exercise) => exercise.name !== CUSTOM_EXERCISE);

export function progressionText(progression: string | readonly string[]): string {
  return alternatives(progression)
    .map((alternative) => alternative.trim())
    .join(' || ');
}

export interface SheetOptions {
  /** The progression in the app's syntax, or several alternatives. */
  progression: string | readonly string[];
  rows: number;
  keyOrder: KeyOrderOption;
  /** Balanced rows only: the concert keys every row lists once. Defaults to all twelve. */
  keys?: readonly Key[];
  /** Random and weighted cycle only: ratings 1–5 per concert key; keys left out count as 1. */
  ratings?: Partial<Record<Key, Rating>>;
  instrument: Instrument;
  random: Random;
}

export interface SheetCell {
  /** The key the player reads (written pitch); the concert key when the instrument is C. */
  key: Key;
  concertKey: Key;
  /** The chords of each bar, for example [['Dm7', 'G7'], ['Cmaj7']]. */
  bars: string[][];
  /** The cell as text: chords separated by ' – ', bars by ' | ', for example 'Dm7 – G7 | Cmaj7'. */
  text: string;
}

/** A practice sheet: rows of cells, each cell the progression in one key. */
export function generateSheet(options: SheetOptions): SheetCell[][] {
  const offset = WRITTEN_OFFSET[options.instrument];
  return keyRows(options).map((row) =>
    row.map((concertKey) => {
      const key = transposeKey(concertKey, offset);
      return cell(key, concertKey, progressionInKey(options.progression, key, options.random));
    }),
  );
}

function cell(key: Key, concertKey: Key, bars: Bar[]): SheetCell {
  const chords = bars.map((bar) => bar.chords.map(chordToText));
  return { key, concertKey, bars: chords, text: chords.map((bar) => bar.join(' – ')).join(' | ') };
}

/** The concert keys of each row. */
export function keyRows(options: Pick<SheetOptions, 'rows' | 'keyOrder' | 'keys' | 'ratings' | 'random'>): Key[][] {
  if (options.keyOrder === 'balanced') {
    return balancedRows(options.keys ?? FLAT_KEYS, options.rows, options.random);
  }
  const sequence = new ChordSequence(
    { progression: 'I', keyOrder: ENGINE_KEY_ORDERS[options.keyOrder], keyRatings: keyRatings(options.ratings) },
    options.random,
  );
  return Array.from({ length: options.rows }, () =>
    Array.from({ length: KEYS_PER_ROW }, () => sequence.nextProgression()[0].key),
  );
}

/**
 * Rows that each list every key once in random order. A row never starts with the key the
 * previous row ended on, so the same key never comes twice in a row. Needs at least two keys.
 */
export function balancedRows(keys: readonly Key[], rows: number, random: Random): Key[][] {
  if (new Set(keys).size !== keys.length || keys.length < 2) {
    throw new Error('Balanced rows need at least two different keys, each listed once.');
  }
  const result: Key[][] = [];
  let previousLast: Key | undefined;
  for (let r = 0; r < rows; r++) {
    const row = shuffle(keys, random);
    if (row[0] === previousLast) {
      // Swap the first key with any other one; that keeps the row a random order of all keys
      swap(row, 0, 1 + Math.floor(random() * (row.length - 1)));
    }
    result.push(row);
    previousLast = row[row.length - 1];
  }
  return result;
}

function shuffle(items: readonly Key[], random: Random): Key[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    swap(result, i, Math.floor(random() * (i + 1)));
  }
  return result;
}

function swap(items: Key[], i: number, j: number): void {
  const a = items[i];
  const b = items[j];
  if (a === undefined || b === undefined) {
    throw new RangeError(`Cannot swap positions ${i} and ${j} of ${items.length} keys`);
  }
  items[i] = b;
  items[j] = a;
}

function keyRatings(ratings: Partial<Record<Key, Rating>> | undefined): KeyRatings {
  return { keys: FLAT_KEYS.map((key) => ({ key, rating: ratings?.[key] ?? 1 })) };
}

/** A sentence per key order, for the tool description and the sheet's text. */
export const KEY_ORDER_DESCRIPTIONS: Record<KeyOrderOption, string> = {
  balanced:
    'every row lists each key exactly once in random order, and a row never starts with the key the previous row ended on',
  random: `the app's Random order, cut into rows of ${KEYS_PER_ROW}: keys may repeat within a row (never twice in a row), keys with a low rating come up more often`,
  'weighted-cycle': `the app's Weighted Cycle, cut into rows of ${KEYS_PER_ROW}: cycle n contains every key whose rating divides n, so a key rated 1 comes up in every cycle and a key rated 5 in every fifth`,
  'fourths-up': `the app's Perfect 4th up order starting on C (C F Bb Eb …), cut into rows of ${KEYS_PER_ROW}`,
  'fourths-down': `the app's Perfect 4th down order starting on C (C G D A …), cut into rows of ${KEYS_PER_ROW}`,
};

export const INSTRUMENT_DESCRIPTIONS: Record<Instrument, string> = {
  C: 'concert pitch (piano, guitar, bass, flute, trombone, vibes)',
  Bb: 'Bb instruments (trumpet, tenor and soprano sax, clarinet): written a major second above concert pitch',
  Eb: 'Eb instruments (alto and baritone sax): written a major sixth above concert pitch',
  F: 'F instruments (French horn): written a perfect fifth above concert pitch',
};

export function formatSheet(sheet: {
  exercise: string | null;
  progression: string;
  keyOrder: KeyOrderOption;
  instrument: Instrument;
  seed: number;
  rows: { cells: SheetCell[] }[];
}): string {
  const transposed = sheet.instrument !== 'C';
  const lines = [
    sheet.exercise
      ? `Practice sheet: ${sheet.exercise} (${sheet.progression})`
      : `Practice sheet for the custom progression ${sheet.progression}`,
    `Key order: ${sheet.keyOrder} — ${KEY_ORDER_DESCRIPTIONS[sheet.keyOrder]}.`,
    transposed
      ? `Written for ${INSTRUMENT_DESCRIPTIONS[sheet.instrument]}. Keys and chords are written pitch; the concert key is in brackets.`
      : 'Concert pitch.',
    `Seed: ${sheet.seed} (pass it again to get the same sheet).`,
  ];
  sheet.rows.forEach((row, index) => {
    lines.push('', `Row ${index + 1}`);
    for (const c of row.cells) {
      const key = transposed ? `${c.key} [${c.concertKey}]` : c.key;
      lines.push(`  ${`${key}:`.padEnd(transposed ? 10 : 4)} ${c.text}`);
    }
  });
  return lines.join('\n');
}

/** The syntax for custom progressions, as the app documents it. */
export const PROGRESSION_SYNTAX = `Custom progressions are written in Roman numerals; the app turns them into the chords of each key.
- I to VII: scale degree of the key. Upper and lower case mean the same (a lower-case numeral does NOT make a chord minor).
- IIb, IIIb, Vb, VIb, VIIb: lowered a half step. The b comes AFTER the numeral (VIIb, not bVII). There are no sharps.
- m: shown as written, so iim becomes Dm in C. Any other text outside asterisks is shown as written too, but every i and v in it is read as a numeral.
- *7*: the chord type between asterisks, shown in superscript and kept exactly as written: iim*7*, V*7(b9)*, I*maj7*, viim*7(b5)*.
- " - ": next chord in the same bar (up to four per bar).
- " | ": next bar.
- " || ": alternatives; one of them is picked at random for each key.
Chords in G, D, A, E and B are spelled with sharps, in all other keys with flats.
Examples (result in C): I*maj7* → Cmaj7; iim*7* - V*7* | I*maj7* → Dm7 – G7 | Cmaj7; I*maj7* || Im*7* || I*7* → one of Cmaj7, Cm7, C7; IV*7* - VIIb*7* | I*maj7* → F7 – Bb7 | Cmaj7.
The app's default custom progression is ${DEFAULT_CUSTOM_PROGRESSION}.`;
