import { describe, expect, it } from 'vitest';
import { FLAT_KEYS, type Key, seededRandom } from '../src/chord-engine.ts';
import { balancedRows, generateSheet, keyRows, type SheetOptions } from '../src/sheet.ts';

const TWO_BAR_II_V_I = 'iim*7* - V*7* | I*maj7*';

function options(overrides: Partial<SheetOptions> = {}): SheetOptions {
  return {
    progression: TWO_BAR_II_V_I,
    rows: 4,
    keyOrder: 'balanced',
    instrument: 'C',
    random: seededRandom(42),
    ...overrides,
  };
}

function expectNoRowStartsWithPreviousEnd(rows: Key[][]) {
  let previous: Key[] | undefined;
  for (const row of rows) {
    if (previous) {
      expect(row[0]).not.toBe(previous.at(-1));
    }
    previous = row;
  }
}

describe('balanced rows', () => {
  it('lists all 12 keys exactly once in every row', () => {
    const rows = keyRows(options({ rows: 6 }));
    expect(rows).toHaveLength(6);
    for (const row of rows) {
      expect([...row].sort()).toEqual([...FLAT_KEYS].sort());
    }
  });

  it('never starts a row with the key the previous row ended on', () => {
    for (let seed = 0; seed < 300; seed++) {
      expectNoRowStartsWithPreviousEnd(balancedRows(FLAT_KEYS, 8, seededRandom(seed)));
      expectNoRowStartsWithPreviousEnd(balancedRows(['C', 'F'], 8, seededRandom(seed)));
    }
  });

  it('shuffles the keys differently from row to row', () => {
    const rows = keyRows(options({ rows: 4 }));
    expect(new Set(rows.map((row) => row.join(' '))).size).toBe(4);
  });

  it('uses only the chosen keys', () => {
    const rows = keyRows(options({ keys: ['C', 'F', 'Bb'] }));
    for (const row of rows) {
      expect([...row].sort()).toEqual(['Bb', 'C', 'F']);
    }
  });

  it('needs at least two different keys', () => {
    expect(() => balancedRows(['C'], 2, seededRandom(1))).toThrow(/two different keys/);
    expect(() => balancedRows(['C', 'C'], 2, seededRandom(1))).toThrow(/two different keys/);
  });
});

describe('the app key orders cut into rows', () => {
  it('fourths up starts on C and cycles through all keys in every row', () => {
    const rows = keyRows(options({ keyOrder: 'fourths-up', rows: 2 }));
    const cycle = ['C', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'B', 'E', 'A', 'D', 'G'];
    expect(rows).toEqual([cycle, cycle]);
  });

  it('fourths down goes the other way', () => {
    const [row] = keyRows(options({ keyOrder: 'fourths-down', rows: 1 }));
    expect(row?.slice(0, 4)).toEqual(['C', 'G', 'D', 'A']);
  });

  it('random never repeats a key directly, not even across rows', () => {
    const keys = keyRows(options({ keyOrder: 'random', rows: 10 })).flat();
    expect(keys).toHaveLength(120);
    for (let i = 1; i < keys.length; i++) {
      expect(keys[i]).not.toBe(keys[i - 1]);
    }
  });

  it('random brings up keys with a low rating more often', () => {
    const ratings = Object.fromEntries(FLAT_KEYS.map((key) => [key, 5])) as Record<Key, 5>;
    const keys = keyRows(options({ keyOrder: 'random', rows: 50, ratings: { ...ratings, Gb: 1 } })).flat();
    const gb = keys.filter((key) => key === 'Gb').length;
    const c = keys.filter((key) => key === 'C').length;
    expect(gb).toBeGreaterThan(c * 2);
  });

  it('weighted cycle leaves out well-known keys in most cycles', () => {
    // Every key but C has rating 1: cycles 1 to 4 have 11 keys, cycle 5 all 12
    const keys = keyRows(options({ keyOrder: 'weighted-cycle', rows: 5, ratings: { C: 5 } })).flat();
    expect(keys.filter((key) => key === 'C')).toHaveLength(1);
    expect(keys.filter((key) => key === 'F').length).toBeGreaterThanOrEqual(5);
  });
});

describe('sheet cells', () => {
  it('spells the progression out in the key of the cell', () => {
    const [row] = generateSheet(options({ keyOrder: 'fourths-up', rows: 1 }));
    expect(row?.[0]).toEqual({
      key: 'C',
      concertKey: 'C',
      bars: [['Dm7', 'G7'], ['Cmaj7']],
      text: 'Dm7 – G7 | Cmaj7',
    });
    expect(row?.[1]?.text).toBe('Gm7 – C7 | Fmaj7');
  });

  it('transposes for Bb, Eb and F instruments', () => {
    const first = (instrument: SheetOptions['instrument']) =>
      generateSheet(options({ keyOrder: 'fourths-up', rows: 1, instrument }))[0]?.[0];
    expect(first('Bb')).toMatchObject({ key: 'D', concertKey: 'C', text: 'Em7 – A7 | Dmaj7' });
    expect(first('Eb')).toMatchObject({ key: 'A', concertKey: 'C', text: 'Bm7 – E7 | Amaj7' });
    expect(first('F')).toMatchObject({ key: 'G', concertKey: 'C', text: 'Am7 – D7 | Gmaj7' });
  });

  it('keeps the balanced key order when transposing', () => {
    const concert = generateSheet(options({ random: seededRandom(7) }));
    const bb = generateSheet(options({ random: seededRandom(7), instrument: 'Bb' }));
    expect(bb.map((row) => row.map((c) => c.concertKey))).toEqual(concert.map((row) => row.map((c) => c.key)));
  });

  it('gives the same sheet for the same seed and another one for a different seed', () => {
    const progression = ['I*maj7*', 'Im*7*', 'I*7*'];
    const a = generateSheet(options({ progression, random: seededRandom(123) }));
    const b = generateSheet(options({ progression, random: seededRandom(123) }));
    const c = generateSheet(options({ progression, random: seededRandom(124) }));
    expect(b).toEqual(a);
    expect(c).not.toEqual(a);
  });

  it('picks one of the alternatives for each cell', () => {
    const sheet = generateSheet(options({ progression: 'I*maj7* || Im*7* || I*7*', rows: 3 }));
    const kinds = new Set(sheet.flat().map((c) => c.text.replace(/^[A-G][b#]?/, '')));
    expect(kinds).toEqual(new Set(['maj7', 'm7', '7']));
  });
});
