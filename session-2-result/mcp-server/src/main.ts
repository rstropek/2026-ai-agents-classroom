// Entry point a host starts as a child process. stdout carries the protocol: log to stderr only.
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createServer } from './server.ts';

const handle = serveStdio(createServer, {
  legacy: 'reject',
  // Also called for every 2025-era request it turns away; the message is enough there.
  onerror: (error) => console.error(`jazz-chord-flashcards MCP server: ${error.message}`),
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => void handle.close());
}

console.error('jazz-chord-flashcards MCP server running on stdio');
