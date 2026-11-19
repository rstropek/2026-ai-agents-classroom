# AGENTS.md

This file holds what the code doesn't tell: how to run and check the server, decisions and their reasons, traps, and links to the docs. Keep it to one page, and describe nothing that a quick look at the code shows.

Practice Jazz Chords is an Angular app. `mcp-server/` adds an MCP server that makes the app's chord engine (`src/app/chord-engine`) available to AI assistants: practice sheets for jazz chords in all keys, and a chord trainer as an MCP App that the host shows in the chat. This file is about the MCP server; leave the Angular app as it is.

## Commands

Run them in `mcp-server/`:

- `npm test`, `npm run lint` (`npm run format` fixes what it can), `npm run typecheck`
- `npm run build` bundles the trainer into `dist/trainer.html`; run it again after every change in `ui/` (`npm run build:watch` does that for you)
- `npx -y @mcpjam/cli@latest server doctor --command node --args src/main.ts` must report `ready`
- `npx -y @mcpjam/cli@latest apps conformance --command node --args src/main.ts` must pass
- `npx -y @mcpjam/cli@latest tools call --command node --args src/main.ts --tool-name <tool> --tool-args '<json>' --expect-success --validate-response`

Changes to the chord engine get a test next to it. Run those tests in the repository root with `npm run test:engine` and `npm run typecheck:engine`.

To see the trainer, start the MCPJam Inspector (`npx -y @mcpjam/inspector@latest`, then <http://127.0.0.1:6274>), add the server as STDIO with the command `node <absolute path>/mcp-server/src/main.ts`, and run `open_trainer` in the Playground.

## Decisions

- Node.js 24 runs the `.ts` files directly, so the server has no build step. Only erasable TypeScript syntax works (no enums, no parameter properties), and imports keep their `.ts` extension. Only the UI is built.
- MCP TypeScript SDK v2 (`@modelcontextprotocol/server`, `@modelcontextprotocol/client` for the tests), not v1 (`@modelcontextprotocol/sdk`). Most examples on the web are still v1.
- Protocol 2026-07-28 only. The server turns away clients that open with the 2025 `initialize` handshake.
- Transport stdio: a host starts `node src/main.ts` as a child process. There is no `npm start`, because npm prints a banner to stdout.
- The server imports the chord engine from the app's source instead of copying it, so the app and the server always read progressions the same way. The trainer runs the same engine in the browser.
- Transposition is the server's own addition: the chords are written for the instrument (Bb, Eb, F), while the keys to practice and the ratings stay at concert pitch, as the app stores them.
- Every tool returns text for the model and structured content that matches its output schema. `--validate-response` checks both.
- Tool input is strict (`z.strictObject`): a tool rejects a parameter it doesn't know. Zod's `z.object` drops unknown parameters silently, so a misspelled name would return a wrong result instead of an error.
- MCP Apps with `@modelcontextprotocol/ext-apps` 2.x, the version for SDK v2. The trainer is React, bundled into one self-contained HTML file.
- Without a bundle the server serves a placeholder page and warns on stderr, so `npm test` and the doctor work without a build.

## Traps

- stdout belongs to the protocol. A single `console.log` breaks the connection, so log with `console.error`.
- The SDK client negotiates a 2025 version unless you pin 2026-07-28 (`versionNegotiation: { mode: { pin: '2026-07-28' } }`). The tests pin it and check the negotiated version.
- The SDK's in-memory transport speaks 2025 only, so the tests start the server over stdio.
- Hosts block external fonts, scripts, and requests inside an app. Everything has to be in the bundle.
- The trainer follows the host's theme, not the operating system's. Its CSS uses `light-dark()`; the Vite config sets a CSS target that keeps it, because older targets turn it into a `prefers-color-scheme` media query.
- The MCPJam Inspector sometimes hands dark style variables to a light preview. Reset the Client Context before you suspect the trainer.

## Docs

- MCP specification 2026-07-28: <https://modelcontextprotocol.io/llms.txt>
- SDK v2: <https://ts.sdk.modelcontextprotocol.io/v2/llms.txt> (the site's root still documents v1)
- MCP Apps: <https://modelcontextprotocol.io/extensions/apps/overview.md>, <https://modelcontextprotocol.io/extensions/apps/build.md> (its code is still SDK v1), and <https://github.com/modelcontextprotocol/ext-apps> for the 2.x API
- Chord engine: `src/app/chord-engine/README.md`
