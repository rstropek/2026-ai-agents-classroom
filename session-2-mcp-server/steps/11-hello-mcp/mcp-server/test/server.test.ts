import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('MCP server over stdio', () => {
  let client: Client;

  beforeAll(async () => {
    // The client picks the 2025 handshake unless told otherwise, so pin it to 2026-07-28.
    client = new Client(
      { name: 'test-client', version: '1.0.0' },
      { versionNegotiation: { mode: { pin: '2026-07-28' } } },
    );
    // Starts the server as a child process, exactly like a host does.
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: ['src/main.ts'],
        cwd: fileURLToPath(new URL('..', import.meta.url)),
      }),
    );
  });

  afterAll(async () => {
    await client.close();
  });

  it('speaks protocol 2026-07-28', () => {
    expect(client.getNegotiatedProtocolVersion()).toBe('2026-07-28');
  });

  it('lists the hello tool and greets a name', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name)).toEqual(['hello']);

    const result = await client.callTool({ name: 'hello', arguments: { name: 'Karin' } });
    expect(result.content).toEqual([{ type: 'text', text: 'Hello, Karin!' }]);
  });
});
