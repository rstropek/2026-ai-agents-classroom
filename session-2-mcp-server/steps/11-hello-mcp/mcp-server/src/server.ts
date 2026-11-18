import { createServer as createHttpServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { localhostHostValidation, localhostOriginValidation, toNodeHandler } from '@modelcontextprotocol/node';
import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';

export const MCP_PATH = '/mcp';

/** Builds a fresh MCP server with all tools. Called once per HTTP request (the protocol is stateless). */
export function createMcpServer(): McpServer {
  const server = new McpServer({ name: 'practice-jazz-chords', version: '0.1.0' });

  server.registerTool(
    'hello',
    {
      title: 'Hello',
      description: 'Greets a person by name.',
      inputSchema: z.object({
        name: z.string().min(1).describe('The name of the person to greet'),
      }),
    },
    async ({ name }) => ({
      content: [{ type: 'text', text: `Hello, ${name}!` }],
    }),
  );

  return server;
}

export interface RunningServer {
  /** The MCP endpoint, for example http://127.0.0.1:3000/mcp */
  url: URL;
  close(): Promise<void>;
}

/**
 * Serves the MCP endpoint over Streamable HTTP on 127.0.0.1. Speaks protocol 2026-07-28 and,
 * statelessly, the 2025 era with its initialize handshake. Pass port 0 to get a free port.
 */
export async function startServer(port: number, host = '127.0.0.1'): Promise<RunningServer> {
  const mcpHandler = createMcpHandler(createMcpServer);
  const nodeHandler = toNodeHandler(mcpHandler);
  // Only accept requests addressed to localhost and coming from localhost pages (DNS rebinding protection).
  const validateHost = localhostHostValidation();
  const validateOrigin = localhostOriginValidation();

  const httpServer: Server = createHttpServer((req, res) => {
    if (!validateHost(req, res) || !validateOrigin(req, res)) return;
    const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
    if (pathname !== MCP_PATH) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
      return;
    }
    void nodeHandler(req, res);
  });

  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(port, host, () => {
      httpServer.off('error', reject);
      resolve();
    });
  });

  const { port: actualPort } = httpServer.address() as AddressInfo;
  return {
    url: new URL(`http://${host}:${actualPort}${MCP_PATH}`),
    async close() {
      await mcpHandler.close();
      httpServer.closeAllConnections();
      await new Promise<void>((resolve, reject) => httpServer.close((err) => (err ? reject(err) : resolve())));
    },
  };
}
