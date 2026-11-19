import type { KeyOrder } from './key-orders.ts';
import { defaultKeyRatings, ratingOf, type KeyRatings } from './key-ratings.ts';
import { FLAT_KEYS, transposeKey, type Key } from './keys.ts';
import { progressionInKey, type Bar, type Bars } from './progression.ts';
import { pick, type Random } from './random.ts';

export interface ChordSequenceOptions {
  /** The progression in Roman numerals, or several alternatives. */
  progression: string | readonly string[];
  keyOrder: KeyOrder;
  /** Defaults to rating 1 for every key. */
  keyRatings?: KeyRatings;
  /** When false, all keys come up equally often and the ratings are ignored. Defaults to true. */
  weightKeys?: boolean;
  /**
   * The keys to practice, at least one; the others never come up. Defaults to all twelve. With a single key,
   * that key repeats. The interval orders start on the first of these keys at or after C in their direction.
   */
  keys?: readonly Key[];
}

/** Half steps per new key for the interval key orders. */
const INTERVAL_STEPS: Partial<Record<KeyOrder, number>> = { '5': 5, '-5': -5 };

/**
 * An endless stream of bars: the progression in one key after the other, never the same key
 * twice in a row (unless only one key is practiced). A progression of several bars is played to
 * the end before the key changes.
 */
export class ChordSequence {
  private options: Required<ChordSequenceOptions>;
  private readonly random: Random;
  /** The key of the bars handed out last; null before the first bar. */
  private currentKey: Key | null = null;
  /** Bars of the current key that are still to come. */
  private queue: Bar[] = [];
  /** Weighted cycle: the number of the current cycle and the keys it has left. */
  private cycle = 0;
  private cycleKeys: Key[] = [];

  /** @throws RangeError when `keys` is empty. */
  constructor(options: ChordSequenceOptions, random: Random = Math.random) {
    this.options = withDefaults(options);
    this.random = random;
  }

  /**
   * Changes the options; the next key and progression use them. Bars of a progression that has
   * already started still come first. New ratings or weighting start a fresh weighted cycle.
   */
  configure(options: Partial<ChordSequenceOptions>): void {
    const next = withDefaults({ ...this.options, ...definedOnly(options) });
    if (
      next.keyRatings !== this.options.keyRatings ||
      next.weightKeys !== this.options.weightKeys ||
      next.keys !== this.options.keys
    ) {
      this.cycleKeys = [];
    }
    this.options = next;
  }

  /** Starts over: the next bar starts a progression in a new first key (C for the interval orders). */
  reset(): void {
    this.currentKey = null;
    this.queue = [];
    this.cycle = 0;
    this.cycleKeys = [];
  }

  /** The next bar. */
  next(): Bar {
    const queued = this.queue.shift();
    if (queued) {
      return queued;
    }
    const [first, ...rest] = this.startProgression();
    this.queue = rest;
    return first;
  }

  /** The next bars, one after the other. */
  take(count: number): Bar[] {
    return Array.from({ length: count }, () => this.next());
  }

  /**
   * All bars of the progression in the next key, for example to print one key per line. If next()
   * has started a progression, the bars still missing from it come first.
   */
  nextProgression(): Bars {
    const [first, ...rest] = this.queue;
    if (first) {
      this.queue = [];
      return [first, ...rest];
    }
    return this.startProgression();
  }

  /** The progression in the next key. */
  private startProgression(): Bars {
    const key = this.nextKey();
    this.currentKey = key;
    return progressionInKey(this.options.progression, key, this.random);
  }

  private nextKey(): Key {
    const order = this.options.keyOrder;
    if (order === 'WC') {
      return this.nextKeyInCycle();
    }
    const step = INTERVAL_STEPS[order];
    if (step !== undefined) {
      return this.nextKeyByInterval(step);
    }
    return this.randomKey();
  }

  /** The keys to practice, in the order of FLAT_KEYS. */
  private practicedKeys(): Key[] {
    return FLAT_KEYS.filter((key) => this.options.keys.includes(key));
  }

  /** The interval orders: from the current key (or onto C at the start), step on until a key to practice. */
  private nextKeyByInterval(step: number): Key {
    let key = this.currentKey === null ? transposeKey('C', -step) : this.currentKey;
    // A fourth up or down reaches every key within twelve steps
    for (let i = 0; i < FLAT_KEYS.length; i++) {
      key = transposeKey(key, step);
      if (this.options.keys.includes(key)) {
        return key;
      }
    }
    throw new RangeError('No key to practice');
  }

  /** Random: a key with rating r has 6 - r tickets (1 each when unweighted); the current key is left out. */
  private randomKey(): Key {
    const others = this.practicedKeys().filter((key) => key !== this.currentKey);
    const candidates = others.length > 0 ? others : this.practicedKeys();
    const tickets = candidates.flatMap((key) =>
      Array<Key>(this.options.weightKeys ? 6 - ratingOf(this.options.keyRatings, key) : 1).fill(key),
    );
    return pick(tickets, this.random);
  }

  /**
   * Weighted cycle: cycle n has every key whose rating divides n (every key when unweighted), in
   * random order. When only the current key is left in a cycle, it waits for a later cycle.
   */
  private nextKeyInCycle(): Key {
    const practiced = this.practicedKeys();
    const [only] = practiced;
    if (only !== undefined && practiced.length === 1) {
      return only;
    }
    for (;;) {
      while (this.cycleKeys.length === 0) {
        this.cycle++;
        this.cycleKeys = practiced.filter(
          (key) => this.cycle % (this.options.weightKeys ? ratingOf(this.options.keyRatings, key) : 1) === 0,
        );
      }
      const candidates = this.cycleKeys.filter((key) => key !== this.currentKey);
      if (candidates.length === 0) {
        this.cycleKeys = [];
        continue;
      }
      const key = pick(candidates, this.random);
      this.cycleKeys = this.cycleKeys.filter((k) => k !== key);
      return key;
    }
  }
}

function withDefaults(options: ChordSequenceOptions): Required<ChordSequenceOptions> {
  if (options.keys?.length === 0) {
    throw new RangeError('At least one key to practice is needed');
  }
  return {
    progression: options.progression,
    keyOrder: options.keyOrder,
    keyRatings: options.keyRatings ?? defaultKeyRatings(),
    weightKeys: options.weightKeys ?? true,
    keys: options.keys ?? FLAT_KEYS,
  };
}

/** The options without the ones set to undefined, so these keep their current value. */
function definedOnly(options: Partial<ChordSequenceOptions>): Partial<ChordSequenceOptions> {
  return Object.fromEntries(Object.entries(options).filter(([, value]) => value !== undefined));
}
