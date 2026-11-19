// Schema pieces the tools share. Every input object is strict: an unknown (say, misspelled) parameter is an error.
import * as z from 'zod/v4';
import { FLAT_KEYS } from '../../../src/app/chord-engine/index.ts';
import { WARNING_CODES } from '../progression-check.ts';

export const KEY_LIST = FLAT_KEYS.join(', ');

export const keySchema = z.enum(FLAT_KEYS);

export const ratingSchema = z.literal([1, 2, 3, 4, 5]);

export const progressionSchema = z
  .string()
  .trim()
  .min(1)
  .max(1000)
  .describe(
    'A chord progression in the app\'s syntax, for example "iim*7* - V*7* | I*maj7*": Roman numerals for the ' +
      'scale degrees, the chord type between asterisks, "-" between chords of a bar, "|" between bars, "||" ' +
      'between alternatives. list_exercises explains the syntax in full.',
  );

export const chordSchema = z.object({
  text: z.string().describe('The chord as plain text, such as "Dm7"'),
  parts: z
    .array(z.object({ text: z.string(), superscript: z.boolean() }))
    .describe('The chord symbol in parts; the chord type is marked superscript, as the app shows it'),
});

export const warningSchema = z.object({
  code: z.enum(WARNING_CODES),
  message: z.string(),
  alternative: z.int().optional().describe('Which alternative, counted from 1; only with several alternatives'),
  bar: z.int().optional().describe('Which bar of the alternative, counted from 1'),
  chord: z.int().optional().describe('Which chord of the bar, counted from 1'),
});
