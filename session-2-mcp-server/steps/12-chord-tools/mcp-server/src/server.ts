import { McpServer } from '@modelcontextprotocol/server';
import { registerTools } from './tools.ts';

/** Builds the MCP server with the practice sheet tools. serveStdio calls it once per connection. */
export function createMcpServer(): McpServer {
  const server = new McpServer({ name: 'practice-jazz-chords', version: '0.1.0' });

  registerTools(server);
  return server;
}
