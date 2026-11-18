import { describe, expect, it } from 'vitest';
import { EXERCISES } from '../src/chord-engine.ts';
import { checkProgression, findMistakes } from '../src/progression-check.ts';

function codes(progression: string): string[] {
  return findMistakes(progression).map((warning) => warning.code);
}

describe('checkProgression', () => {
  it('shows the bars, chords and superscripts in the given key', () => {
    const check = checkProgression('iim*7* - V*7* | I*maj7*', 'Bb');
    expect(check.alternatives).toEqual([
      {
        source: 'iim*7* - V*7* | I*maj7*',
        bars: [
          {
            text: 'Cm7 – F7',
            chords: [
              { text: 'Cm7', root: 'C', superscript: '7' },
              { text: 'F7', root: 'F', superscript: '7' },
            ],
          },
          { text: 'Bbmaj7', chords: [{ text: 'Bbmaj7', root: 'Bb', superscript: 'maj7' }] },
        ],
      },
    ]);
    expect(check.warnings).toEqual([]);
  });

  it('lists each alternative', () => {
    const check = checkProgression('I*maj7* || Im*7*', 'C');
    expect(check.alternatives.map((alternative) => alternative.bars[0]?.text)).toEqual(['Cmaj7', 'Cm7']);
  });
});

describe('findMistakes', () => {
  it('finds nothing wrong in the predefined exercises', () => {
    for (const exercise of EXERCISES) {
      const progressions = typeof exercise.progression === 'string' ? [exercise.progression] : exercise.progression;
      for (const progression of progressions) {
        expect(findMistakes(progression), progression).toEqual([]);
      }
    }
    expect(findMistakes('viim*7(b5)* - III*7* | vim*7*')).toEqual([]);
    expect(findMistakes('IV*7* - VIIb*7* | I*maj7*')).toEqual([]);
    expect(findMistakes('vii*dim7*')).toEqual([]);
  });

  it('warns about a chord type outside the asterisks and shows how to write it', () => {
    const [warning] = findMistakes('iim7 - V*7*');
    expect(warning?.code).toBe('type-outside-asterisks');
    expect(warning?.message).toContain('Write iim*7*');
    expect(findMistakes('Imaj7')[0]?.message).toContain('Write I*maj7*');
    expect(findMistakes('viidim7')[0]?.message).toMatch(/read as numerals.*Write vii\*dim7\*/);
  });

  it('warns about a flat before the numeral', () => {
    expect(codes('bVII*7* | I*maj7*')).toEqual(['flat-before-numeral']);
    expect(findMistakes('bVII*7*')[0]?.message).toContain('VIIb');
  });

  it('warns about sharps, note names and lower-case numerals meant as minor', () => {
    expect(codes('#IV*m7(b5)*')).toEqual(['sharp-numeral']);
    expect(codes('Dm*7* - G*7*')).toEqual(['no-numeral', 'no-numeral']);
    expect(codes('ii*7* - V*7*')).toEqual(['lowercase-not-minor']);
  });

  it('warns about unpaired asterisks and separators inside asterisks', () => {
    expect(codes('iim*7 - V*7*')).toEqual(['unclosed-asterisk']);
    expect(codes('iim*7 - V*7* | I*maj7*')).toEqual(['unclosed-asterisk']);
    expect(codes('iim*7 | V*7')).toEqual(['separator-inside-asterisks']);
  });

  it('warns about empty bars, empty chords and too many chords', () => {
    expect(codes('iim*7* - V*7* |')).toEqual(['empty-bar']);
    expect(codes('iim*7* - - V*7*')).toEqual(['empty-chord']);
    expect(codes('I - IV - V - I - IV')).toEqual(['too-many-chords']);
    expect(codes('  ')).toEqual(['empty']);
  });
});
