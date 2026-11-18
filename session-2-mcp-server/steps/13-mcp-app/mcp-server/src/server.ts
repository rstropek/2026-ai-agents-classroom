import { createServer as createHttpServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { localhostHostValidation, localhostOriginValidation, toNodeHandler } from '@modelcontextprotocol/node';
import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import { registerTools } from './tools.ts';
import { type HtmlLoader, readTrainerHtml, registerTrainer } from './trainer-app.ts';

export const MCP_PATH = '/mcp';

/**
 * Builds a fresh MCP server with the practice sheet tools and the chord trainer (an MCP App).
 * Called once per HTTP request (the protocol is stateless).
 */
export function createMcpServer(loadTrainerHtml: HtmlLoader = readTrainerHtml): McpServer {
  const server = new McpServer({ name: 'practice-jazz-chords', version: '0.1.0' });

  registerTools(server);
  registerTrainer(server, loadTrainerHtml);
  return server;
}

export interface RunningServer {
  /** The MCP endpoint, for example http://127.0.0.1:3000/mcp */
  url: URL;
  close(): Promise<void>;
}

/**
 * Serves the MCP endpoint over Streamable HTTP on 127.0.0.1. Speaks protocol 2026-07-28 and,
 * statelessly, the 2025 era with its initialize handshake. Pass port 0 to get a free port, and
 * loadTrainerHtml to serve other HTML than the built trainer (tests).
 */
export async function startServer(
  port: number,
  host = '127.0.0.1',
  loadTrainerHtml: HtmlLoader = readTrainerHtml,
): Promise<RunningServer> {
  const mcpHandler = createMcpHandler(() => createMcpServer(loadTrainerHtml));
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
