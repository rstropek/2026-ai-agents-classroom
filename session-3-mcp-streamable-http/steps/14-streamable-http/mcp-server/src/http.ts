import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { localhostHostValidation, localhostOriginValidation, toNodeHandler } from '@modelcontextprotocol/node';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { createMcpServer } from './server.ts';

export const MCP_PATH = '/mcp';

export interface RunningServer {
  /** The MCP endpoint, for example http://127.0.0.1:3000/mcp */
  url: URL;
  close(): Promise<void>;
}

/**
 * Serves MCP over Streamable HTTP on 127.0.0.1. Protocol 2026-07-28 is stateless: there are no
 * sessions, and createMcpHandler builds a fresh server from the factory for each request.
 * legacy: 'reject' answers 2025-era requests with an unsupported-protocol-version error.
 * Pass port 0 to get a free port.
 */
export async function startHttpServer(port: number, host = '127.0.0.1'): Promise<RunningServer> {
  const mcpHandler = createMcpHandler(createMcpServer, { legacy: 'reject' });
  const nodeHandler = toNodeHandler(mcpHandler);
  // Only accept requests addressed to localhost and coming from localhost pages (DNS rebinding protection).
  const validateHost = localhostHostValidation();
  const validateOrigin = localhostOriginValidation();

  const httpServer: Server = createServer((req, res) => {
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
