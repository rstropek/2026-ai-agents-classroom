import { describe, expect, it } from 'vitest';
import { FLAT_KEYS } from '../src/chord-engine.ts';
import { chordNotes, chordNotesFor } from '../src/chord-notes.ts';
import { PREDEFINED_EXERCISES, progressionText } from '../src/sheet.ts';
import { allChordSymbols } from '../src/trainer.ts';

const LETTERS = 'CDEFGAB';
const STEPS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Half steps above C0, worked out from the spelling alone (not with Tonal). */
function midi(note: string): number {
  const [, letter = '', accidental = '', octave = ''] = note.match(/^([A-G])(#*|b*)(\d)$/) ?? [];
  const shift = accidental.startsWith('#') ? accidental.length : -accidental.length;
  return Number(octave) * 12 + (STEPS[letter] ?? Number.NaN) + shift;
}

function letterIndex(note: string): number {
  return LETTERS.indexOf(note[0] ?? '') + 7 * Number(note.slice(-1));
}

/**
 * The chord types of the predefined exercises: half steps above the root and how many letters
 * each chord tone lies above the root (stacked thirds; the sixth sits a sixth above).
 */
const EXERCISE_TYPES: { type: RegExp; halfSteps: number[]; letters: number[] }[] = [
  { type: /^[A-G][#b]?maj7$/, halfSteps: [0, 4, 7, 11], letters: [0, 2, 4, 6] },
  { type: /^[A-G][#b]?m7$/, halfSteps: [0, 3, 7, 10], letters: [0, 2, 4, 6] },
  { type: /^[A-G][#b]?7$/, halfSteps: [0, 4, 7, 10], letters: [0, 2, 4, 6] },
  { type: /^[A-G][#b]?m7\(b5\)$/, halfSteps: [0, 3, 6, 10], letters: [0, 2, 4, 6] },
  { type: /^[A-G][#b]?m6$/, halfSteps: [0, 3, 7, 9], letters: [0, 2, 4, 5] },
];

describe('chordNotes', () => {
  it('spells every chord of every predefined exercise in every key correctly', () => {
    const symbols = PREDEFINED_EXERCISES.flatMap((exercise) => allChordSymbols(progressionText(exercise.progression)));
    expect(new Set(symbols).size).toBeGreaterThan(50);
    for (const symbol of new Set(symbols)) {
      const expected = EXERCISE_TYPES.find((t) => t.type.test(symbol));
      expect(expected, symbol).toBeDefined();
      const notes = chordNotes(symbol);
      expect(notes, symbol).not.toBeNull();
      const [root = ''] = notes ?? [];
      // The root is the note of the symbol, and every tone has the right letter and the right pitch
      expect(root.slice(0, -1), symbol).toBe(symbol.match(/^[A-G][#b]?/)?.[0]);
      expect(
        notes?.map((n) => midi(n) - midi(root)),
        symbol,
      ).toEqual(expected?.halfSteps);
      expect(
        notes?.map((n) => letterIndex(n) - letterIndex(root)),
        symbol,
      ).toEqual(expected?.letters);
    }
  });

  it('spells tricky chords of the exercises with double flats and sharps where theory needs them', () => {
    expect(chordNotes('Ebm7(b5)')).toEqual(['Eb4', 'Gb4', 'Bbb4', 'Db5']);
    expect(chordNotes('Abm7(b5)')).toEqual(['Ab4', 'Cb5', 'Ebb5', 'Gb5']);
    expect(chordNotes('C#m7(b5)')).toEqual(['C#4', 'E4', 'G4', 'B4']);
    expect(chordNotes('Gbm6')).toEqual(['Gb4', 'Bbb4', 'Db5', 'Eb5']);
    expect(chordNotes('Dbm6')).toEqual(['Db4', 'Fb4', 'Ab4', 'Bb4']);
    expect(chordNotes('F#7')).toEqual(['F#4', 'A#4', 'C#5', 'E5']);
    expect(chordNotes('Bmaj7')).toEqual(['B4', 'D#5', 'F#5', 'A#5']);
  });

  it('corrects what Tonal spells wrong', () => {
    // Tonal: C Eb Ab Bb (a minor sixth instead of the raised fifth)
    expect(chordNotes('Cm7#5')).toEqual(['C4', 'Eb4', 'G#4', 'Bb4']);
    expect(chordNotes('Cm7(#5)')).toEqual(['C4', 'Eb4', 'G#4', 'Bb4']);
    expect(chordNotes('Dm9#5')).toEqual(['D4', 'F4', 'A#4', 'C5', 'E5']);
  });

  it('reads jazz spellings Tonal does not know', () => {
    expect(chordNotes('CΔ7')).toEqual(['C4', 'E4', 'G4', 'B4']);
    expect(chordNotes('CΔ')).toEqual(['C4', 'E4', 'G4', 'B4']);
    expect(chordNotes('Cø7')).toEqual(['C4', 'Eb4', 'Gb4', 'Bb4']);
    expect(chordNotes('C6/9')).toEqual(['C4', 'E4', 'G4', 'A4', 'D5']);
    expect(chordNotes('C7(b9)')).toEqual(['C4', 'E4', 'G4', 'Bb4', 'Db5']);
    expect(chordNotes('C7(b9,#11)')).toEqual(['C4', 'E4', 'G4', 'Bb4', 'Db5', 'F#5']);
    expect(chordNotes('Bbdim7')).toEqual(['Bb4', 'Db5', 'Fb5', 'Abb5']);
  });

  it('puts a slash bass below the root', () => {
    expect(chordNotes('C7/E')).toEqual(['E3', 'C4', 'E4', 'G4', 'Bb4']);
    expect(chordNotes('F/C')).toEqual(['C4', 'F4', 'A4', 'C5']);
  });

  it('gives no notes for what it does not understand', () => {
    expect(chordNotes('Cxyz')).toBeNull();
    expect(chordNotes('Hm7')).toBeNull();
    expect(chordNotes('*')).toBeNull();
    expect(chordNotes('')).toBeNull();
  });

  it('answers each symbol once', () => {
    expect(chordNotesFor(['Dm7', 'G7', 'Dm7']).map((c) => c.symbol)).toEqual(['Dm7', 'G7']);
  });
});

describe('allChordSymbols', () => {
  it('lists the chords of every alternative in all twelve keys', () => {
    const symbols = allChordSymbols('I*maj7* || Im*7*');
    expect(symbols).toHaveLength(2 * FLAT_KEYS.length);
    expect(symbols).toContain('Gbmaj7');
    expect(symbols).toContain('Bm7');
  });
});
