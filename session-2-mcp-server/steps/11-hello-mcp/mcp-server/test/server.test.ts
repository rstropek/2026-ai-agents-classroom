import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type RunningServer, startServer } from '../src/server.ts';

describe('MCP server over HTTP', () => {
  let server: RunningServer;

  beforeAll(async () => {
    server = await startServer(0); // port 0: the OS picks a free port
  });

  afterAll(async () => {
    await server.close();
  });

  async function connect(mode: 'auto' | 'legacy'): Promise<Client> {
    const client = new Client({ name: 'test-client', version: '1.0.0' }, { versionNegotiation: { mode } });
    await client.connect(new StreamableHTTPClientTransport(server.url));
    return client;
  }

  it('greets a name with protocol 2026-07-28', async () => {
    const client = await connect('auto');
    try {
      expect(client.getProtocolEra()).toBe('modern');
      const { tools } = await client.listTools();
      expect(tools.map((tool) => tool.name)).toEqual(['hello']);

      const result = await client.callTool({ name: 'hello', arguments: { name: 'Karin' } });
      expect(result.content).toEqual([{ type: 'text', text: 'Hello, Karin!' }]);
    } finally {
      await client.close();
    }
  });

  it('greets a name for clients using the 2025 initialize handshake', async () => {
    const client = await connect('legacy');
    try {
      expect(client.getProtocolEra()).toBe('legacy');
      const result = await client.callTool({ name: 'hello', arguments: { name: 'Miles' } });
      expect(result.content).toEqual([{ type: 'text', text: 'Hello, Miles!' }]);
    } finally {
      await client.close();
    }
  });

  it('rejects requests from non-localhost origins', async () => {
    const response = await fetch(server.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example.com' },
      body: '{}',
    });
    expect(response.status).toBe(403);
  });
});
