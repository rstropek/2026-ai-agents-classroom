// The open_trainer tool and the trainer's UI resource (MCP Apps extension, io.modelcontextprotocol/ui).
import { readFile } from 'node:fs/promises';
import { RESOURCE_MIME_TYPE, registerAppResource, registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import type { CallToolResult, McpServer, ReadResourceResult } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import type { Key, Rating } from './chord-engine.ts';
import { chordNotesFor } from './chord-notes.ts';
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

/** Reads the trainer's HTML. */
export type HtmlLoader = () => Promise<string>;

/** Shown instead of the trainer until `npm run build` has written the bundle. */
const NOT_BUILT_HTML = `<!doctype html>
<html lang="en">
  <body style="font-family: sans-serif">
    <p>The chord trainer is not built yet. Run <code>npm run build</code> in mcp-server/ and open it again.</p>
  </body>
</html>
`;

export const readTrainerHtml: HtmlLoader = async () => {
  try {
    return await readFile(TRAINER_HTML_PATH, 'utf8');
  } catch {
    return NOT_BUILT_HTML;
  }
};

const KEY_ORDER_TRAINER_DESCRIPTIONS: Record<(typeof KEY_ORDER_OPTIONS)[number], string> = {
  balanced: 'each round plays all 12 keys once in random order, never the same key twice in a row',
  random: 'keys at random (never twice in a row); keys with a low rating come up more often',
  'weighted-cycle': 'cycle n contains every key whose rating divides n, so a key rated 1 comes up in every cycle',
  'fourths-up': 'up a perfect fourth each time, starting on concert C (C F Bb Eb …)',
  'fourths-down': 'down a perfect fourth each time, starting on concert C (C G D A …)',
};

const openTrainerInput = z.strictObject({
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

// ---------------------------------------------------------------------------------------------
// chord_notes: only the trainer calls it (visibility "app"), the model never sees it

export const CHORD_NOTES_TOOL = 'chord_notes';
/** Enough for every chord of a long custom progression with alternatives in all twelve keys. */
export const MAX_CHORD_SYMBOLS = 2000;

const chordNotesInput = z.strictObject({
  chords: z
    .array(z.string().min(1).max(40))
    .min(1)
    .max(MAX_CHORD_SYMBOLS)
    .describe('Chord symbols as the trainer shows them, for example ["Dm7", "G7", "Cmaj7", "Bm7(b5)"].'),
});

const chordNotesOutput = z.object({
  chords: z.array(
    z.object({
      symbol: z.string(),
      notes: z
        .array(z.string())
        .nullable()
        .describe('Chord tones in root position, lowest first, for example ["D4", "F4", "A4", "C5"]; null if unknown'),
    }),
  ),
});

function chordNotesResult({ chords }: z.infer<typeof chordNotesInput>): CallToolResult {
  const result = chordNotesFor(chords);
  const unknown = result.filter((chord) => chord.notes === null).map((chord) => chord.symbol);
  // The structured content is for the app; the text stays short, it is not meant for a model
  const text =
    `Notes for ${result.length - unknown.length} of ${result.length} chord symbols.` +
    (unknown.length > 0 ? ` No notes for: ${unknown.join(', ')}.` : '');
  return { content: [{ type: 'text', text }], structuredContent: { chords: result } };
}

/** Registers open_trainer, chord_notes and the trainer's ui:// resource. */
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

  registerAppTool(
    server,
    CHORD_NOTES_TOOL,
    {
      title: 'Chord notes for the trainer',
      description:
        'The chord tones of chord symbols in root position, spelled as the symbol implies, for the staff in the chord ' +
        'trainer. Only the trainer calls it. A symbol the converter does not understand gets null.',
      inputSchema: chordNotesInput,
      outputSchema: chordNotesOutput,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
      _meta: { ui: { visibility: ['app'] } },
    },
    async (args) => chordNotesResult(args),
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
