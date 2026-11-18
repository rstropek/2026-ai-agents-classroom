// One bar of chord tones as ABC notation, for abcjs in the trainer. No dependencies, so the
// browser bundle stays free of Tonal: the notes come from the chord_notes tool.

/** How many quarter notes each chord gets, as the app's bass line spreads the chords over the bar. */
function durations(count: number): number[] {
  switch (count) {
    case 1:
      return [4];
    case 2:
      return [2, 2];
    case 3:
      return [1, 1, 2];
    default:
      return Array.from({ length: count }, () => 1);
  }
}

const NOTE = /^([A-G])(#{1,2}|b{1,2})?(-?\d+)$/;
const ACCIDENTALS: Record<string, string> = { '': '=', '#': '^', '##': '^^', b: '_', bb: '__' };

/**
 * The ABC for one bar: each chord a stacked chord ([DFAc]), a chord without notes an invisible
 * rest, so the others keep their place. Accidentals hold to the end of the bar as in print, so a
 * natural gets an explicit ♮ after a sharp or flat on the same line or space. Returns null when
 * no chord of the bar has notes.
 */
export function barToAbc(chords: readonly (readonly string[] | null)[]): string | null {
  if (!chords.some((notes) => notes && notes.length > 0)) {
    return null;
  }
  const lengths = durations(chords.length);
  /** The accidental in force for each staff position in this bar ('' natural). */
  const inForce = new Map<string, string>();
  const body = chords
    .map((notes, index) => {
      const length = lengths[index] ?? 1;
      const pitches = (notes ?? []).map((note) => abcNote(note, inForce)).filter((pitch) => pitch !== null);
      return pitches.length > 0 ? `[${pitches.join('')}]${length}` : `x${length}`;
    })
    .join(' ');
  // No time signature: the bar shows the chords, not a meter. L:1/4 makes the lengths quarter notes.
  return `X:1\nM:none\nL:1/4\nK:C clef=treble\n${body} |]\n`;
}

/** 'Eb4' → '_E', 'C#5' → '^c', 'A3' → 'A,'. Null for text that is not a note with an octave. */
function abcNote(note: string, inForce: Map<string, string>): string | null {
  const match = note.match(NOTE);
  if (!match) {
    return null;
  }
  const [, letter = 'C', accidental = '', octaveText = '4'] = match;
  const octave = Number(octaveText);
  const position = `${letter}${octave}`;
  const before = inForce.get(position) ?? '';
  // Sharps and flats are written on every chord (clearer to read); a natural only after an accidental
  const mark = accidental !== '' || before !== '' ? (ACCIDENTALS[accidental] ?? '') : '';
  inForce.set(position, accidental);
  const name = octave >= 5 ? letter.toLowerCase() : letter;
  const ticks = octave >= 5 ? "'".repeat(octave - 5) : ','.repeat(4 - octave);
  return `${mark}${name}${ticks}`;
}
