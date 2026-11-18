# AGENTS.md

This file holds what the code doesn't tell: how to run and check the server, decisions and their reasons, traps, and links to the docs. Keep it to one page, and describe nothing that a quick look at the code shows.

Practice Jazz Chords is an Angular app. `mcp-server/` adds an MCP server that makes the app's chord engine (`src/app/chord-engine`) available to AI assistants. This file is about the MCP server; leave the Angular app as it is.

## Commands

Run them in `mcp-server/`:

- `npm test`, `npm run lint` (`npm run format` fixes what it can), `npm run typecheck`
- `npx -y @mcpjam/cli@latest server doctor --command node --args src/main.ts` must report `ready`
- `npx -y @mcpjam/cli@latest tools call --command node --args src/main.ts --tool-name <tool> --tool-args '<json>'`

## Decisions

- Node.js 24 runs the `.ts` files directly, so the server has no build step. Only erasable TypeScript syntax works (no enums, no parameter properties), and imports keep their `.ts` extension.
- MCP TypeScript SDK v2 (`@modelcontextprotocol/server`, `@modelcontextprotocol/client` for the tests), not v1 (`@modelcontextprotocol/sdk`). Most examples on the web are still v1.
- Protocol 2026-07-28 only. The server turns away clients that open with the 2025 `initialize` handshake.
- Transport stdio: a host starts `node src/main.ts` as a child process. There is no `npm start`, because npm prints a banner to stdout.

## Traps

- stdout belongs to the protocol. A single `console.log` breaks the connection, so log with `console.error`.
- The SDK client negotiates a 2025 version unless you pin 2026-07-28 (`versionNegotiation: { mode: { pin: '2026-07-28' } }`). The tests pin it and check the negotiated version.
- The SDK's in-memory transport speaks 2025 only, so the tests start the server over stdio.

## Docs

- MCP specification 2026-07-28: <https://modelcontextprotocol.io/llms.txt>
- SDK v2: <https://ts.sdk.modelcontextprotocol.io/v2/llms.txt> (the site's root still documents v1)
