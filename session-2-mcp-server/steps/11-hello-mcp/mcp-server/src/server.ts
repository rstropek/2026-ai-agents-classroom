import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';

/** Builds the MCP server with all tools. serveStdio calls it once per connection. */
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
