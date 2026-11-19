import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { FLAT_KEYS, type Key, type KeyRatings } from '../../../src/app/chord-engine/index.ts';
import { checkProgression, type ProgressionWarning } from '../progression-check.ts';
import {
  generateSheet,
  INSTRUMENTS,
  type Instrument,
  SHEET_KEY_ORDERS,
  type SheetKeyOrder,
  type SheetRows,
  TRANSPOSITIONS,
} from '../sheet.ts';
import { PREDEFINED_EXERCISES } from './list-exercises.ts';
import { chordSchema, KEY_LIST, keySchema, progressionSchema, ratingSchema, warningSchema } from './schemas.ts';

const EXERCISE_NAMES = PREDEFINED_EXERCISES.map((exercise) => exercise.name);

const MAX_SEED = 2 ** 32 - 1;

const ratingsSchema = z
  .strictObject(
    Object.fromEntries(FLAT_KEYS.map((key) => [key, ratingSchema.optional()])) as Record<
      Key,
      z.ZodOptional<typeof ratingSchema>
    >,
  )
  .default({})
  .describe(
    'How well the player knows each key, at concert pitch, as in the app\'s "Rate your keys": 1 (unfamiliar) to ' +
      '5 (well known), for example {"Gb": 1, "C": 5}. Keys left out have rating 1. The ratings steer the key ' +
      'orders "random" and "weighted-cycle"; with "balanced" and the fourths orders they are only shown on the sheet.',
  );

const inputSchema = z
  .strictObject({
    exercise: z
      .enum(EXERCISE_NAMES as [string, ...string[]])
      .optional()
      .describe(
        'The name of a predefined exercise, exactly as list_exercises gives it, for example ' +
          '"ii7 - V7 - Imaj7 (two bars)". Give either `exercise` or `progression`, not both.',
      ),
    progression: progressionSchema
      .optional()
      .describe(
        "A custom progression instead of a predefined exercise, in the app's syntax, for example " +
          '"iim*7(b5)* - V*7* | im*6*". list_exercises explains the syntax; check_progression shows how it reads. ' +
          'Give either `exercise` or `progression`, not both.',
      ),
    rows: z
      .int()
      .min(1)
      .max(24)
      .default(4)
      .describe('Number of rows, 1 to 24. Default 4. Each row has one cell per key in `keys`.'),
    keyOrder: z
      .enum(SHEET_KEY_ORDERS)
      .default('balanced')
      .describe(
        'How the keys follow each other. "balanced" (default): each row has every key in `keys` exactly once, in ' +
          "random order, and a row never starts with the key the previous row ended on. The app's key orders run " +
          'on from row to row and never bring the same key twice in a row, but a row may repeat or skip keys: ' +
          '"random" (the app\'s Random: a key with rating r gets 6 - r chances, so unfamiliar keys come up more ' +
          'often), "weighted-cycle" (Weighted Cycle: rounds in random order, a key with rating r is in every r-th ' +
          'round), "fourths-up" (Perfect 4th up from C: C F Bb Eb Ab Db Gb B E A D G) and "fourths-down" (Perfect ' +
          '4th down from C: C G D A E B Gb Db Ab Eb Bb F). The fourths orders skip keys that are not in `keys`.',
      ),
    keys: z
      .array(keySchema)
      .min(2)
      .max(12)
      .refine((keys) => new Set(keys).size === keys.length, 'Each key may be listed only once')
      .default([...FLAT_KEYS])
      .describe(
        `The keys to practice, at concert pitch: at least 2, each at most once, in any order. Named with flats ` +
          `only: ${KEY_LIST} (Db, not C#). Default: all 12.`,
      ),
    ratings: ratingsSchema,
    instrument: z
      .enum(INSTRUMENTS)
      .default('C')
      .describe(
        'Who reads the sheet. "C" (default): concert pitch, for piano, guitar, bass, flute, trombone. "Bb": ' +
          'trumpet, clarinet, soprano and tenor saxophone; chords written a major second above concert pitch. "Eb": ' +
          'alto and baritone saxophone; a major sixth above. "F": French horn; a perfect fifth above. Only the ' +
          'chords are transposed: the keys (the order and the key named in each cell) and the ratings stay at ' +
          'concert pitch, so players of different instruments with the same seed play the same sheet together.',
      ),
    seed: z
      .int()
      .min(0)
      .max(MAX_SEED)
      .optional()
      .describe(
        `A whole number from 0 to ${MAX_SEED}. The same seed with the same other parameters gives the same sheet, ` +
          'for every instrument. Leave it out for a new random sheet; the result reports the seed it used.',
      ),
  })
  .superRefine((input, ctx) => {
    if ((input.exercise === undefined) === (input.progression === undefined)) {
      ctx.addIssue({
        code: 'custom',
        message:
          input.exercise === undefined
            ? 'Give `exercise` (a name from list_exercises) or `progression` (a custom progression)'
            : 'Give either `exercise` or `progression`, not both',
      });
    }
  });

const cellSchema = z.object({
  key: keySchema.describe('The key at concert pitch'),
  writtenKey: keySchema.describe('The key the chords are written in for the instrument'),
  rating: ratingSchema.describe('The rating of `key`'),
  text: z.string().describe('The chords: separated by " – " within a bar, bars by " | "'),
  bars: z.array(z.object({ chords: z.array(chordSchema) })),
});

const outputSchema = z.object({
  exercise: z.string().nullable().describe('The predefined exercise, or null for a custom progression'),
  progression: z.array(z.string()).describe('The progression; with several alternatives, one is picked per cell'),
  keyOrder: z.enum(SHEET_KEY_ORDERS),
  keys: z.array(keySchema).describe('The keys practiced, at concert pitch'),
  instrument: z.enum(INSTRUMENTS),
  transposition: z.object({
    halfSteps: z.int().describe('How many half steps the written chords lie above concert pitch'),
    interval: z.string(),
  }),
  seed: z.int().describe('Pass it again to get the same sheet'),
  rows: z.array(z.array(cellSchema)).describe('The rows, each a list of cells'),
  warnings: z.array(warningSchema).describe('Likely mistakes in a custom progression (see check_progression)'),
});

export function registerGenerateExerciseSheet(server: McpServer): void {
  server.registerTool(
    'generate_exercise_sheet',
    {
      title: 'Generate an exercise sheet',
      description:
        'Generate a practice sheet for a jazz chord exercise: rows of keys, each cell showing the exercise in one ' +
        'key, for example "Dm7 – G7 | Cmaj7" in C for a ii–V–I over two bars. By default each row has all 12 keys ' +
        'once in random order, and a row never starts with the key the previous row ended on. Choose a ' +
        'predefined exercise (list_exercises) or write a custom progression (check it with check_progression ' +
        'first), and optionally the rows, key order, keys, key ratings, a transposing instrument (Bb, Eb, F) and a ' +
        'seed. Returns the sheet as text and as structured content, with the seed that reproduces it.',
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: false },
    },
    async (input) => {
      const exercise = PREDEFINED_EXERCISES.find((e) => e.name === input.exercise);
      const progression = exercise?.progression ?? input.progression ?? '';
      const check = checkProgression(progression, 'C');
      if (!check.usable) {
        return {
          content: [{ type: 'text', text: `No sheet: ${check.warnings.map((w) => w.message).join(' ')}` }],
          isError: true,
        };
      }

      const seed = input.seed ?? Math.floor(Math.random() * (MAX_SEED + 1));
      const ratings: KeyRatings = { keys: FLAT_KEYS.map((key) => ({ key, rating: input.ratings[key] ?? 1 })) };
      const rows = generateSheet({
        progression,
        rows: input.rows,
        keyOrder: input.keyOrder,
        keys: input.keys,
        ratings,
        instrument: input.instrument,
        seed,
      });

      const sheet = {
        exercise: exercise?.name ?? null,
        progression: check.alternatives.map((alternative) => alternative.written),
        keyOrder: input.keyOrder,
        keys: input.keys,
        instrument: input.instrument,
        transposition: TRANSPOSITIONS[input.instrument],
        seed,
        rows,
        warnings: check.warnings,
      };
      return { content: [{ type: 'text', text: describeSheet(sheet) }], structuredContent: sheet };
    },
  );
}

const KEY_ORDER_TEXT: Record<SheetKeyOrder, string> = {
  balanced: 'balanced (every row has each key once)',
  random: 'random, weighted by rating (as in the app)',
  'weighted-cycle': 'weighted cycle (as in the app)',
  'fourths-up': 'up in perfect fourths',
  'fourths-down': 'down in perfect fourths',
};

const INSTRUMENT_TEXT: Record<Instrument, string> = {
  C: 'C instruments (concert pitch)',
  Bb: 'Bb instruments',
  Eb: 'Eb instruments',
  F: 'F instruments',
};

function describeSheet(sheet: {
  exercise: string | null;
  progression: string[];
  keyOrder: SheetKeyOrder;
  keys: readonly Key[];
  instrument: Instrument;
  seed: number;
  rows: SheetRows;
  warnings: ProgressionWarning[];
}): string {
  const transposed = sheet.instrument !== 'C';
  const rated = sheet.rows.some((row) => row.some((cell) => cell.rating !== 1));
  const lines = [
    `Practice sheet: ${sheet.exercise ?? 'custom progression'} (${sheet.progression.join(' || ')})`,
    `For ${INSTRUMENT_TEXT[sheet.instrument]}` +
      (transposed
        ? `: chords written ${TRANSPOSITIONS[sheet.instrument].interval}; keys and ratings at concert pitch.`
        : '.'),
    `${sheet.rows.length} rows × ${sheet.keys.length} keys, key order ${KEY_ORDER_TEXT[sheet.keyOrder]}, ` +
      `seed ${sheet.seed} (pass it again for the same sheet).`,
  ];
  sheet.rows.forEach((row, r) => {
    lines.push('', `Row ${r + 1}`);
    row.forEach((cell, c) => {
      const key = transposed ? `${cell.key} (written in ${cell.writtenKey})` : cell.key;
      const rating = rated ? `, rating ${cell.rating}` : '';
      lines.push(`${c + 1}. ${key}${rating}: ${cell.text}`);
    });
  });
  if (sheet.warnings.length > 0) {
    lines.push('', 'Warnings about the progression:', ...sheet.warnings.map((w) => `- [${w.code}] ${w.message}`));
  }
  return lines.join('\n');
}
