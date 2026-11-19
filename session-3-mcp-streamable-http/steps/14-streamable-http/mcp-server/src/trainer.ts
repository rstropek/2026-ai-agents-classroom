// The chord trainer's logic without React or the DOM: which bars it shows and what it reports
// to the model. The server uses it for the open_trainer tool, the app in ui/ runs it in the browser.
import {
  type Chord,
  ChordSequence,
  chordToText,
  FLAT_KEYS,
  type Key,
  type KeyRatings,
  type Random,
  type Rating,
  transposeKey,
} from './chord-engine.ts';
import {
  ENGINE_KEY_ORDERS,
  INSTRUMENTS,
  type Instrument,
  KEY_ORDER_OPTIONS,
  type KeyOrderOption,
  WRITTEN_OFFSET,
} from './sheet.ts';

export const MIN_TEMPO = 20;
export const MAX_TEMPO = 300;
/** The Angular app starts at 60 BPM as well. */
export const DEFAULT_TEMPO = 60;
export const BEATS_PER_BAR = 4;

/** What open_trainer hands to the app (its structuredContent). */
export interface TrainerOptions {
  /** Name of the predefined exercise; null for a custom progression. */
  exercise: string | null;
  /** The progression in the app syntax; " || " separates alternatives. */
  progression: string;
  keyOrder: KeyOrderOption;
  /** Ratings 1–5 per concert key; keys left out count as 1. Only used by "random" and "weighted-cycle". */
  keyRatings: Partial<Record<Key, Rating>>;
  instrument: Instrument;
  /** Beats per minute; the bar changes every four beats. */
  tempo: number;
}

/** One bar as the trainer shows it. */
export interface TrainerBar {
  /** The key the player reads (written pitch; the concert key for instrument "C"). */
  key: Key;
  concertKey: Key;
  chords: Chord[];
}

export function clampTempo(tempo: number): number {
  return Math.min(MAX_TEMPO, Math.max(MIN_TEMPO, Math.round(tempo)));
}

/**
 * The endless stream of bars for the trainer, from the chord engine's ChordSequence. The sequence
 * runs in the keys the player reads, so the chords are spelled for the written key, like on the
 * practice sheet. The concert-key ratings are moved to the written keys, and the fourths orders
 * start on concert C as on the sheet. "balanced" is the weighted cycle without weights: every
 * round has each of the twelve keys once in random order, never the same key twice in a row.
 */
export function trainerSequence(
  options: Pick<TrainerOptions, 'progression' | 'keyOrder' | 'keyRatings' | 'instrument'>,
  random: Random = Math.random,
): { next(): TrainerBar } {
  const offset = WRITTEN_OFFSET[options.instrument];
  const balanced = options.keyOrder === 'balanced';
  const keyOrder = ENGINE_KEY_ORDERS[options.keyOrder === 'balanced' ? 'weighted-cycle' : options.keyOrder];
  const keyRatings: KeyRatings = {
    keys: FLAT_KEYS.map((key) => ({ key, rating: options.keyRatings[transposeKey(key, -offset)] ?? 1 })),
  };
  const sequence = new ChordSequence(
    { progression: options.progression, keyOrder, keyRatings, weightKeys: !balanced },
    random,
  );

  let pending: TrainerBar[] = [];
  if (options.keyOrder === 'fourths-up' || options.keyOrder === 'fourths-down') {
    // The engine starts these orders on C; skip ahead to the key a transposing instrument reads for concert C
    const start = transposeKey('C', offset);
    let bars = sequence.nextProgression();
    for (let i = 0; i < FLAT_KEYS.length && bars[0].key !== start; i++) {
      bars = sequence.nextProgression();
    }
    pending = bars.map((bar) => ({ key: bar.key, concertKey: transposeKey(bar.key, -offset), chords: bar.chords }));
  }

  return {
    next() {
      const queued = pending.shift();
      if (queued) {
        return queued;
      }
      const bar = sequence.next();
      return { key: bar.key, concertKey: transposeKey(bar.key, -offset), chords: bar.chords };
    },
  };
}

export function barText(bar: TrainerBar): string {
  return bar.chords.map(chordToText).join(' – ');
}

// ---------------------------------------------------------------------------------------------
// What the trainer tells the model

export interface PracticedKey {
  concertKey: Key;
  /** The key the player read; equals concertKey for instrument "C". */
  writtenKey: Key;
  /** Bars shown in this key while the trainer ran. */
  bars: number;
}

export interface PracticeSession {
  tempo: number;
  bars: number;
  seconds: number;
  /** The concert keys in the order they came up (a key appears once per progression played in it). */
  keys: Key[];
}

/** What the trainer reports to the model when the user stops (the model context update). */
export interface PracticeReport {
  exercise: string | null;
  progression: string;
  keyOrder: KeyOrderOption;
  instrument: Instrument;
  /** All keys practiced since the trainer was opened, in the order they first came up. */
  practicedKeys: PracticedKey[];
  /** Concert keys that have not come up yet. */
  keysNotPracticed: Key[];
  totalBars: number;
  sessions: PracticeSession[];
}

/** Records the bars the user played, over every start and stop while the trainer is open. */
export class PracticeLog {
  private readonly keys = new Map<Key, PracticedKey>();
  private readonly sessions: PracticeSession[] = [];
  private current: (PracticeSession & { startedAt: number; lastKey: Key | null }) | null = null;

  start(tempo: number, now: number): void {
    this.current = { tempo, bars: 0, seconds: 0, keys: [], startedAt: now, lastKey: null };
  }

  /** A bar became the current bar. */
  record(bar: TrainerBar): void {
    const session = this.current;
    if (!session) {
      return;
    }
    session.bars++;
    if (bar.concertKey !== session.lastKey) {
      session.keys.push(bar.concertKey);
      session.lastKey = bar.concertKey;
    }
    const practiced = this.keys.get(bar.concertKey) ?? { concertKey: bar.concertKey, writtenKey: bar.key, bars: 0 };
    practiced.bars++;
    this.keys.set(bar.concertKey, practiced);
  }

  /** The tempo changed while running; the session reports the last tempo. */
  setTempo(tempo: number): void {
    if (this.current) {
      this.current.tempo = tempo;
    }
  }

  /** Ends the running session. Returns false when nothing was running. */
  stop(now: number): boolean {
    const session = this.current;
    if (!session) {
      return false;
    }
    this.current = null;
    this.sessions.push({
      tempo: session.tempo,
      bars: session.bars,
      seconds: Math.round((now - session.startedAt) / 1000),
      keys: session.keys,
    });
    return true;
  }

  report(options: TrainerOptions): PracticeReport {
    const practicedKeys = [...this.keys.values()].map((k) => ({ ...k }));
    return {
      exercise: options.exercise,
      progression: options.progression,
      keyOrder: options.keyOrder,
      instrument: options.instrument,
      practicedKeys,
      keysNotPracticed: FLAT_KEYS.filter((key) => !this.keys.has(key)),
      totalBars: practicedKeys.reduce((sum, k) => sum + k.bars, 0),
      sessions: this.sessions.map((s) => ({ ...s, keys: [...s.keys] })),
    };
  }
}

/** The report as text for the model: what was practiced, in concert keys. */
export function formatPracticeReport(report: PracticeReport): string {
  const exercise = report.exercise
    ? `"${report.exercise}" (${report.progression})`
    : `the custom progression ${report.progression}`;
  const transposed = report.instrument !== 'C';
  const lines = [
    `The user stopped the chord trainer. They practiced ${exercise}, key order ${report.keyOrder}` +
      (transposed ? `, reading for a ${report.instrument} instrument.` : '.'),
  ];
  if (report.practicedKeys.length === 0) {
    lines.push('No bars were played yet (the trainer was stopped during the count-in).');
  } else {
    const keyList = report.practicedKeys
      .map(
        (k) => `${k.concertKey}${transposed ? ` (read as ${k.writtenKey})` : ''}: ${k.bars} ${plural(k.bars, 'bar')}`,
      )
      .join(', ');
    lines.push(`Keys practiced (concert pitch): ${keyList}.`);
    lines.push(
      report.keysNotPracticed.length > 0
        ? `Not practiced yet: ${report.keysNotPracticed.join(', ')}.`
        : 'All twelve keys have been practiced.',
    );
  }
  const last = report.sessions[report.sessions.length - 1];
  if (last) {
    lines.push(
      `Last run: ${last.bars} ${plural(last.bars, 'bar')} in ${last.seconds} s at ${last.tempo} BPM` +
        (last.keys.length > 0 ? `, keys in order: ${last.keys.join(' ')}.` : '.'),
    );
  }
  if (report.sessions.length > 1) {
    lines.push(`Since the trainer was opened: ${report.sessions.length} runs, ${report.totalBars} bars.`);
  }
  return lines.join('\n');
}

function plural(count: number, word: string): string {
  return count === 1 ? word : `${word}s`;
}

// ---------------------------------------------------------------------------------------------
// Reading the options in the app

/**
 * The trainer options from open_trainer's structuredContent, or null when the value does not
 * look like them (for example an error result). The app trusts the server for the details.
 */
export function parseTrainerOptions(value: unknown): TrainerOptions | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const v = value as Record<string, unknown>;
  const ok =
    (typeof v.exercise === 'string' || v.exercise === null) &&
    typeof v.progression === 'string' &&
    typeof v.keyOrder === 'string' &&
    (KEY_ORDER_OPTIONS as readonly string[]).includes(v.keyOrder) &&
    typeof v.instrument === 'string' &&
    (INSTRUMENTS as readonly string[]).includes(v.instrument) &&
    typeof v.tempo === 'number' &&
    typeof v.keyRatings === 'object' &&
    v.keyRatings !== null;
  if (!ok) {
    return null;
  }
  return {
    exercise: v.exercise as string | null,
    progression: v.progression as string,
    keyOrder: v.keyOrder as KeyOrderOption,
    keyRatings: v.keyRatings as Partial<Record<Key, Rating>>,
    instrument: v.instrument as Instrument,
    tempo: clampTempo(v.tempo as number),
  };
}
