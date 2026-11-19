import { fileURLToPath } from 'node:url';
import { Client, StreamableHTTPClientTransport, type Transport } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FLAT_KEYS } from '../src/chord-engine.ts';
import { type RunningServer, startHttpServer } from '../src/http.ts';
import { TRAINER_URI } from '../src/trainer-app.ts';

interface Cell {
  key: string;
  concertKey: string;
  bars: string[][];
  text: string;
}

interface Sheet {
  exercise: string | null;
  progression: string;
  keyOrder: string;
  instrument: string;
  seed: number;
  rows: { cells: Cell[] }[];
  warnings: { code: string; message: string }[];
}

function textOf(result: { content?: unknown }): string {
  const [first] = result.content as { type: string; text: string }[];
  if (first?.type !== 'text') {
    throw new Error(`Expected a text block first, got ${JSON.stringify(result.content)}`);
  }
  return first.text;
}

/** A running server and a transport to reach it; stop() shuts the server down after the client closed. */
interface Connection {
  transport: Transport;
  stop(): Promise<void>;
}

const transports: [string, () => Promise<Connection>][] = [
  [
    'stdio',
    async () => ({
      // Starts the server as a child process, exactly like a host does; closing the client ends it.
      transport: new StdioClientTransport({
        command: process.execPath,
        args: ['src/main.ts'],
        cwd: fileURLToPath(new URL('..', import.meta.url)),
      }),
      stop: async () => {},
    }),
  ],
  [
    'Streamable HTTP',
    async () => {
      const server: RunningServer = await startHttpServer(0); // port 0: the OS picks a free port
      return { transport: new StreamableHTTPClientTransport(server.url), stop: () => server.close() };
    },
  ],
];

describe.each(transports)('MCP server over %s', (_name, connect) => {
  let client: Client;
  let connection: Connection;

  beforeAll(async () => {
    connection = await connect();
    // The client picks the 2025 handshake unless told otherwise, so pin it to 2026-07-28.
    client = new Client(
      { name: 'test-client', version: '1.0.0' },
      { versionNegotiation: { mode: { pin: '2026-07-28' } } },
    );
    await client.connect(connection.transport);
  });

  afterAll(async () => {
    await client.close();
    await connection.stop();
  });

  it('lists the four tools, each with an output schema', async () => {
    expect(client.getNegotiatedProtocolVersion()).toBe('2026-07-28');
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      'check_progression',
      'generate_exercise_sheet',
      'list_exercises',
      'open_trainer',
    ]);
    for (const tool of tools) {
      expect(tool.description).toBeTruthy();
      expect(tool.outputSchema?.type).toBe('object');
    }
  });

  it('rejects a parameter that a tool does not know instead of ignoring it', async () => {
    const calls = [
      { name: 'generate_exercise_sheet', arguments: { exercise: 'Major 7', transposition: 'Bb' } },
      { name: 'check_progression', arguments: { progression: 'I*maj7*', transposition: 'Bb' } },
      { name: 'open_trainer', arguments: { exercise: 'Major 7', transposition: 'Bb' } },
    ];
    for (const call of calls) {
      const result = await client.callTool(call);
      expect(result.isError, call.name).toBe(true);
      expect(textOf(result)).toContain('transposition');
    }
  });

  describe('list_exercises', () => {
    it('lists the predefined exercises and the progression syntax', async () => {
      const result = await client.callTool({ name: 'list_exercises', arguments: {} });
      expect(result.isError).toBeFalsy();
      const { exercises, syntax } = result.structuredContent as {
        exercises: { name: string; progression: string; inC: string }[];
        syntax: string;
      };
      expect(exercises).toContainEqual({
        name: 'ii7 - V7 - Imaj7 (two bars)',
        progression: 'iim*7* - V*7* | I*maj7*',
        inC: 'Dm7 – G7 | Cmaj7',
      });
      expect(exercises.map((exercise) => exercise.name)).not.toContain('Custom');
      expect(syntax).toContain('*7*');
      expect(textOf(result)).toContain('ii7 - V7 - Imaj7 (two bars): iim*7* - V*7* | I*maj7* → Dm7 – G7 | Cmaj7');
    });
  });

  describe('generate_exercise_sheet', () => {
    it('generates balanced rows for a Bb instrument', async () => {
      const result = await client.callTool({
        name: 'generate_exercise_sheet',
        arguments: { exercise: 'ii7 - V7 - Imaj7 (two bars)', rows: 4, instrument: 'Bb', seed: 5 },
      });
      expect(result.isError).toBeFalsy();
      const sheet = result.structuredContent as unknown as Sheet;
      expect(sheet.seed).toBe(5);
      expect(sheet.keyOrder).toBe('balanced');
      expect(sheet.rows).toHaveLength(4);
      for (const row of sheet.rows) {
        expect(row.cells.map((cell) => cell.concertKey).sort()).toEqual([...FLAT_KEYS].sort());
      }
      const cWritten = sheet.rows[0]?.cells.find((cell) => cell.concertKey === 'C');
      expect(cWritten).toMatchObject({ key: 'D', text: 'Em7 – A7 | Dmaj7', bars: [['Em7', 'A7'], ['Dmaj7']] });
      expect(textOf(result)).toContain('D [C]:');
      expect(textOf(result)).toContain('Em7 – A7 | Dmaj7');
    });

    it('gives the same sheet for the same seed', async () => {
      const args = { exercise: 'Maj 7 / Min 7 / Dom 7', keyOrder: 'random', seed: 99 };
      const a = await client.callTool({ name: 'generate_exercise_sheet', arguments: args });
      const b = await client.callTool({ name: 'generate_exercise_sheet', arguments: args });
      expect(b.structuredContent).toEqual(a.structuredContent);
      const withoutSeed = await client.callTool({
        name: 'generate_exercise_sheet',
        arguments: { exercise: 'Major 7' },
      });
      expect(typeof (withoutSeed.structuredContent as unknown as Sheet).seed).toBe('number');
    });

    it('takes a custom progression, chosen keys and ratings', async () => {
      const custom = await client.callTool({
        name: 'generate_exercise_sheet',
        arguments: { progression: 'iim7 - V*7*', keys: ['C', 'F'], rows: 3, seed: 1 },
      });
      const sheet = custom.structuredContent as unknown as Sheet;
      expect(sheet.exercise).toBeNull();
      expect(sheet.rows.map((row) => row.cells.length)).toEqual([2, 2, 2]);
      expect(sheet.warnings.map((w) => w.code)).toEqual(['type-outside-asterisks']);
      expect(textOf(custom)).toContain('Write iim*7*');

      const rated = await client.callTool({
        name: 'generate_exercise_sheet',
        arguments: { exercise: 'Dominant 7', keyOrder: 'weighted-cycle', keyRatings: { C: 5, Gb: 1 }, rows: 2 },
      });
      expect(rated.isError).toBeFalsy();
      expect((rated.structuredContent as unknown as Sheet).rows[0]?.cells).toHaveLength(12);
    });

    it('explains wrong combinations of options', async () => {
      const call = (args: Record<string, unknown>) =>
        client.callTool({ name: 'generate_exercise_sheet', arguments: args });

      const neither = await call({ rows: 2 });
      expect(neither.isError).toBe(true);
      expect(textOf(neither)).toContain('exactly one of "exercise"');

      const both = await call({ exercise: 'Major 7', progression: 'I*7*' });
      expect(both.isError).toBe(true);

      const keysWithCycle = await call({ exercise: 'Major 7', keyOrder: 'fourths-up', keys: ['C', 'F'] });
      expect(textOf(keysWithCycle)).toContain('"keys" only works with keyOrder "balanced"');

      const ratingsWithBalanced = await call({ exercise: 'Major 7', keyRatings: { C: 3 } });
      expect(textOf(ratingsWithBalanced)).toContain(
        '"keyRatings" only work with keyOrder "random" or "weighted-cycle"',
      );

      const unknownExercise = await call({ exercise: 'Blues' });
      expect(unknownExercise.isError).toBe(true);
      expect(textOf(unknownExercise)).toContain('ii7 - V7 - Imaj7 (two bars)');
    });
  });

  describe('check_progression', () => {
    it('shows the chords in the key and warns about mistakes', async () => {
      const result = await client.callTool({
        name: 'check_progression',
        arguments: { progression: 'iim7 - V*7* | I*maj7*', key: 'F' },
      });
      expect(result.isError).toBeFalsy();
      const check = result.structuredContent as {
        key: string;
        alternatives: { bars: { text: string }[] }[];
        warnings: { code: string }[];
      };
      expect(check.key).toBe('F');
      expect(check.alternatives[0]?.bars.map((bar) => bar.text)).toEqual(['Gm7 – C7', 'Fmaj7']);
      expect(check.warnings.map((w) => w.code)).toEqual(['type-outside-asterisks']);
      expect(textOf(result)).toContain('Bar 1: Gm7 – C7');
      expect(textOf(result)).toContain('Write iim*7*');
    });

    it('defaults to C and reports no problems for a correct progression', async () => {
      const result = await client.callTool({ name: 'check_progression', arguments: { progression: 'I*maj7*' } });
      expect((result.structuredContent as { key: string }).key).toBe('C');
      expect(textOf(result)).toContain('No problems found.');
    });
  });

  describe('open_trainer (MCP App)', () => {
    it('links the tool to the ui:// resource', async () => {
      const { tools } = await client.listTools();
      const tool = tools.find((t) => t.name === 'open_trainer');
      expect(tool?._meta?.ui).toEqual({ resourceUri: TRAINER_URI });
      // registerAppTool also sets the older flat key for older hosts
      expect(tool?._meta?.['ui/resourceUri']).toBe(TRAINER_URI);
    });

    it('serves the trainer as text/html;profile=mcp-app', async () => {
      const { resources } = await client.listResources();
      const listed = resources.find((r) => r.uri === TRAINER_URI);
      expect(listed?.mimeType).toBe('text/html;profile=mcp-app');

      const { contents } = await client.readResource({ uri: TRAINER_URI });
      expect(contents).toHaveLength(1);
      expect(contents[0]).toMatchObject({
        uri: TRAINER_URI,
        mimeType: 'text/html;profile=mcp-app',
        text: expect.stringContaining('<html'),
      });
    });

    it('returns the completed options for the app and a summary for the model', async () => {
      const result = await client.callTool({
        name: 'open_trainer',
        arguments: { exercise: 'ii7 - V7 - Imaj7 (two bars)', instrument: 'Bb', tempo: 90 },
      });
      expect(result.isError).toBeFalsy();
      expect(result.structuredContent).toEqual({
        exercise: 'ii7 - V7 - Imaj7 (two bars)',
        progression: expect.any(String),
        keyOrder: 'balanced',
        keyRatings: {},
        instrument: 'Bb',
        tempo: 90,
        warnings: [],
      });
      expect(textOf(result)).toContain('90 BPM');
    });

    it('takes a custom progression with key ratings and warns about mistakes', async () => {
      const result = await client.callTool({
        name: 'open_trainer',
        arguments: { progression: 'iim7 - V*7* | I*maj7*', keyOrder: 'random', keyRatings: { C: 5, Gb: 1 } },
      });
      const options = result.structuredContent as {
        exercise: null;
        tempo: number;
        keyRatings: object;
        warnings: unknown[];
      };
      expect(options.exercise).toBeNull();
      expect(options.tempo).toBe(60);
      expect(options.keyRatings).toEqual({ C: 5, Gb: 1 });
      expect(options.warnings.length).toBeGreaterThan(0);
      expect(textOf(result)).toContain('Possible mistakes');
    });

    it('explains wrong combinations of options', async () => {
      const neither = await client.callTool({ name: 'open_trainer', arguments: {} });
      expect(neither.isError).toBe(true);
      expect(textOf(neither)).toContain('exactly one of');

      const ratings = await client.callTool({
        name: 'open_trainer',
        arguments: { exercise: 'Major 7', keyOrder: 'fourths-up', keyRatings: { C: 3 } },
      });
      expect(ratings.isError).toBe(true);
      expect(textOf(ratings)).toContain('"keyRatings" only work');
    });

    it('rejects a tempo out of range', async () => {
      const result = await client.callTool({ name: 'open_trainer', arguments: { exercise: 'Major 7', tempo: 500 } });
      expect(result.isError).toBe(true);
    });
  });
});

describe('Streamable HTTP endpoint', () => {
  let server: RunningServer;

  beforeAll(async () => {
    server = await startHttpServer(0);
  });

  afterAll(async () => {
    await server.close();
  });

  it('rejects requests from non-localhost origins', async () => {
    const response = await fetch(server.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example.com' },
      body: '{}',
    });
    expect(response.status).toBe(403);
  });

  it('answers 404 outside /mcp', async () => {
    const response = await fetch(new URL('/other', server.url));
    expect(response.status).toBe(404);
  });
});
