import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { checkProgression, type ProgressionCheck } from '../progression-check.ts';
import { chordSchema, KEY_LIST, keySchema, progressionSchema, warningSchema } from './schemas.ts';

const outputSchema = z.object({
  progression: z.string(),
  key: keySchema,
  usable: z.boolean().describe('False when the progression has no chords at all, so no sheet can be made from it'),
  alternatives: z.array(
    z.object({
      written: z.string().describe('The alternative as written'),
      text: z.string().describe('The alternative in the key: chords separated by " – ", bars by " | "'),
      bars: z.array(
        z.object({
          chords: z.array(
            chordSchema.extend({
              written: z.string().describe('The chord symbol as written'),
              html: z.string().describe('The chord as the app shows it, with the chord type in <sup>'),
            }),
          ),
        }),
      ),
    }),
  ),
  warnings: z.array(warningSchema).describe('Likely mistakes; empty when the progression reads as intended'),
});

export function registerCheckProgression(server: McpServer): void {
  server.registerTool(
    'check_progression',
    {
      title: 'Check a progression',
      description:
        'Show how the Practice Jazz Chords app reads a custom chord progression in a given key, bar by bar, and ' +
        'warn about typical mistakes: a chord type outside the asterisks (Imaj7 instead of I*maj7*), letters i or v ' +
        'outside the asterisks that are read as numerals (viidim7), lower case taken to mean minor (ii*7* is D7 in ' +
        'C, iim*7* is Dm7), a flat before the numeral (bVII instead of VIIb), sharps, unpaired asterisks, empty bars ' +
        'or alternatives, and more than four chords in a bar. Use it before generate_exercise_sheet with a custom ' +
        'progression, and fix every warning unless the user wants it that way.',
      inputSchema: z.strictObject({
        progression: progressionSchema,
        key: keySchema
          .default('C')
          .describe(`The key to show the progression in, at concert pitch, named with flats: ${KEY_LIST}. Default C.`),
      }),
      outputSchema,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ progression, key }) => {
      const check = checkProgression(progression, key);
      return {
        content: [{ type: 'text', text: describeCheck(progression, key, check) }],
        structuredContent: { progression, key, ...check },
      };
    },
  );
}

function describeCheck(progression: string, key: string, check: ProgressionCheck): string {
  const lines = [`In ${key}, the app reads "${progression}" as:`];
  const several = check.alternatives.length > 1;
  if (several) {
    lines.push(`${check.alternatives.length} alternatives; one of them is picked at random for each key.`);
  }
  check.alternatives.forEach((alternative, a) => {
    const indent = several ? '  ' : '';
    if (several) {
      lines.push(`Alternative ${a + 1}: ${alternative.written}`);
    }
    if (alternative.bars.length === 0) {
      lines.push(`${indent}(no chords)`);
    }
    alternative.bars.forEach((bar, b) => {
      const text = bar.chords.map((chord) => chord.text).join(' – ');
      const html = bar.chords.map((chord) => chord.html).join(' – ');
      lines.push(`${indent}Bar ${b + 1}: ${text}   (shown as ${html})`);
    });
  });
  if (check.warnings.length === 0) {
    lines.push('', 'No warnings: the progression reads as written.');
  } else {
    lines.push('', 'Warnings:', ...check.warnings.map((warning) => `- [${warning.code}] ${warning.message}`));
  }
  return lines.join('\n');
}
