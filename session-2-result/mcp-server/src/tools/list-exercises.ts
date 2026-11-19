import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { alternatives, CUSTOM_EXERCISE, EXERCISES } from '../../../src/app/chord-engine/index.ts';
import { checkProgression } from '../progression-check.ts';

/** The exercises a sheet can use by name; the app's "Custom" is the user's own progression instead. */
export const PREDEFINED_EXERCISES = EXERCISES.filter((exercise) => exercise.name !== CUSTOM_EXERCISE);

export const PROGRESSION_SYNTAX = `How to write a custom progression (the syntax of the app's "Custom" exercise):
- Each chord starts with a Roman numeral for the scale degree of the major key: I, II, III, IV, V, VI, VII. In C: I = C, II = D, III = E, IV = F, V = G, VI = A, VII = B. Upper and lower case mean the same; lower case does NOT make a chord minor.
- A trailing b lowers the degree a half step: IIb, IIIb, Vb, VIb, VIIb (write VIIb, not bVII). There are no sharp degrees: write Vb for #IV.
- m right after the numeral makes the chord minor: iim becomes Dm in C.
- The chord type goes between asterisks, such as *7*, *maj7*, *6*, *7(b5)*, *dim7*, *7(#11)*. It is shown in superscript and kept exactly as written. Outside the asterisks every i and v is read as a numeral, so write vii*dim7*, never viidim7, and I*maj7*, not Imaj7.
- "-" separates chords in the same bar (up to four per bar), "|" starts the next bar, "||" separates alternatives: one of them is picked at random for each key.
- A slash bass may follow the chord type: V*7*/VII becomes G7/B in C.
- Chords in G, D, A, E and B are spelled with sharps, in all other keys with flats.
Examples in C: "iim*7* - V*7* | I*maj7*" is Dm7 – G7 | Cmaj7; "viim*7(b5)* - III*7* | vim*7*" is Bm7(b5) – E7 | Am7; "IV*7* - VIIb*7* | I*maj7*" is F7 – Bb7 | Cmaj7; "I*maj7* || Im*7* || I*7*" is one of Cmaj7, Cm7, C7.
Check a progression with check_progression before you generate a sheet with it.`;

const outputSchema = z.object({
  exercises: z.array(
    z.object({
      name: z.string().describe('Pass this as `exercise` to generate_exercise_sheet'),
      alternatives: z
        .array(z.string())
        .describe('The progression; with several alternatives, one is picked at random for each key'),
      inC: z.array(z.string()).describe('Each alternative in C, bars separated by " | "'),
    }),
  ),
  syntax: z.string().describe('How to write a custom progression'),
});

export function registerListExercises(server: McpServer): void {
  server.registerTool(
    'list_exercises',
    {
      title: 'List exercises',
      description:
        'List the predefined jazz chord exercises of the Practice Jazz Chords app (name, progression, and what it ' +
        'looks like in C) and explain how to write a custom progression. Use a name with ' +
        'generate_exercise_sheet, or write your own progression following the syntax. Takes no parameters.',
      inputSchema: z.strictObject({}),
      outputSchema,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async () => {
      const exercises = PREDEFINED_EXERCISES.map((exercise) => {
        const list = alternatives(exercise.progression).map((alternative) => alternative.trim());
        return { name: exercise.name, alternatives: list, inC: list.map(inC) };
      });
      const lines = exercises.map((exercise) => {
        const several = exercise.alternatives.length > 1;
        const progression = exercise.alternatives.join(' || ');
        const note = several ? ', one alternative picked at random for each key' : '';
        return `- "${exercise.name}": ${progression} (in C: ${exercise.inC.join(' or ')}${note})`;
      });
      const text = [
        'Predefined exercises (pass the name as `exercise` to generate_exercise_sheet):',
        ...lines,
        '',
        'Or pass your own progression as `progression` instead.',
        PROGRESSION_SYNTAX,
      ].join('\n');
      return { content: [{ type: 'text', text }], structuredContent: { exercises, syntax: PROGRESSION_SYNTAX } };
    },
  );
}

/** One alternative in C, as the app shows it. */
function inC(alternative: string): string {
  return checkProgression(alternative, 'C').alternatives[0]?.text ?? '';
}
