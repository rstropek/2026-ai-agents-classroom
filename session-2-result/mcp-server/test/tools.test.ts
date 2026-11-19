// Calls each tool the way a host does: over stdio, through a real server process.
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FLAT_KEYS, type Key, transposeKey } from '../../src/app/chord-engine/index.ts';
import { PROTOCOL_VERSION } from '../src/server.ts';

const serverEntry = fileURLToPath(new URL('../src/main.ts', import.meta.url));

let client: Client;

beforeAll(async () => {
  client = new Client(
    { name: 'test-host', version: '1.0.0' },
    { versionNegotiation: { mode: { pin: PROTOCOL_VERSION } } },
  );
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [serverEntry], stderr: 'pipe' }));
});

afterAll(async () => {
  await client?.close();
});

interface Cell {
  key: Key;
  writtenKey: Key;
  rating: number;
  text: string;
}

async function call(name: string, args: Record<string, unknown>) {
  const result = await client.callTool({ name, arguments: args });
  const text = (result.content as { type: string; text?: string }[]).map((block) => block.text ?? '').join('\n');
  return { ...result, text };
}

describe('tools/list', () => {
  it('offers the three tools, with strict, fully described inputs', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      'check_progression',
      'generate_exercise_sheet',
      'list_exercises',
    ]);
    for (const tool of tools) {
      expect(tool.description, tool.name).toBeTruthy();
      expect(tool.inputSchema.additionalProperties, tool.name).toBe(false);
      expect(tool.outputSchema, tool.name).toBeDefined();
      for (const [name, property] of Object.entries(tool.inputSchema.properties ?? {})) {
        expect((property as { description?: string }).description, `${tool.name}.${name}`).toBeTruthy();
      }
    }
  });
});

describe('list_exercises', () => {
  it('lists the predefined exercises and explains the syntax', async () => {
    const result = await call('list_exercises', {});
    expect(result.isError).toBeFalsy();
    const { exercises, syntax } = result.structuredContent as {
      exercises: { name: string; alternatives: string[]; inC: string[] }[];
      syntax: string;
    };
    expect(exercises).toContainEqual({
      name: 'ii7 - V7 - Imaj7 (two bars)',
      alternatives: ['iim*7* - V*7* | I*maj7*'],
      inC: ['Dm7 – G7 | Cmaj7'],
    });
    expect(exercises.map((e) => e.name)).not.toContain('Custom');
    expect(syntax).toContain('between asterisks');
    expect(result.text).toContain('"Maj 7 / Min 7 / Dom 7": I*maj7* || Im*7* || I*7*');
  });

  it('rejects a parameter it does not know', async () => {
    const result = await call('list_exercises', { filter: 'ii' });
    expect(result.isError).toBe(true);
    expect(result.text).toMatch(/filter/);
  });
});

describe('generate_exercise_sheet', () => {
  it('writes a ii–V–I sheet for a Bb instrument', async () => {
    const result = await call('generate_exercise_sheet', {
      exercise: 'ii7 - V7 - Imaj7 (two bars)',
      rows: 4,
      instrument: 'Bb',
      seed: 2026,
    });
    expect(result.isError).toBeFalsy();
    const sheet = result.structuredContent as {
      exercise: string;
      instrument: string;
      transposition: { halfSteps: number };
      seed: number;
      rows: Cell[][];
    };
    expect(sheet).toMatchObject({ exercise: 'ii7 - V7 - Imaj7 (two bars)', instrument: 'Bb', seed: 2026 });
    expect(sheet.transposition.halfSteps).toBe(2);
    expect(sheet.rows).toHaveLength(4);
    sheet.rows.forEach((row, r) => {
      expect(row.map((cell) => cell.key).sort()).toEqual([...FLAT_KEYS].sort());
      expect(row[0]?.key).not.toBe(sheet.rows[r - 1]?.at(-1)?.key);
      for (const cell of row) {
        expect(cell.writtenKey).toBe(transposeKey(cell.key, 2));
      }
    });
    expect(sheet.rows.flat().find((cell) => cell.key === 'C')?.text).toBe('Em7 – A7 | Dmaj7');
    expect(result.text).toContain('C (written in D): Em7 – A7 | Dmaj7');
    expect(result.text).toContain('seed 2026');
  });

  it('gives the same sheet for the same seed and reports a new seed without one', async () => {
    const args = { exercise: 'Major 7', rows: 2, seed: 99 };
    const first = await call('generate_exercise_sheet', args);
    const second = await call('generate_exercise_sheet', args);
    expect(second.structuredContent).toEqual(first.structuredContent);

    const unseeded = await call('generate_exercise_sheet', { exercise: 'Major 7' });
    expect(unseeded.structuredContent).toMatchObject({ seed: expect.any(Number) });
    expect((unseeded.structuredContent as { rows: unknown[] }).rows).toHaveLength(4);
  });

  it('takes a custom progression, chosen keys, ratings and an app key order', async () => {
    const result = await call('generate_exercise_sheet', {
      progression: 'iim*7(b5)* - V*7* | im*6*',
      keys: ['C', 'F', 'Bb'],
      ratings: { F: 4 },
      keyOrder: 'fourths-up',
      rows: 2,
    });
    expect(result.isError).toBeFalsy();
    const { rows, exercise, warnings } = result.structuredContent as {
      rows: Cell[][];
      exercise: string | null;
      warnings: unknown[];
    };
    expect(exercise).toBeNull();
    expect(warnings).toEqual([]);
    expect(rows.map((row) => row.map((cell) => [cell.key, cell.rating, cell.text]))).toEqual([
      [
        ['C', 1, 'Dm7(b5) – G7 | Cm6'],
        ['F', 4, 'Gm7(b5) – C7 | Fm6'],
        ['Bb', 1, 'Cm7(b5) – F7 | Bbm6'],
      ],
      [
        ['C', 1, 'Dm7(b5) – G7 | Cm6'],
        ['F', 4, 'Gm7(b5) – C7 | Fm6'],
        ['Bb', 1, 'Cm7(b5) – F7 | Bbm6'],
      ],
    ]);
  });

  it('passes on the warnings about a custom progression', async () => {
    const result = await call('generate_exercise_sheet', { progression: 'ii*7* - V7 | I*maj7*', rows: 1 });
    expect(result.isError).toBeFalsy();
    const { warnings } = result.structuredContent as { warnings: { code: string }[] };
    expect(warnings.map((w) => w.code)).toEqual(['lowercase-is-not-minor', 'chord-type-outside-asterisks']);
    expect(result.text).toContain('Warnings about the progression');
  });

  const rejected: [string, Record<string, unknown>, RegExp][] = [
    ['a misspelled parameter', { exercise: 'Major 7', row: 3 }, /row/],
    ['an unknown exercise', { exercise: 'Major 9' }, /exercise/],
    ['both an exercise and a progression', { exercise: 'Major 7', progression: 'I*7*' }, /not both/],
    ['neither an exercise nor a progression', { rows: 2 }, /exercise.*progression/],
    ['a key with a sharp', { exercise: 'Major 7', keys: ['C', 'F#'] }, /keys/],
    ['a key listed twice', { exercise: 'Major 7', keys: ['C', 'C'] }, /only once/],
    ['a single key', { exercise: 'Major 7', keys: ['C'] }, /keys/],
    ['a rating out of range', { exercise: 'Major 7', ratings: { C: 6 } }, /ratings/],
    ['a rating for an unknown key', { exercise: 'Major 7', ratings: { 'C#': 2 } }, /C#/],
    ['an unknown instrument', { exercise: 'Major 7', instrument: 'A' }, /instrument/],
    ['too many rows', { exercise: 'Major 7', rows: 25 }, /rows/],
    ['a negative seed', { exercise: 'Major 7', seed: -1 }, /seed/],
    ['a progression without chords', { progression: ' | ' }, /no chords/],
  ];

  for (const [what, args, message] of rejected) {
    it(`rejects ${what}`, async () => {
      const result = await call('generate_exercise_sheet', args);
      expect(result.isError).toBe(true);
      expect(result.text).toMatch(message);
    });
  }
});

describe('check_progression', () => {
  it('shows how the app reads a progression in a key', async () => {
    const result = await call('check_progression', { progression: 'iim*7* - V*7* | I*maj7*', key: 'Eb' });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({
      key: 'Eb',
      usable: true,
      warnings: [],
      alternatives: [{ text: 'Fm7 – Bb7 | Ebmaj7' }],
    });
    expect(result.text).toContain('Bar 1: Fm7 – Bb7   (shown as Fm<sup>7</sup> – Bb<sup>7</sup>)');
    expect(result.text).toContain('No warnings');
  });

  it('warns about a chord type outside the asterisks, in C by default', async () => {
    const result = await call('check_progression', { progression: 'iim7 - V*7*' });
    expect(result.structuredContent).toMatchObject({
      key: 'C',
      warnings: [{ code: 'chord-type-outside-asterisks', bar: 1, chord: 1 }],
    });
    expect(result.text).toContain('Write iim*7*');
  });

  it('rejects a parameter it does not know', async () => {
    const result = await call('check_progression', { progression: 'I*maj7*', instrument: 'Bb' });
    expect(result.isError).toBe(true);
    expect(result.text).toMatch(/instrument/);
  });
});
