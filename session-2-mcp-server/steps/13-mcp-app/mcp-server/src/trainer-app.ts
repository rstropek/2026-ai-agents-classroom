// The open_trainer tool and the trainer's UI resource (MCP Apps extension, io.modelcontextprotocol/ui).
import { readFile } from 'node:fs/promises';
import { RESOURCE_MIME_TYPE, registerAppResource, registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import type { CallToolResult, McpServer, ReadResourceResult } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import type { Key, Rating } from './chord-engine.ts';
import { findMistakes } from './progression-check.ts';
import { KEY_ORDER_OPTIONS, progressionText, TRANSPOSITION_DESCRIPTIONS, TRANSPOSITIONS } from './sheet.ts';
import {
  chosenProgression,
  exerciseChoiceError,
  exerciseSchema,
  keyRatingsError,
  keyRatingsSchema,
  progressionSchema,
  toolError,
  warningSchema,
} from './tools.ts';
import { DEFAULT_TEMPO, MAX_TEMPO, MIN_TEMPO, type TrainerOptions } from './trainer.ts';

export const TRAINER_URI = 'ui://practice-jazz-chords/trainer.html';

/** The bundle that `npm run build` writes (vite + vite-plugin-singlefile, see ui/vite.config.ts). */
export const TRAINER_HTML_PATH = new URL('../dist/trainer.html', import.meta.url);

/** Reads the trainer's HTML; the tests pass their own. */
export type HtmlLoader = () => Promise<string>;

export const readTrainerHtml: HtmlLoader = async () => {
  try {
    return await readFile(TRAINER_HTML_PATH, 'utf8');
  } catch (error) {
    throw new Error(`The chord trainer is not built yet (${TRAINER_HTML_PATH.pathname}). Run "npm run build".`, {
      cause: error,
    });
  }
};

const KEY_ORDER_TRAINER_DESCRIPTIONS: Record<(typeof KEY_ORDER_OPTIONS)[number], string> = {
  balanced: 'each round plays all 12 keys once in random order, never the same key twice in a row',
  random: 'keys at random (never twice in a row); keys with a low rating come up more often',
  'weighted-cycle': 'cycle n contains every key whose rating divides n, so a key rated 1 comes up in every cycle',
  'fourths-up': 'up a perfect fourth each time, starting on concert C (C F Bb Eb …)',
  'fourths-down': 'down a perfect fourth each time, starting on concert C (C G D A …)',
};

const openTrainerInput = z.object({
  exercise: exerciseSchema,
  progression: progressionSchema,
  keyOrder: z
    .enum(KEY_ORDER_OPTIONS)
    .default('balanced')
    .describe(
      `How the keys follow each other (default "balanced"). ${KEY_ORDER_OPTIONS.map((o) => `"${o}": ${KEY_ORDER_TRAINER_DESCRIPTIONS[o]}`).join('; ')}.`,
    ),
  keyRatings: keyRatingsSchema.optional(),
  transposition: z
    .enum(TRANSPOSITIONS)
    .default('C')
    .describe(
      `The instrument the trainer shows the chords for (default "C"). ${TRANSPOSITIONS.map((t) => `"${t}": ${TRANSPOSITION_DESCRIPTIONS[t]}`).join('; ')}. ` +
        'With Bb, Eb or F the trainer shows the written key and chords; "keyRatings" are always concert keys.',
    ),
  tempo: z
    .number()
    .int()
    .min(MIN_TEMPO)
    .max(MAX_TEMPO)
    .default(DEFAULT_TEMPO)
    .describe(
      `Tempo in beats per minute (${MIN_TEMPO}–${MAX_TEMPO}, default ${DEFAULT_TEMPO}); the bar changes every four beats. The user can change it in the trainer.`,
    ),
});

const openTrainerOutput = z.object({
  exercise: z.string().nullable().describe('Name of the predefined exercise; null for a custom progression'),
  progression: z.string().describe('The progression in the app syntax'),
  keyOrder: z.enum(KEY_ORDER_OPTIONS),
  keyRatings: keyRatingsSchema.describe('The key ratings the trainer uses; keys left out count as 1'),
  transposition: z.enum(TRANSPOSITIONS),
  tempo: z.number().int().min(MIN_TEMPO).max(MAX_TEMPO),
  warnings: z
    .array(warningSchema)
    .describe('Possible mistakes in a custom progression; empty for predefined exercises'),
});

function openTrainer(args: z.infer<typeof openTrainerInput>): CallToolResult {
  const error = exerciseChoiceError(args) ?? keyRatingsError(args);
  if (error) {
    return toolError(error);
  }
  const options: TrainerOptions = {
    exercise: args.exercise ?? null,
    progression: progressionText(chosenProgression(args)),
    keyOrder: args.keyOrder,
    keyRatings: (args.keyRatings ?? {}) as Partial<Record<Key, Rating>>,
    transposition: args.transposition,
    tempo: args.tempo,
  };
  const warnings = args.progression ? findMistakes(args.progression) : [];

  const what = options.exercise
    ? `"${options.exercise}" (${options.progression})`
    : `the custom progression ${options.progression}`;
  const lines = [
    `Opened the chord trainer for ${what}: key order ${options.keyOrder}, ${options.tempo} BPM` +
      (options.transposition === 'C' ? ', concert pitch.' : `, written for ${options.transposition} instruments.`),
    'The user starts and stops it in the trainer and can change the tempo there. It shows the current bar large and the ' +
      'next bar small and moves on every four beats. When the user stops, the trainer reports the keys they practiced.',
  ];
  if (warnings.length > 0) {
    lines.push('', 'Possible mistakes in the progression:', ...warnings.map((w) => `  - ${w.message}`));
  }
  return {
    content: [{ type: 'text', text: lines.join('\n') }],
    structuredContent: { ...options, warnings },
  };
}

/** Registers open_trainer and the trainer's ui:// resource. */
export function registerTrainer(server: McpServer, loadHtml: HtmlLoader = readTrainerHtml): void {
  registerAppTool(
    server,
    'open_trainer',
    {
      title: 'Open the chord trainer',
      description:
        'Opens an interactive chord trainer in the chat, like the practice page of the Practice Jazz Chords app: it shows ' +
        'the current bar large and the next bar small and moves on to the next bar every four beats at the tempo, one key ' +
        'after the other. The user starts and stops it and sets the tempo there. Choose a predefined "exercise" by name ' +
        '(see list_exercises) or write a custom "progression" (check it with check_progression), and optionally the key ' +
        'order, key ratings, transposition and tempo. When the user stops, the trainer adds the keys they practiced to the ' +
        'conversation. In hosts without MCP Apps, use generate_exercise_sheet instead.',
      inputSchema: openTrainerInput,
      outputSchema: openTrainerOutput,
      annotations: { readOnlyHint: true, openWorldHint: false },
      _meta: { ui: { resourceUri: TRAINER_URI } },
    },
    async (args) => openTrainer(args),
  );

  registerAppResource(
    server,
    'Chord trainer',
    TRAINER_URI,
    {
      description: 'Interactive chord trainer: current and next bar, beat counter, start, stop and tempo.',
      mimeType: RESOURCE_MIME_TYPE,
      // Everything is bundled into the HTML: no external origins, so the host's default CSP applies
      _meta: { ui: { prefersBorder: true } },
    },
    async (): Promise<ReadResourceResult> => ({
      contents: [
        {
          uri: TRAINER_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: await loadHtml(),
          _meta: { ui: { prefersBorder: true } },
        },
      ],
    }),
  );
}
