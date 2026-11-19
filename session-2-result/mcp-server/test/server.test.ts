// Talks to the server the way a host does: spawn `node src/main.ts` and speak MCP over its stdin and stdout.
import { fileURLToPath } from 'node:url';
import { Client, ProtocolError } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { afterEach, describe, expect, it } from 'vitest';
import { PROTOCOL_VERSION } from '../src/server.ts';

const serverEntry = fileURLToPath(new URL('../src/main.ts', import.meta.url));

function startServer(): StdioClientTransport {
  // stderr is piped and dropped so the server's log lines stay out of the test output.
  return new StdioClientTransport({ command: process.execPath, args: [serverEntry], stderr: 'pipe' });
}

let client: Client | undefined;

afterEach(async () => {
  await client?.close();
  client = undefined;
});

describe('MCP server over stdio', () => {
  it('negotiates protocol 2026-07-28 with a host that also speaks 2025', async () => {
    // 'auto' is what a host that supports both eras does: probe with server/discover, fall back to initialize.
    // So this only passes if the server really offers 2026-07-28, not because the client allows nothing else.
    client = new Client({ name: 'test-host', version: '1.0.0' }, { versionNegotiation: { mode: 'auto' } });
    await client.connect(startServer());

    expect(client.getProtocolEra()).toBe('modern');
    expect(client.getNegotiatedProtocolVersion()).toBe(PROTOCOL_VERSION);
    expect(client.getServerVersion()).toMatchObject({ name: 'jazz-chord-flashcards' });
  });

  it('turns away a host that only speaks a 2025 protocol version', async () => {
    // Without versionNegotiation the client opens with the 2025 initialize handshake.
    client = new Client({ name: 'old-host', version: '1.0.0' });

    const error = await client.connect(startServer()).then(
      () => undefined,
      (reason: unknown) => reason,
    );
    expect(error).toBeInstanceOf(ProtocolError);
    expect(error).toMatchObject({ code: -32022, data: { supported: [PROTOCOL_VERSION] } });
  });
});
