// Chord symbol → chord tones, for the staff in the trainer (and later the practice sheet or the
// Angular app). Tonal knows the chord types; this file adapts the symbols the chord engine
// writes and corrects the spellings Tonal gets wrong (see FIXES and test/chord-notes.test.ts).
import { Chord, Note } from 'tonal';

/** The root is placed in this octave, so the chords sit on and just above the treble staff. */
const ROOT_OCTAVE = 4;

/** Root, chord type, optional bass after a slash: 'Ebm7(b5)', 'C7/E'. */
const SYMBOL = /^([A-G](?:##?|bb?)?)(.*?)(?:\/([A-G](?:#|b)?))?$/;

/** Ways jazz writes a chord type that Tonal does not know, mapped to one it knows. */
const TYPE_ALIASES: Record<string, string> = {
  Δ: 'maj7',
  Δ7: 'maj7',
  ø7: 'ø',
  M9: 'maj9',
  M13: 'maj13',
  alt: '7alt',
  '6/9': '69',
  'm6/9': 'm69',
};

/**
 * Tonal's dictionary spells some types with the wrong interval: m7#5 and m9#5 get a minor sixth
 * (C Eb Ab Bb) where the symbol says a raised fifth (C Eb G# Bb). Each fix replaces an interval
 * when the written type contains the alteration.
 */
const FIXES: { written: RegExp; wrong: string; right: string }[] = [{ written: /#5|\+5/, wrong: '6m', right: '5A' }];

/**
 * The chord tones of a chord symbol in root position, lowest first, in scientific pitch notation
 * with the spelling the symbol implies ('Ebm7(b5)' → Eb4 Gb4 Bbb4 Db5). A slash bass goes below
 * the root. Returns null for a symbol the converter does not understand.
 */
export function chordNotes(symbol: string): string[] | null {
  const match = symbol.replace(/\s+/g, '').match(SYMBOL);
  if (!match) {
    return null;
  }
  const [, tonic = '', written = '', bass] = match;
  const type = chordType(written);
  const chord = Chord.getChord(type, tonic);
  if (chord.empty || chord.intervals.length === 0) {
    return null;
  }
  const intervals = chord.intervals.map((interval) => {
    const fix = FIXES.find((f) => f.wrong === interval && f.written.test(written));
    return fix ? fix.right : interval;
  });
  const root = `${tonic}${ROOT_OCTAVE}`;
  const notes = intervals.map((interval) => Note.transpose(root, interval));
  if (notes.some((note) => note === '')) {
    return null;
  }
  if (bass && Note.chroma(bass) !== Note.chroma(tonic)) {
    const sameOctave = `${bass}${ROOT_OCTAVE}`;
    notes.unshift((Note.midi(sameOctave) ?? 0) < (Note.midi(root) ?? 0) ? sameOctave : `${bass}${ROOT_OCTAVE - 1}`);
  }
  return notes;
}

/** The written chord type in Tonal's words: without parentheses and commas, aliases resolved. */
function chordType(written: string): string {
  const type = written.replace(/[(),]/g, '');
  const alias = TYPE_ALIASES[type] ?? TYPE_ALIASES[written];
  if (alias) {
    return alias;
  }
  // Δ9, Δ7#11: Δ stands for maj
  return type.startsWith('Δ') ? `maj${type.slice(1)}` : type;
}

/** The notes of several symbols, each symbol once. */
export function chordNotesFor(symbols: readonly string[]): { symbol: string; notes: string[] | null }[] {
  return [...new Set(symbols)].map((symbol) => ({ symbol, notes: chordNotes(symbol) }));
}
