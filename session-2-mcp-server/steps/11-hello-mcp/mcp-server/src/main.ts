import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createMcpServer } from './server.ts';

// The host starts this process and talks MCP over stdin and stdout. stdout belongs to the protocol,
// so anything you want to log goes to stderr (console.error), never console.log.
// legacy: 'reject' serves protocol 2026-07-28 only; clients that open with the 2025 initialize
// handshake get an unsupported-protocol-version error.
serveStdio(createMcpServer, { legacy: 'reject' });
