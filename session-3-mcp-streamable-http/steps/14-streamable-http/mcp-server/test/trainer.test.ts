import { describe, expect, it } from 'vitest';
import { FLAT_KEYS, seededRandom } from '../src/chord-engine.ts';
import {
  barText,
  clampTempo,
  formatPracticeReport,
  PracticeLog,
  parseTrainerOptions,
  type TrainerBar,
  type TrainerOptions,
  trainerSequence,
} from '../src/trainer.ts';

const IIVI = 'iim*7* - V*7* | I*maj7*';

function options(overrides: Partial<TrainerOptions> = {}): TrainerOptions {
  return {
    exercise: null,
    progression: IIVI,
    keyOrder: 'balanced',
    keyRatings: {},
    instrument: 'C',
    tempo: 60,
    ...overrides,
  };
}

function take(count: number, overrides: Partial<TrainerOptions> = {}, seed = 1): TrainerBar[] {
  const sequence = trainerSequence(options(overrides), seededRandom(seed));
  return Array.from({ length: count }, () => sequence.next());
}

describe('trainerSequence', () => {
  it('plays the whole progression in a key before the key changes', () => {
    const bars = take(8, { keyOrder: 'fourths-up' });
    expect(bars.map(barText)).toEqual([
      'Dm7 – G7',
      'Cmaj7',
      'Gm7 – C7',
      'Fmaj7',
      'Cm7 – F7',
      'Bbmaj7',
      'Fm7 – Bb7',
      'Ebmaj7',
    ]);
    expect(bars.map((bar) => bar.key)).toEqual(['C', 'C', 'F', 'F', 'Bb', 'Bb', 'Eb', 'Eb']);
  });

  it('balanced: every round has each key once, never the same key twice in a row', () => {
    const keys = take(36 * 2)
      .filter((_, i) => i % 2 === 0)
      .map((bar) => bar.concertKey);
    for (let round = 0; round < 3; round++) {
      expect([...keys.slice(round * 12, round * 12 + 12)].sort()).toEqual([...FLAT_KEYS].sort());
    }
    for (let i = 1; i < keys.length; i++) {
      expect(keys[i]).not.toBe(keys[i - 1]);
    }
  });

  it('shows written keys and chords for a Bb instrument and starts the fourths on concert C', () => {
    const bars = take(4, { keyOrder: 'fourths-up', instrument: 'Bb' });
    expect(bars.map((bar) => [bar.key, bar.concertKey])).toEqual([
      ['D', 'C'],
      ['D', 'C'],
      ['G', 'F'],
      ['G', 'F'],
    ]);
    expect(barText(bars[0] as TrainerBar)).toBe('Em7 – A7');
  });

  it('applies concert-key ratings: a key rated 5 comes up least often', () => {
    const ratings = Object.fromEntries(FLAT_KEYS.map((key) => [key, key === 'Gb' ? 1 : 5]));
    const counts = new Map<string, number>();
    for (const bar of take(1200, {
      progression: 'I*maj7*',
      keyOrder: 'random',
      keyRatings: ratings,
      instrument: 'Eb',
    })) {
      counts.set(bar.concertKey, (counts.get(bar.concertKey) ?? 0) + 1);
    }
    const others = FLAT_KEYS.filter((key) => key !== 'Gb').map((key) => counts.get(key) ?? 0);
    expect(counts.get('Gb') ?? 0).toBeGreaterThan(Math.max(...others));
  });
});

describe('PracticeLog', () => {
  const bar = (concertKey: TrainerBar['concertKey'], key = concertKey): TrainerBar => ({ key, concertKey, chords: [] });

  it('reports the keys practiced over all runs, in concert pitch', () => {
    const log = new PracticeLog();
    log.start(80, 0);
    for (const b of [bar('C', 'D'), bar('C', 'D'), bar('F', 'G')]) log.record(b);
    log.stop(6000);
    log.start(100, 10_000);
    log.record(bar('Bb', 'C'));
    log.record(bar('C', 'D'));
    log.stop(12_400);

    const report = log.report(options({ instrument: 'Bb', exercise: 'ii–V–I' }));
    expect(report.practicedKeys).toEqual([
      { concertKey: 'C', writtenKey: 'D', bars: 3 },
      { concertKey: 'F', writtenKey: 'G', bars: 1 },
      { concertKey: 'Bb', writtenKey: 'C', bars: 1 },
    ]);
    expect(report.totalBars).toBe(5);
    expect(report.keysNotPracticed).toHaveLength(9);
    expect(report.sessions).toEqual([
      { tempo: 80, bars: 3, seconds: 6, keys: ['C', 'F'] },
      { tempo: 100, bars: 2, seconds: 2, keys: ['Bb', 'C'] },
    ]);

    const text = formatPracticeReport(report);
    expect(text).toContain('Keys practiced (concert pitch): C (read as D): 3 bars, F (read as G): 1 bar');
    expect(text).toContain('Last run: 2 bars in 2 s at 100 BPM, keys in order: Bb C.');
    expect(text).toContain('2 runs, 5 bars');
  });

  it('says so when the user stopped during the count-in', () => {
    const log = new PracticeLog();
    log.start(60, 0);
    expect(log.stop(2000)).toBe(true);
    expect(log.stop(3000)).toBe(false);
    expect(formatPracticeReport(log.report(options()))).toContain('No bars were played yet');
  });
});

describe('parseTrainerOptions', () => {
  it('reads the options of a tool result and keeps the tempo in range', () => {
    expect(parseTrainerOptions({ ...options({ tempo: 999 }), warnings: [] })).toEqual(options({ tempo: 300 }));
    expect(parseTrainerOptions(null)).toBeNull();
    expect(parseTrainerOptions({ ...options(), keyOrder: 'sideways' })).toBeNull();
  });

  it('clamps and rounds tempos', () => {
    expect(clampTempo(5)).toBe(20);
    expect(clampTempo(72.6)).toBe(73);
  });
});
