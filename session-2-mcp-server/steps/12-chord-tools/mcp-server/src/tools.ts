import type { CallToolResult, McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import {
  chordToText,
  FLAT_KEYS,
  findExercise,
  type Key,
  progressionInKey,
  type Rating,
  seededRandom,
} from './chord-engine.ts';
import { checkProgression, findMistakes, formatCheck } from './progression-check.ts';
import {
  formatSheet,
  generateSheet,
  INSTRUMENT_DESCRIPTIONS,
  INSTRUMENTS,
  KEY_ORDER_DESCRIPTIONS,
  KEY_ORDER_OPTIONS,
  KEYS_PER_ROW,
  PREDEFINED_EXERCISES,
  PROGRESSION_SYNTAX,
  progressionText,
} from './sheet.ts';

const MAX_SEED = 2 ** 32 - 1;
const MAX_ROWS = 24;

const exerciseNames = PREDEFINED_EXERCISES.map((exercise) => exercise.name) as [string, ...string[]];

const keySchema = z.enum(FLAT_KEYS);
const keyListText = FLAT_KEYS.join(', ');

const warningSchema = z.object({
  code: z.string().describe('Kind of mistake, for example type-outside-asterisks'),
  message: z.string().describe('What is wrong and how to write it instead'),
});

const ratingSchema = z.number().int().min(1).max(5);
const keyRatingsSchema = z
  .object(
    Object.fromEntries(FLAT_KEYS.map((key) => [key, ratingSchema.optional()])) as Record<
      Key,
      z.ZodOptional<typeof ratingSchema>
    >,
  )
  .strict()
  .describe(
    'Only for keyOrder "random" or "weighted-cycle": how well the player knows each concert key, 1 (unfamiliar, comes up most often) ' +
      `to 5 (well known, comes up least often). Keys are named with flats (${keyListText}); keys left out count as 1. ` +
      'Example: {"C": 5, "F": 4, "Gb": 1}.',
  );

// ---------------------------------------------------------------------------------------------
// list_exercises

const listExercisesOutput = z.object({
  exercises: z.array(
    z.object({
      name: z.string().describe('Exact name to pass as "exercise" to generate_exercise_sheet'),
      progression: z.string().describe('The progression in the app syntax; " || " separates alternatives'),
      inC: z.string().describe('The progression in C, for example "Dm7 – G7 | Cmaj7"'),
    }),
  ),
  syntax: z.string().describe('How to write a custom progression'),
});

function listExercises(): CallToolResult {
  const exercises = PREDEFINED_EXERCISES.map((exercise) => ({
    name: exercise.name,
    progression: progressionText(exercise.progression),
    inC: progressionText(exercise.progression)
      .split(' || ')
      .map((alternative) =>
        progressionInKey(alternative, 'C')
          .map((bar) => bar.chords.map(chordToText).join(' – '))
          .join(' | '),
      )
      .join(' or '),
  }));
  const text = [
    'Predefined exercises (name: progression → in C):',
    ...exercises.map((e) => `- ${e.name}: ${e.progression} → ${e.inC}`),
    '',
    PROGRESSION_SYNTAX,
  ].join('\n');
  return { content: [{ type: 'text', text }], structuredContent: { exercises, syntax: PROGRESSION_SYNTAX } };
}

// ---------------------------------------------------------------------------------------------
// generate_exercise_sheet

const generateInput = z.strictObject({
  exercise: z
    .enum(exerciseNames)
    .optional()
    .describe(
      'A predefined exercise, by its exact name (see list_exercises). Give either "exercise" or "progression", not both.',
    ),
  progression: z
    .string()
    .min(1)
    .optional()
    .describe(
      'A custom progression in the app syntax instead of a predefined exercise, for example "iim*7* - V*7* | I*maj7*": ' +
        'Roman numerals, the chord type between asterisks, " - " between chords, " | " between bars, " || " between alternatives. ' +
        'Check it with check_progression first. Give either "exercise" or "progression", not both.',
    ),
  rows: z.number().int().min(1).max(MAX_ROWS).default(4).describe('Number of rows on the sheet (default 4).'),
  keyOrder: z
    .enum(KEY_ORDER_OPTIONS)
    .default('balanced')
    .describe(
      `How the keys are ordered (default "balanced"). ${KEY_ORDER_OPTIONS.map((o) => `"${o}": ${KEY_ORDER_DESCRIPTIONS[o]}`).join('; ')}.`,
    ),
  keys: z
    .array(keySchema)
    .min(2)
    .max(12)
    .optional()
    .describe(
      'Only for keyOrder "balanced": the concert keys to practice; each row then lists exactly these keys once. ' +
        `Default: all 12. Keys are named with flats: ${keyListText} (write Db, not C#).`,
    ),
  keyRatings: keyRatingsSchema.optional(),
  instrument: z
    .enum(INSTRUMENTS)
    .default('C')
    .describe(
      `The instrument the sheet is written for (default "C"). ${INSTRUMENTS.map((t) => `"${t}": ${INSTRUMENT_DESCRIPTIONS[t]}`).join('; ')}. ` +
        'With Bb, Eb or F each cell shows the written key and chords; "keys" and "keyRatings" are always concert keys.',
    ),
  seed: z
    .number()
    .int()
    .min(0)
    .max(MAX_SEED)
    .optional()
    .describe(
      'Random seed. The same seed with the same other options gives the same sheet again. Leave it out for a new sheet; the result reports the seed it used.',
    ),
});

const cellSchema = z.object({
  key: keySchema.describe('The key the player reads (written pitch; the concert key when instrument is "C")'),
  concertKey: keySchema.describe('The key in concert pitch'),
  bars: z.array(z.array(z.string())).describe('The chords of each bar, for example [["Dm7", "G7"], ["Cmaj7"]]'),
  text: z.string().describe('The cell as text, for example "Dm7 – G7 | Cmaj7"'),
});

const generateOutput = z.object({
  exercise: z.string().nullable().describe('Name of the predefined exercise; null for a custom progression'),
  progression: z.string().describe('The progression in the app syntax'),
  keyOrder: z.enum(KEY_ORDER_OPTIONS),
  instrument: z.enum(INSTRUMENTS),
  seed: z.number().int().min(0).max(MAX_SEED).describe('The seed used; pass it again to get the same sheet'),
  rows: z.array(z.object({ cells: z.array(cellSchema) })),
  warnings: z
    .array(warningSchema)
    .describe('Possible mistakes in a custom progression; empty for predefined exercises'),
});

function toolError(text: string): CallToolResult {
  return { content: [{ type: 'text', text }], isError: true };
}

function generateExerciseSheet(args: z.infer<typeof generateInput>): CallToolResult {
  if ((args.exercise === undefined) === (args.progression === undefined)) {
    return toolError(
      'Give exactly one of "exercise" (a predefined exercise name from list_exercises) or "progression" (a custom progression such as "iim*7* - V*7* | I*maj7*").',
    );
  }
  if (args.keys && args.keyOrder !== 'balanced') {
    return toolError(
      `"keys" only works with keyOrder "balanced"; the key order "${args.keyOrder}" always uses all 12 keys. Remove "keys" or use keyOrder "balanced".`,
    );
  }
  if (args.keys && new Set(args.keys).size !== args.keys.length) {
    return toolError(`"keys" lists a key more than once: ${args.keys.join(', ')}. List each key once.`);
  }
  if (args.keyRatings && args.keyOrder !== 'random' && args.keyOrder !== 'weighted-cycle') {
    return toolError(
      `"keyRatings" only work with keyOrder "random" or "weighted-cycle"; "${args.keyOrder}" ignores them. Remove "keyRatings" or change keyOrder.`,
    );
  }

  const progression = args.exercise
    ? (findExercise(args.exercise)?.progression ?? '')
    : (args.progression ?? '').trim();
  const seed = args.seed ?? Math.floor(Math.random() * (MAX_SEED + 1));
  const sheet = generateSheet({
    progression,
    rows: args.rows,
    keyOrder: args.keyOrder,
    keys: args.keys,
    ratings: args.keyRatings as Partial<Record<Key, Rating>> | undefined,
    instrument: args.instrument,
    random: seededRandom(seed),
  });

  const output: z.infer<typeof generateOutput> = {
    exercise: args.exercise ?? null,
    progression: progressionText(progression),
    keyOrder: args.keyOrder,
    instrument: args.instrument,
    seed,
    rows: sheet.map((cells) => ({ cells })),
    warnings: args.progression ? findMistakes(args.progression) : [],
  };
  let text = formatSheet(output);
  if (output.warnings.length > 0) {
    text += `\n\nPossible mistakes in the progression:\n${output.warnings.map((w) => `  - ${w.message}`).join('\n')}`;
  }
  return { content: [{ type: 'text', text }], structuredContent: output };
}

// ---------------------------------------------------------------------------------------------
// check_progression

const checkInput = z.strictObject({
  progression: z
    .string()
    .describe('The custom progression to check, in the app syntax, for example "iim*7* - V*7* | I*maj7*".'),
  key: keySchema
    .default('C')
    .describe(`The concert key to show the chords in (default "C"). Keys are named with flats: ${keyListText}.`),
});

const checkOutput = z.object({
  progression: z.string(),
  key: keySchema,
  alternatives: z
    .array(
      z.object({
        source: z.string().describe('The alternative as written'),
        bars: z.array(
          z.object({
            text: z.string().describe('The bar as text, for example "Dm7 – G7"'),
            chords: z.array(
              z.object({
                text: z.string().describe('The chord as plain text, for example "Dm7"'),
                root: z.string().nullable().describe('The note the chord is built on; null if it starts with no note'),
                superscript: z.string().describe('The part shown in superscript (the chord type); "" if none'),
              }),
            ),
          }),
        ),
      }),
    )
    .describe('Each alternative (separated by "||") as the app shows it; the app picks one at random per key'),
  warnings: z.array(warningSchema).describe('Likely mistakes; empty when the progression looks fine'),
});

// ---------------------------------------------------------------------------------------------

/** Registers the practice sheet tools. */
export function registerTools(server: McpServer): void {
  server.registerTool(
    'list_exercises',
    {
      title: 'List exercises',
      description:
        'Lists the predefined exercises of the Practice Jazz Chords app (for example "ii7 - V7 - Imaj7 (two bars)") with their ' +
        'chord progressions in Roman numerals and how each reads in C, and explains the syntax for writing a custom progression. ' +
        'Call it to find the exact exercise name for generate_exercise_sheet, or before writing a custom progression.',
      outputSchema: listExercisesOutput,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async () => listExercises(),
  );

  server.registerTool(
    'generate_exercise_sheet',
    {
      title: 'Generate a practice sheet',
      description:
        'Generates a practice sheet for jazz chords: rows of keys where each cell shows the exercise spelled out in that key, ' +
        'for example "Dm7 – G7 | Cmaj7" for a two-bar ii–V–I in C (" – " separates chords, " | " bars). ' +
        'Choose a predefined "exercise" by name (see list_exercises) or write a custom "progression" (check it with check_progression). ' +
        `By default every row lists all 12 keys once in random order and a row never starts with the key the previous row ended on; ` +
        `the app's key orders (random, weighted-cycle with key ratings, fourths up or down) are available too, cut into rows of ${KEYS_PER_ROW}. ` +
        'Set "instrument" to Bb, Eb or F for a transposing instrument. The result reports the seed; pass it again to reproduce the sheet.',
      inputSchema: generateInput,
      outputSchema: generateOutput,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => generateExerciseSheet(args),
  );

  server.registerTool(
    'check_progression',
    {
      title: 'Check a custom progression',
      description:
        'Shows how the Practice Jazz Chords app reads a custom progression in a given key: the bars, the chords and which part is ' +
        'shown in superscript. Warns about common mistakes: a chord type outside the asterisks (iim7 instead of iim*7*), a flat ' +
        'before the numeral (bVII instead of VIIb), a lower-case numeral meant as minor (ii*7* is D7, not Dm7), note names instead ' +
        'of numerals, unpaired asterisks, empty bars or chords, and more than four chords in a bar. Use it before passing a custom ' +
        'progression to generate_exercise_sheet.',
      inputSchema: checkInput,
      outputSchema: checkOutput,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ progression, key }) => {
      const check = checkProgression(progression, key);
      return { content: [{ type: 'text', text: formatCheck(check) }], structuredContent: { ...check } };
    },
  );
}
