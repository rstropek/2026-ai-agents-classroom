import { describe, expect, it } from 'vitest';
import {
  defaultKeyRatings,
  FLAT_KEYS,
  type Key,
  type KeyRatings,
  transposeKey,
} from '../../src/app/chord-engine/index.ts';
import { generateSheet, type SheetOptions, type SheetRows } from '../src/sheet.ts';

const TWO_FIVE_ONE = 'iim*7* - V*7* | I*maj7*';

function sheet(options: Partial<SheetOptions> = {}): SheetRows {
  return generateSheet({
    progression: TWO_FIVE_ONE,
    rows: 4,
    keyOrder: 'balanced',
    keys: FLAT_KEYS,
    ratings: defaultKeyRatings(),
    instrument: 'C',
    seed: 1,
    ...options,
  });
}

function keysOf(rows: SheetRows): Key[][] {
  return rows.map((row) => row.map((cell) => cell.key));
}

function ratings(rated: Partial<Record<Key, 1 | 2 | 3 | 4 | 5>>): KeyRatings {
  return { keys: FLAT_KEYS.map((key) => ({ key, rating: rated[key] ?? 1 })) };
}

describe('balanced sheets', () => {
  it('have every key exactly once in each row', () => {
    for (let seed = 0; seed < 50; seed++) {
      for (const row of keysOf(sheet({ seed, rows: 6 }))) {
        expect([...row].sort()).toEqual([...FLAT_KEYS].sort());
      }
    }
  });

  it('never start a row with the key the previous row ended on', () => {
    for (let seed = 0; seed < 300; seed++) {
      const rows = keysOf(sheet({ seed, rows: 8, keys: ['C', 'F', 'Bb'] }));
      rows.slice(1).forEach((row, r) => {
        expect(row[0]).not.toBe(rows[r]?.at(-1));
      });
    }
  });

  it('practice only the chosen keys', () => {
    const rows = keysOf(sheet({ keys: ['Gb', 'B', 'E'], rows: 3 }));
    for (const row of rows) {
      expect([...row].sort()).toEqual(['B', 'E', 'Gb']);
    }
  });

  it('show the exercise in each key', () => {
    const cell = sheet()
      .flat()
      .find((c) => c.key === 'C');
    expect(cell).toMatchObject({ key: 'C', writtenKey: 'C', rating: 1, text: 'Dm7 – G7 | Cmaj7' });
    expect(cell?.bars[0]?.chords[0]).toEqual({
      text: 'Dm7',
      parts: [
        { text: 'Dm', superscript: false },
        { text: '7', superscript: true },
      ],
    });
  });

  it('show the rating of each key', () => {
    const cells = sheet({ ratings: ratings({ Gb: 4 }) }).flat();
    expect(cells.find((c) => c.key === 'Gb')?.rating).toBe(4);
    expect(cells.find((c) => c.key === 'C')?.rating).toBe(1);
  });
});

describe('seeds', () => {
  it('give the same sheet for the same seed', () => {
    expect(sheet({ seed: 42 })).toEqual(sheet({ seed: 42 }));
    expect(sheet({ seed: 42, keyOrder: 'random' })).toEqual(sheet({ seed: 42, keyOrder: 'random' }));
  });

  it('give different sheets for different seeds', () => {
    expect(keysOf(sheet({ seed: 1 }))).not.toEqual(keysOf(sheet({ seed: 2 })));
  });

  it('pick the same alternatives in the same keys for every instrument', () => {
    const progression = ['I*maj7*', 'Im*7*', 'I*7*'];
    const types = (rows: SheetRows) => rows.flat().map((c) => [c.key, c.bars[0]?.chords[0]?.parts[1]?.text]);
    const concert = sheet({ progression, seed: 9 });
    expect(new Set(concert.flat().map((c) => c.bars[0]?.chords[0]?.parts[1]?.text))).toEqual(
      new Set(['maj7', '7', '7']),
    );
    for (const instrument of ['Bb', 'Eb', 'F'] as const) {
      expect(types(sheet({ progression, seed: 9, instrument }))).toEqual(types(concert));
    }
  });
});

describe('transposing instruments', () => {
  const cases = [
    { instrument: 'Bb', halfSteps: 2, inC: 'Em7 – A7 | Dmaj7' },
    { instrument: 'Eb', halfSteps: 9, inC: 'Bm7 – E7 | Amaj7' },
    { instrument: 'F', halfSteps: 7, inC: 'Am7 – D7 | Gmaj7' },
  ] as const;

  for (const { instrument, halfSteps, inC } of cases) {
    it(`write the chords for ${instrument} instruments, keys and ratings stay at concert pitch`, () => {
      const options = { seed: 5, ratings: ratings({ C: 3 }) };
      const concert = sheet(options);
      const written = sheet({ ...options, instrument });

      expect(keysOf(written)).toEqual(keysOf(concert));
      for (const cell of written.flat()) {
        expect(cell.writtenKey).toBe(transposeKey(cell.key, halfSteps));
      }
      const c = written.flat().find((cell) => cell.key === 'C');
      expect(c).toMatchObject({ rating: 3, text: inC });
    });
  }

  it('spell the written chords for the written key', () => {
    // Concert C for an Eb instrument is written in A, a key spelled with sharps
    const a = sheet({ instrument: 'Eb', progression: 'III*7*' })
      .flat()
      .find((cell) => cell.key === 'C');
    expect(a?.text).toBe('C#7');
  });
});

describe("the app's key orders", () => {
  it('go up in fourths from C and carry on from row to row', () => {
    expect(keysOf(sheet({ keyOrder: 'fourths-up', rows: 2 }))).toEqual([
      ['C', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'B', 'E', 'A', 'D', 'G'],
      ['C', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'B', 'E', 'A', 'D', 'G'],
    ]);
  });

  it('go down in fourths through the chosen keys only', () => {
    expect(keysOf(sheet({ keyOrder: 'fourths-down', rows: 2, keys: ['Bb', 'D', 'F'] }))).toEqual([
      ['D', 'Bb', 'F'],
      ['D', 'Bb', 'F'],
    ]);
  });

  for (const keyOrder of ['random', 'weighted-cycle'] as const) {
    it(`never repeat a key, also across rows, in key order ${keyOrder}`, () => {
      const keys = sheet({ keyOrder, rows: 20, keys: ['C', 'Eb', 'Gb', 'A'] }).flat();
      expect(new Set(keys.map((c) => c.key))).toEqual(new Set(['C', 'Eb', 'Gb', 'A']));
      keys.slice(1).forEach((cell, i) => {
        expect(cell.key).not.toBe(keys[i]?.key);
      });
    });
  }

  it('bring up unfamiliar keys more often in key order random', () => {
    const keys = sheet({ keyOrder: 'random', rows: 100, ratings: ratings({ Ab: 1, ...fives(['Ab']) }) })
      .flat()
      .map((c) => c.key);
    const ab = keys.filter((k) => k === 'Ab').length;
    const c = keys.filter((k) => k === 'C').length;
    expect(ab).toBeGreaterThan(3 * c);
  });
});

it('needs at least two different keys and a positive number of rows', () => {
  expect(() => sheet({ keys: ['C'] })).toThrow(RangeError);
  expect(() => sheet({ keys: ['C', 'C'] })).toThrow(RangeError);
  expect(() => sheet({ rows: 0 })).toThrow(RangeError);
});

/** Rating 5 for every key except the given ones. */
function fives(except: Key[]): Partial<Record<Key, 5>> {
  return Object.fromEntries(FLAT_KEYS.filter((key) => !except.includes(key)).map((key) => [key, 5]));
}
