// Practice sheets: rows of keys, each cell the exercise in that key, written for a transposing instrument.
import {
  type ChordPart,
  ChordSequence,
  chordToText,
  type Key,
  type KeyOrder,
  type KeyRatings,
  progressionInKey,
  type Random,
  type Rating,
  ratingOf,
  seededRandom,
  transposeKey,
} from '../../src/app/chord-engine/index.ts';

/** 'balanced': every row has each key once, in random order. The others are the app's key orders. */
export const SHEET_KEY_ORDERS = ['balanced', 'random', 'weighted-cycle', 'fourths-up', 'fourths-down'] as const;
export type SheetKeyOrder = (typeof SHEET_KEY_ORDERS)[number];

/** The app's key order behind each sheet key order. */
const APP_KEY_ORDERS: Record<Exclude<SheetKeyOrder, 'balanced'>, KeyOrder> = {
  random: 'R',
  'weighted-cycle': 'WC',
  'fourths-up': '5',
  'fourths-down': '-5',
};

/** The instruments a sheet can be written for, named by the note that sounds when they play a written C. */
export const INSTRUMENTS = ['C', 'Bb', 'Eb', 'F'] as const;
export type Instrument = (typeof INSTRUMENTS)[number];

/** How far the written chords lie above concert pitch, in half steps and in words. */
export const TRANSPOSITIONS: Record<Instrument, { readonly halfSteps: number; readonly interval: string }> = {
  C: { halfSteps: 0, interval: 'concert pitch' },
  Bb: { halfSteps: 2, interval: 'a major second above concert pitch' },
  Eb: { halfSteps: 9, interval: 'a major sixth above concert pitch' },
  F: { halfSteps: 7, interval: 'a perfect fifth above concert pitch' },
};

export interface SheetOptions {
  /** The progression in Roman numerals, or several alternatives (one is picked for each cell). */
  progression: string | readonly string[];
  rows: number;
  keyOrder: SheetKeyOrder;
  /** The keys to practice, at concert pitch: at least two different ones. */
  keys: readonly Key[];
  /** Ratings at concert pitch; they steer the 'random' and 'weighted-cycle' orders. */
  ratings: KeyRatings;
  instrument: Instrument;
  /** The same seed and options always give the same sheet, for every instrument. */
  seed: number;
}

export interface SheetChord {
  /** The chord as plain text, such as 'Dm7'. */
  text: string;
  /** The parts of the chord symbol; the chord type is marked as superscript, as the app shows it. */
  parts: ChordPart[];
}

export interface SheetCell {
  /** The key at concert pitch. */
  key: Key;
  /** The key the chords are written in for the instrument; the same as `key` for C instruments. */
  writtenKey: Key;
  /** The rating of `key`. */
  rating: Rating;
  /** The bars, for example 'Dm7 – G7 | Cmaj7'. */
  text: string;
  bars: { chords: SheetChord[] }[];
}

/** The rows of a sheet, each a list of cells. */
export type SheetRows = SheetCell[][];

/** @throws RangeError for fewer than two different keys or a row count that is not a positive whole number. */
export function generateSheet(options: SheetOptions): SheetRows {
  const keys = [...new Set(options.keys)];
  if (keys.length < 2) {
    throw new RangeError('A sheet needs at least two different keys');
  }
  if (!Number.isInteger(options.rows) || options.rows < 1) {
    throw new RangeError(`Not a number of rows: ${options.rows}`);
  }

  // One random source for the key order and the alternatives, used the same way for every instrument
  const random = seededRandom(options.seed);
  const nextKey =
    options.keyOrder === 'balanced' ? balancedKeys(keys, random) : appKeys(options.keyOrder, keys, options, random);
  const halfSteps = TRANSPOSITIONS[options.instrument].halfSteps;

  return Array.from({ length: options.rows }, () =>
    Array.from({ length: keys.length }, () => {
      const key = nextKey();
      const writtenKey = transposeKey(key, halfSteps);
      const bars = progressionInKey(options.progression, writtenKey, random).map((bar) => ({
        chords: bar.chords.map((chord) => ({ text: chordToText(chord), parts: chord.parts })),
      }));
      return { key, writtenKey, rating: ratingOf(options.ratings, key), text: barsToText(bars), bars };
    }),
  );
}

/** Bars as one line: chords separated by ' – ', bars by ' | '. */
export function barsToText(bars: readonly { chords: readonly SheetChord[] }[]): string {
  return bars.map((bar) => bar.chords.map((chord) => chord.text).join(' – ')).join(' | ');
}

/**
 * Each row has every key once, in random order, and never starts with the key the previous row ended on.
 * A shuffle that would is thrown away, so every allowed order is equally likely.
 */
function balancedKeys(keys: readonly Key[], random: Random): () => Key {
  let row: Key[] = [];
  let last: Key | undefined;
  return () => {
    if (row.length === 0) {
      do {
        row = shuffle(keys, random);
      } while (row[0] === last);
    }
    const key = row.shift() as Key;
    last = key;
    return key;
  };
}

/** The app's key orders, through the engine: the rows simply continue the stream of keys. */
function appKeys(
  keyOrder: Exclude<SheetKeyOrder, 'balanced'>,
  keys: readonly Key[],
  options: SheetOptions,
  random: Random,
): () => Key {
  // Only the keys of this stream are used; the sheet puts its own progression into the written key
  const sequence = new ChordSequence(
    { progression: 'I', keyOrder: APP_KEY_ORDERS[keyOrder], keyRatings: options.ratings, keys },
    random,
  );
  return () => sequence.nextProgression()[0].key;
}

/** Fisher–Yates. */
function shuffle<T>(items: readonly T[], random: Random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j] as T, result[i] as T];
  }
  return result;
}
