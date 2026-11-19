import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ChordSequence } from './chord-sequence.ts';
import type { KeyRatings, Rating } from './key-ratings.ts';
import { FLAT_KEYS, type Key } from './keys.ts';
import { chordToText, type Bar } from './progression.ts';
import { seededRandom } from './random.ts';

function ratings(rating: (key: Key) => Rating): KeyRatings {
  return { keys: FLAT_KEYS.map((key) => ({ key, rating: rating(key) })) };
}

function text(bars: Bar[]): string[] {
  return bars.map((bar) => bar.chords.map(chordToText).join(' – '));
}

describe('ChordSequence', () => {
  it('goes up a fourth from C, one progression after the other', () => {
    const sequence = new ChordSequence({ progression: 'iim*7* - V*7* | I*maj7*', keyOrder: '5' });
    const bars = sequence.take(6);
    assert.deepEqual(
      bars.map((bar) => bar.key),
      ['C', 'C', 'F', 'F', 'Bb', 'Bb'],
    );
    assert.deepEqual(text(bars), ['Dm7 – G7', 'Cmaj7', 'Gm7 – C7', 'Fmaj7', 'Cm7 – F7', 'Bbmaj7']);
  });

  it('goes down a fourth from C', () => {
    const sequence = new ChordSequence({ progression: 'I*maj7*', keyOrder: '-5' });
    assert.deepEqual(
      sequence.take(4).map((bar) => bar.key),
      ['C', 'G', 'D', 'A'],
    );
  });

  for (const keyOrder of ['R', 'WC', '5', '-5'] as const) {
    it(`never repeats a key in key order ${keyOrder}`, () => {
      const sequence = new ChordSequence(
        { progression: 'I*maj7*', keyOrder, keyRatings: ratings((key) => (key === 'F' ? 1 : 5)) },
        seededRandom(3),
      );
      const keys = sequence.take(500).map((bar) => bar.key);
      assert.ok(keys.every((key, i) => key !== keys[i - 1]));
    });
  }

  it('brings up keys with a low rating more often in random order', () => {
    const sequence = new ChordSequence(
      { progression: 'I*maj7*', keyOrder: 'R', keyRatings: ratings((key) => (key === 'Gb' ? 1 : 5)) },
      seededRandom(1),
    );
    const keys = sequence.take(3000).map((bar) => bar.key);
    const gb = keys.filter((key) => key === 'Gb').length;
    const c = keys.filter((key) => key === 'C').length;
    assert.ok(gb > 3 * c, `Gb ${gb} times, C ${c} times`);
  });

  it('ignores the ratings when the keys are not weighted', () => {
    const sequence = new ChordSequence(
      { progression: 'I*maj7*', keyOrder: 'WC', weightKeys: false, keyRatings: ratings(() => 5) },
      seededRandom(5),
    );
    // Every cycle has all twelve keys
    assert.equal(new Set(sequence.take(12).map((bar) => bar.key)).size, 12);
  });

  it('plays a key with rating r in every r-th weighted cycle', () => {
    const sequence = new ChordSequence(
      { progression: 'I*maj7*', keyOrder: 'WC', keyRatings: ratings((key) => (key === 'C' || key === 'D' ? 1 : 2)) },
      seededRandom(9),
    );
    // Cycle 1 has C and D, cycle 2 has all twelve keys
    const keys = sequence.take(14).map((bar) => bar.key);
    assert.deepEqual(new Set(keys.slice(0, 2)), new Set(['C', 'D']));
    assert.deepEqual(new Set(keys.slice(2)), new Set(FLAT_KEYS));
  });

  it('is repeatable with a seeded random', () => {
    const take = () =>
      text(new ChordSequence({ progression: 'I*maj7* || Im*7*', keyOrder: 'R' }, seededRandom(42)).take(20));
    assert.deepEqual(take(), take());
  });

  it('starts over after reset, without the rest of the last progression', () => {
    const sequence = new ChordSequence({ progression: 'iim*7* - V*7* | I*maj7*', keyOrder: '5' });
    sequence.next();
    sequence.reset();
    assert.deepEqual(text([sequence.next()]), ['Dm7 – G7']);
  });

  it('hands out all bars of a key at once', () => {
    const sequence = new ChordSequence({ progression: 'iim*7* - V*7* | I*maj7*', keyOrder: '5' });
    assert.deepEqual(text(sequence.nextProgression()), ['Dm7 – G7', 'Cmaj7']);
    sequence.next();
    assert.deepEqual(text(sequence.nextProgression()), ['Fmaj7']);
    assert.deepEqual(text(sequence.nextProgression()), ['Cm7 – F7', 'Bbmaj7']);
  });

  it('uses the defaults for options set to undefined', () => {
    const sequence = new ChordSequence({
      progression: 'I*maj7*',
      keyOrder: 'R',
      keyRatings: undefined,
      weightKeys: undefined,
    });
    sequence.configure({ keyRatings: undefined });
    assert.equal(sequence.take(20).length, 20);
  });

  it('finishes the started progression before a new one takes over', () => {
    const sequence = new ChordSequence({ progression: 'iim*7* - V*7* | I*maj7*', keyOrder: '5' });
    sequence.next();
    sequence.configure({ progression: 'I*7*' });
    assert.deepEqual(text(sequence.take(2)), ['Cmaj7', 'F7']);
  });
  describe('with a subset of keys', () => {
    const keys = ['F', 'Bb', 'Eb', 'D'] as const;

    for (const keyOrder of ['R', 'WC', '5', '-5'] as const) {
      it(`brings up only those keys, never twice in a row, in key order ${keyOrder}`, () => {
        const sequence = new ChordSequence({ progression: 'I*maj7*', keyOrder, keys }, seededRandom(5));
        const played = sequence.take(200).map((bar) => bar.key);
        assert.deepEqual(new Set(played), new Set(keys));
        assert.ok(played.every((key, i) => key !== played[i - 1]));
      });
    }

    it('goes up a fourth through the keys to practice, starting at the first one from C', () => {
      const sequence = new ChordSequence({ progression: 'I*maj7*', keyOrder: '5', keys });
      assert.deepEqual(
        sequence.take(5).map((bar) => bar.key),
        ['F', 'Bb', 'Eb', 'D', 'F'],
      );
    });

    it('goes down a fourth through the keys to practice, starting at the first one from C', () => {
      const sequence = new ChordSequence({ progression: 'I*maj7*', keyOrder: '-5', keys });
      assert.deepEqual(
        sequence.take(5).map((bar) => bar.key),
        ['D', 'Eb', 'Bb', 'F', 'D'],
      );
    });

    it('keeps weighting by rating within the subset', () => {
      const sequence = new ChordSequence(
        { progression: 'I*maj7*', keyOrder: 'WC', keys, keyRatings: ratings((key) => (key === 'D' ? 5 : 1)) },
        seededRandom(2),
      );
      const played = sequence.take(300).map((bar) => bar.key);
      const d = played.filter((key) => key === 'D').length;
      const f = played.filter((key) => key === 'F').length;
      assert.ok(f > 3 * d, `F ${f} times, D ${d} times`);
    });

    for (const keyOrder of ['R', 'WC', '5', '-5'] as const) {
      it(`repeats a single key in key order ${keyOrder}`, () => {
        const sequence = new ChordSequence({ progression: 'I*maj7*', keyOrder, keys: ['A'] }, seededRandom(1));
        assert.deepEqual(
          sequence.take(3).map((bar) => bar.key),
          ['A', 'A', 'A'],
        );
      });
    }

    it('rejects an empty list of keys', () => {
      assert.throws(() => new ChordSequence({ progression: 'I*maj7*', keyOrder: 'R', keys: [] }), RangeError);
      const sequence = new ChordSequence({ progression: 'I*maj7*', keyOrder: 'R' });
      assert.throws(() => sequence.configure({ keys: [] }), RangeError);
    });

    it('switches to new keys after configure', () => {
      const sequence = new ChordSequence({ progression: 'I*maj7*', keyOrder: 'WC' }, seededRandom(4));
      sequence.take(5);
      sequence.configure({ keys: ['G', 'E'] });
      const played = sequence.take(10).map((bar) => bar.key);
      assert.ok(played.every((key) => key === 'G' || key === 'E'), played.join(' '));
    });
  });
});
