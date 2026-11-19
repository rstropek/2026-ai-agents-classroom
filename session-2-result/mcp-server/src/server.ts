import { McpServer } from '@modelcontextprotocol/server';
import { registerCheckProgression } from './tools/check-progression.ts';
import { registerGenerateExerciseSheet } from './tools/generate-exercise-sheet.ts';
import { registerListExercises } from './tools/list-exercises.ts';

export const PROTOCOL_VERSION = '2026-07-28';

/** Builds the server instance that serves one connection. */
export function createServer(): McpServer {
  const server = new McpServer(
    { name: 'jazz-chord-flashcards', version: '0.1.0' },
    {
      supportedProtocolVersions: [PROTOCOL_VERSION],
      instructions:
        'Generates practice sheets for jazz chords, using the chord logic of the Practice Jazz Chords app. ' +
        'list_exercises gives the predefined exercises and the syntax for custom progressions; check_progression ' +
        'shows how a custom progression reads; generate_exercise_sheet makes the sheet.',
    },
  );

  registerListExercises(server);
  registerGenerateExerciseSheet(server);
  registerCheckProgression(server);

  return server;
}
