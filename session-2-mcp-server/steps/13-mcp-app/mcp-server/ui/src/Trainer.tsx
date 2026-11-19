import type { App } from '@modelcontextprotocol/ext-apps';
import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import type { Chord } from '../../src/chord-engine.ts';
import {
  BEATS_PER_BAR,
  barText,
  clampTempo,
  formatPracticeReport,
  MAX_TEMPO,
  MIN_TEMPO,
  PracticeLog,
  type TrainerBar,
  type TrainerOptions,
  trainerSequence,
} from '../../src/trainer.ts';

interface TrainerProps {
  app: App;
  options: TrainerOptions;
  /** Set to what has to happen before the host removes the app. */
  beforeTeardown: RefObject<() => Promise<void>>;
}

const KEY_ORDER_NAMES: Record<TrainerOptions['keyOrder'], string> = {
  balanced: 'Balanced',
  random: 'Random',
  'weighted-cycle': 'Weighted cycle',
  'fourths-up': 'Perfect 4th up',
  'fourths-down': 'Perfect 4th down',
};

/**
 * The practice view: the current bar large, the next bar small, a beat counter, start, stop and
 * tempo. After a one-bar count-in the bar changes every four beats. No sound.
 */
export function Trainer({ app, options, beforeTeardown }: TrainerProps) {
  const [tempo, setTempoState] = useState(options.tempo);
  const [running, setRunning] = useState(false);
  /** Beats since Start, counting the count-in bar; -1 when stopped. */
  const [beat, setBeat] = useState(-1);
  const [current, setCurrent] = useState<TrainerBar | null>(null);
  const [next, setNext] = useState<TrainerBar | null>(null);
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null);

  const tempoRef = useRef(tempo);
  const sequence = useRef<ReturnType<typeof trainerSequence> | null>(null);
  const nextBar = useRef<TrainerBar | null>(null);
  const log = useRef(new PracticeLog());
  const runningRef = useRef(false);

  const onBeat = useCallback((count: number) => {
    setBeat(count);
    if (count === 0 || count % BEATS_PER_BAR !== 0 || !sequence.current) {
      return;
    }
    // A new bar: the next bar becomes the current one
    const bar = nextBar.current;
    const following = sequence.current.next();
    nextBar.current = following;
    if (bar) {
      log.current.record(bar);
    }
    setCurrent(bar);
    setNext(following);
  }, []);

  useBeatClock(running, tempoRef, onBeat);

  const report = useCallback(async () => {
    const practice = log.current.report(options);
    try {
      await app.updateModelContext({
        content: [{ type: 'text', text: formatPracticeReport(practice) }],
        structuredContent: { ...practice },
      });
      const keys = practice.practicedKeys.map((k) => k.concertKey).join(', ');
      setStatus({ text: keys ? `Told the chat you practiced ${keys}.` : 'Told the chat: no bars played yet.' });
    } catch (error) {
      setStatus({
        text: `Could not tell the chat what you practiced: ${error instanceof Error ? error.message : String(error)}`,
        error: true,
      });
    }
  }, [app, options]);

  const start = useCallback(() => {
    if (runningRef.current) {
      return;
    }
    const bars = trainerSequence(options);
    const first = bars.next();
    sequence.current = bars;
    nextBar.current = first;
    setCurrent(null);
    setNext(first);
    setBeat(-1);
    setStatus(null);
    log.current.start(tempoRef.current, performance.now());
    runningRef.current = true;
    setRunning(true);
  }, [options]);

  const stop = useCallback(async () => {
    if (!runningRef.current) {
      return;
    }
    runningRef.current = false;
    setRunning(false);
    setBeat(-1);
    setCurrent(null);
    setNext(null);
    log.current.stop(performance.now());
    await report();
  }, [report]);

  // Before the host removes the app, a running trainer stops and reports like the Stop button
  useEffect(() => {
    beforeTeardown.current = stop;
  }, [beforeTeardown, stop]);

  const setTempo = useCallback((value: number) => {
    const clamped = clampTempo(value);
    tempoRef.current = clamped;
    log.current.setTempo(clamped);
    setTempoState(clamped);
  }, []);

  // Keyboard like the app: Space starts and stops, arrows change the tempo (Ctrl: by 10)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) {
        return;
      }
      if (event.key === ' ' && !(event.target instanceof HTMLButtonElement)) {
        event.preventDefault();
        void (runningRef.current ? stop() : start());
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        const step = event.ctrlKey || event.metaKey ? 10 : 1;
        setTempo(tempoRef.current + (event.key === 'ArrowLeft' ? -step : step));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [start, stop, setTempo]);

  const countIn = running && beat < BEATS_PER_BAR;
  const beatInBar = beat >= 0 ? beat % BEATS_PER_BAR : -1;
  const transposed = options.instrument !== 'C';
  const exerciseName = options.exercise ?? 'Custom progression';

  return (
    <div className="stage-wrap">
      <section className="stage" aria-label="Chord trainer">
        <div className="next" data-chords={next?.chords.length ?? 0}>
          <span className="label">next{next ? ` · ${keyLabel(next, transposed)}` : ''}</span>
          {running && next ? (
            <BarView bar={next} />
          ) : (
            <span className="idle-next" title={options.progression}>
              {exerciseName}
            </span>
          )}
        </div>
        <div className={`current${running ? '' : ' idle'}`} data-chords={current?.chords.length ?? 0}>
          <span className="label">play{current ? ` · ${keyLabel(current, transposed)}` : ''}</span>
          {!running ? (
            <span className="idle-text">
              Press Start to begin
              <small>one bar count-in at {tempo} BPM</small>
            </span>
          ) : countIn ? (
            <span className="countdown" aria-live="off">
              {BEATS_PER_BAR - Math.max(0, beat)}
            </span>
          ) : current ? (
            <BarView bar={current} />
          ) : null}
        </div>
        <div className="beats" role="img" aria-label={beatInBar >= 0 ? `Beat ${beatInBar + 1} of 4` : 'Stopped'}>
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={`beat${beatInBar === i ? ' now' : ''}${beatInBar > i ? ' past' : ''}${countIn ? ' count-in' : ''}`}
            />
          ))}
        </div>
      </section>

      <div className="controls">
        <div className="transport">
          <button type="button" className="start" onClick={start} disabled={running} title="Start (Space)">
            <span aria-hidden="true">▶</span> Start
          </button>
          <button type="button" className="stop" onClick={() => void stop()} disabled={!running} title="Stop (Space)">
            <span aria-hidden="true">■</span> Stop
          </button>
        </div>
        <TempoControl tempo={tempo} onChange={setTempo} />
      </div>

      <p className="details">
        {exerciseName}: <code>{options.progression}</code> · {KEY_ORDER_NAMES[options.keyOrder]}
        {transposed ? ` · ${options.instrument} instrument (written keys, concert key in brackets)` : ''}
      </p>
      {status ? (
        <p className={`status${status.error ? ' error' : ''}`} role="status">
          {status.text}
        </p>
      ) : null}
    </div>
  );
}

function keyLabel(bar: TrainerBar, transposed: boolean): string {
  return transposed ? `${bar.key} [${bar.concertKey}]` : bar.key;
}

function BarView({ bar }: { bar: TrainerBar }) {
  if (bar.chords.length === 0) {
    return <span className="bar">–</span>;
  }
  return (
    <span className="bar" title={barText(bar)}>
      {bar.chords.map((chord, position) => (
        // The chords of a bar never move, and the same chord may occur twice: the position is the identity
        // biome-ignore lint/suspicious/noArrayIndexKey: see above
        <ChordView key={position} chord={chord} />
      ))}
    </span>
  );
}

function ChordView({ chord }: { chord: Chord }) {
  return (
    <span className="chord">
      {chord.parts.map((part, position) =>
        // biome-ignore lint/suspicious/noArrayIndexKey: the parts of a chord are fixed
        part.superscript ? <sup key={position}>{part.text}</sup> : <span key={position}>{part.text}</span>,
      )}
    </span>
  );
}

function TempoControl({ tempo, onChange }: { tempo: number; onChange: (tempo: number) => void }) {
  const [draft, setDraft] = useState(String(tempo));
  useEffect(() => setDraft(String(tempo)), [tempo]);

  const commit = () => {
    const typed = Number.parseInt(draft, 10);
    if (Number.isFinite(typed)) {
      onChange(typed);
    }
    setDraft(String(Number.isFinite(typed) ? clampTempo(typed) : tempo));
  };

  return (
    <div className="tempo">
      <button type="button" onClick={() => onChange(tempo - 10)} aria-label="Slower by 10 BPM" title="Ctrl + ←">
        −10
      </button>
      <button type="button" onClick={() => onChange(tempo - 1)} aria-label="Slower by 1 BPM" title="←">
        −1
      </button>
      <label>
        <input
          type="number"
          inputMode="numeric"
          min={MIN_TEMPO}
          max={MAX_TEMPO}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              commit();
            }
          }}
          aria-label="Tempo in BPM"
        />
        <span>BPM</span>
      </label>
      <button type="button" onClick={() => onChange(tempo + 1)} aria-label="Faster by 1 BPM" title="→">
        +1
      </button>
      <button type="button" onClick={() => onChange(tempo + 10)} aria-label="Faster by 10 BPM" title="Ctrl + →">
        +10
      </button>
    </div>
  );
}

/**
 * Calls onBeat(0), onBeat(1), … while running, one beat apart at the tempo. Each beat is timed
 * from the previous one (not from Start), so a tempo change applies from the next beat on, and
 * a late timer does not shift the beats after it.
 */
function useBeatClock(running: boolean, tempo: RefObject<number>, onBeat: (count: number) => void): void {
  useEffect(() => {
    if (!running) {
      return;
    }
    let count = 0;
    let due = performance.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      onBeat(count);
      count++;
      due += 60_000 / tempo.current;
      timer = setTimeout(tick, Math.max(0, due - performance.now()));
    };
    tick();
    return () => clearTimeout(timer);
  }, [running, tempo, onBeat]);
}
