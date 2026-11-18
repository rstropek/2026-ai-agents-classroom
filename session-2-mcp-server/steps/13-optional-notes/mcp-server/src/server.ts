import { McpServer } from '@modelcontextprotocol/server';
import { registerTools } from './tools.ts';
import { readTrainerHtml, registerTrainer } from './trainer-app.ts';

/**
 * Builds the MCP server with the practice sheet tools and the chord trainer (an MCP App).
 * serveStdio calls it once per connection.
 */
export function createMcpServer(): McpServer {
  const server = new McpServer({ name: 'practice-jazz-chords', version: '0.1.0' });

  registerTools(server);
  registerTrainer(server, readTrainerHtml);
  return server;
}
