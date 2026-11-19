import { describe, expect, it } from 'vitest';
import { EXERCISES } from '../../src/app/chord-engine/index.ts';
import { checkProgression, type WarningCode } from '../src/progression-check.ts';

function codes(progression: string): WarningCode[] {
  return checkProgression(progression, 'C').warnings.map((warning) => warning.code);
}

describe('checkProgression', () => {
  it('reads the progression bar by bar in the key, as the app shows it', () => {
    const check = checkProgression('iim*7(b5)* - V*7* | im*6*', 'Bb');
    expect(check.usable).toBe(true);
    expect(check.warnings).toEqual([]);
    expect(check.alternatives).toHaveLength(1);
    const [alternative] = check.alternatives;
    expect(alternative?.text).toBe('Cm7(b5) – F7 | Bbm6');
    expect(alternative?.bars[0]?.chords[0]).toMatchObject({
      text: 'Cm7(b5)',
      written: 'iim*7(b5)*',
      html: 'Cm<sup>7(b5)</sup>',
    });
  });

  it('lists each alternative', () => {
    const check = checkProgression('I*maj7* || Im*7*', 'D');
    expect(check.alternatives.map((a) => [a.written, a.text])).toEqual([
      ['I*maj7*', 'Dmaj7'],
      ['Im*7*', 'Dm7'],
    ]);
  });

  it('finds nothing wrong with the predefined exercises', () => {
    for (const exercise of EXERCISES) {
      expect(checkProgression(exercise.progression, 'Gb').warnings, exercise.name).toEqual([]);
    }
  });

  it('accepts a slash bass after the chord type', () => {
    expect(checkProgression('V*7*/VII | I*maj7*', 'C')).toMatchObject({
      warnings: [],
      alternatives: [{ text: 'G7/B | Cmaj7' }],
    });
  });

  const mistakes: [string, WarningCode, string][] = [
    ['V7 | I*maj7*', 'chord-type-outside-asterisks', 'Write V*7*'],
    ['iim7 - V*7*', 'chord-type-outside-asterisks', 'Write iim*7*'],
    ['Imaj7', 'chord-type-outside-asterisks', 'Write I*maj7*'],
    ['viidim7', 'numeral-in-chord-type', 'shows "BdCm7" in C. Write vii*dim7*'],
    ['Imin7', 'numeral-in-chord-type', 'Write Im*7*'],
    ['ii*7* - V*7*', 'lowercase-is-not-minor', 'shows "D7" in C. For a minor chord write iim*7*'],
    ['bVII*7*', 'flat-before-numeral', 'write VIIb, not bVII'],
    ['#IV*m7(b5)*', 'sharp', 'IV is Vb'],
    ['V*7', 'unpaired-asterisk', 'asterisk has no partner'],
    ['*7*', 'no-numeral', 'no Roman numeral before the chord type'],
    ['Dm*7*', 'no-numeral', 'reads "Dm7" in every key'],
    ['V*7*alt', 'text-after-chord-type', '"alt" after the chord type'],
    ['I | | IV', 'empty-bar', 'Bar 2: the bar is empty'],
    ['I*maj7* |', 'empty-bar', 'Bar 2'],
    ['I - ii - iii - IV - V', 'too-many-chords', 'has 5 chords'],
    ['I*maj7* ||', 'empty-alternative', 'Alternative 2 has no chords'],
  ];

  for (const [progression, code, message] of mistakes) {
    it(`warns about ${code} in "${progression}"`, () => {
      const { warnings } = checkProgression(progression, 'C');
      expect(warnings.map((w) => w.code)).toContain(code);
      expect(warnings.find((w) => w.code === code)?.message).toContain(message);
    });
  }

  it('says where the mistake is', () => {
    expect(checkProgression('I*maj7* || iim*7* - V7', 'C').warnings).toEqual([
      expect.objectContaining({ code: 'chord-type-outside-asterisks', alternative: 2, bar: 1, chord: 2 }),
    ]);
  });

  it('does not take a lower-case numeral with a minor or other chord type for a mistake', () => {
    expect(codes('vii*dim7* | iim*7* | vi*m7*')).toEqual([]);
  });

  it('marks a progression without chords as unusable', () => {
    for (const progression of ['|', ' | | ', '||', '** - **']) {
      const check = checkProgression(progression, 'C');
      expect(check.usable, progression).toBe(false);
      expect(check.warnings.map((w) => w.code)).toEqual(['no-chords']);
    }
  });
});
