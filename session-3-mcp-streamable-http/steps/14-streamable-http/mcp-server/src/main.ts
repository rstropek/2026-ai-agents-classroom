import { access } from 'node:fs/promises';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createMcpServer } from './server.ts';
import { TRAINER_HTML_PATH } from './trainer-app.ts';

// The host starts this process and talks MCP over stdin and stdout. stdout belongs to the protocol,
// so anything you want to log goes to stderr (console.error), never console.log.
await access(TRAINER_HTML_PATH).catch(() =>
  console.error('The chord trainer is not built yet: run "npm run build" so that open_trainer can show it.'),
);

// legacy: 'reject' serves protocol 2026-07-28 only; clients that open with the 2025 initialize
// handshake get an unsupported-protocol-version error.
serveStdio(createMcpServer, { legacy: 'reject' });
