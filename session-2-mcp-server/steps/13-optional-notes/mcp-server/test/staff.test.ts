import { describe, expect, it } from 'vitest';
import { barToAbc } from '../src/staff.ts';

const HEADER = 'X:1\nM:none\nL:1/4\nK:C clef=treble\n';

describe('barToAbc', () => {
  it('writes one chord as a whole bar and the octaves as ABC', () => {
    expect(barToAbc([['B3', 'D4', 'F#4', 'A4', 'C5', 'E6']])).toBe(`${HEADER}[B,D^FAce']4 |]\n`);
  });

  it('spreads the chords over the bar like the bass line', () => {
    expect(barToAbc([['D4'], ['G4']])).toBe(`${HEADER}[D]2 [G]2 |]\n`);
    expect(barToAbc([['D4'], ['G4'], ['C4']])).toBe(`${HEADER}[D]1 [G]1 [C]2 |]\n`);
    expect(barToAbc([['D4'], ['G4'], ['C4'], ['A4']])).toBe(`${HEADER}[D]1 [G]1 [C]1 [A]1 |]\n`);
  });

  it('writes double accidentals and a natural after an accidental on the same position', () => {
    // After Bbb4 and Db5 earlier in the bar, B4 and D5 need a natural sign
    expect(
      barToAbc([
        ['Eb4', 'Gb4', 'Bbb4', 'Db5'],
        ['B4', 'D5'],
      ]),
    ).toBe(`${HEADER}[_E_G__B_d]2 [=B=d]2 |]\n`);
    expect(barToAbc([['C#4', 'E##4']])).toBe(`${HEADER}[^C^^E]4 |]\n`);
  });

  it('keeps the place of a chord without notes, and gives nothing when no chord has notes', () => {
    expect(barToAbc([null, ['G4', 'B4']])).toBe(`${HEADER}x2 [GB]2 |]\n`);
    expect(barToAbc([null, null])).toBeNull();
    expect(barToAbc([])).toBeNull();
  });
});
