# AGENTS.md

> **Keep this file to one page.** It is not documentation of the code. It holds only what a quick look at the code doesn't tell: how to run and check things, decisions and their reasons, traps, links. When you add something, cut something.

## Layout

- The Angular app (root `package.json`) stays as it is. Its chord logic lives in `src/app/chord-engine/`, plain TypeScript without Angular; read its `README.md` before using it.
- `mcp-server/` is an MCP server over stdio that turns the chord logic into practice sheets for AI assistants (`list_exercises`, `generate_exercise_sheet`, `check_progression`). It is its own npm package with its own `node_modules` and lockfile, not a workspace, so the Angular dependencies stay untouched. Run every command below inside `mcp-server/`.
- The server imports the engine and copies none of it. What it lacked went into the engine, with tests there (`npm run test:engine` and `npm run typecheck:engine` at the repo root): `keys` in `ChordSequenceOptions` and `parseBar` (symbols as written, for the checker). The checker's warnings are server-only.

## Run and check

```bash
npm ci
npm start            # node src/main.ts; waits on stdin for a host
npm test             # Vitest: spawns the real server like a host does
npm run lint         # Biome (npm run format fixes)
npm run typecheck    # tsc, no emit
npm run doctor       # MCPJam CLI; must report "status":"ready" and "protocolVersion":"2026-07-28"
npx mcpjam tools call --transport stdio --command node --args "$PWD/src/main.ts" \
  --tool-name list_exercises --tool-args '{}' --validate-response --expect-success
```

`--validate-response` checks the result envelope only. That `structuredContent` matches `outputSchema` is checked by the SDK itself before the result leaves the server; a mismatch turns into an `isError` result.

A host starts the server with command `node` and args `[<repo>/mcp-server/src/main.ts]`, an **absolute** path: hosts spawn from their own working directory (MCPJam Inspector from its npx cache), so `src/main.ts` makes node exit at once and the host reports "Connection closed during the version negotiation probe". Don't use `npm start` either: npm prints its banner on stdout. Hosts that only speak a 2025 protocol version are refused, by design.

## Decisions

- **Protocol 2026-07-28 only.** `serveStdio(createServer, { legacy: 'reject' })` answers a 2025 `initialize` with `-32022`. `supportedProtocolVersions: [PROTOCOL_VERSION]` on the `McpServer` keeps `server/discover` advertising exactly that revision, also after an SDK upgrade adds newer ones.
- **Tools are written for a model.** Every input object is `z.strictObject`, nested ones too: plain `z.object` silently drops unknown keys, so a misspelled `row` would fall back to the default unnoticed. Closed sets are `z.enum`s, so the schema lists the allowed values; every parameter has `.describe()` (a test checks it). Bad input comes back as an `isError` result whose text names the fix, which the model reads and retries on.
- **Concert pitch is the truth.** Key order, keys and ratings are computed at concert pitch from one seeded random; the instrument only moves the key the chords are written in. So one seed gives every player in a band the same sheet, and an omitted seed is reported back.
- **No build step.** Node.js 24 strips the types. Hence: only erasable syntax (no enums, no parameter properties), `.ts` in relative imports, `import type`. These are the chord engine's rules too, so tools can import `../../src/app/chord-engine/index.ts` directly.
- **Tests go through stdio**, with the SDK `Client` and `StdioClientTransport`, because that is what we ship. The negotiation test uses `versionNegotiation: { mode: 'auto' }` like a host that speaks both eras, so it only passes if the server really offers 2026-07-28. The sheet logic and the checker also have plain unit tests.
- **Tooling:** TypeScript 7 (only for type checking), Vitest 5, Biome 2 formatted like the repo's Prettier settings (2 spaces, single quotes, 120 columns). MCPJam CLI is a dev dependency so `npm run doctor` is reproducible.

## Traps

- stdout is the protocol channel. One `console.log`, also in imported engine code, breaks the stream. Log with `console.error`.
- Most MCP code online, and in model training data, is v1 or 2025-era: `@modelcontextprotocol/sdk`, `server.tool()`, `new StdioServerTransport()` + `server.connect()`. We use SDK v2 (`@modelcontextprotocol/server`, `/client` for tests). A server connected directly to a transport speaks 2025 only; 2026-07-28 on stdio goes through `serveStdio`.
- The SDK `Client` opens with the 2025 `initialize` unless `versionNegotiation` is set. Without it you get our `-32022`.
- With `'auto'` or a pin, `StdioClientTransport` probes `server/discover` on a short-lived sibling process. Every connect starts the server twice, so startup must stay cheap and free of side effects.
- `InMemoryTransport.createLinkedPair()` connects 2025-era instances only; don't use it for tests.
- On 2026 connections there is no `initialize`, so `getClientCapabilities()`/`getClientVersion()` are `undefined`; per-request client info is in `ctx.mcpReq.envelope`. No `ping`, no server→client requests (use `inputRequired` results).
- `serveStdio`'s `onerror` fires for each rejected 2025 request. That is not a crash.
- Import Zod as `zod/v4`. A second copy of Zod causes `TS2589`; `npm ls zod` must show one version.
- The root `.prettierrc` says `maxLineLength`, which Prettier doesn't know, so Prettier formats to 80 columns and flags every engine file. Don't reformat the engine wholesale; keep to 120 columns by hand.
- `npm audit` reports re2js (high) through `@mcpjam/cli`. Dev-only; the production dependencies are clean.
- The doctor prints "listResources() called but server does not advertise resources" on stderr. Harmless.

## Docs that matter

- SDK v2 index: https://ts.sdk.modelcontextprotocol.io/v2/llms.txt (append `.md` to any page URL for markdown). Most useful: `protocol-versions`, `serving/stdio`, `serving/legacy-clients`, `servers/tools`, `testing`, `troubleshooting`.
- Spec index: https://modelcontextprotocol.io/llms.txt. What changed in 2026-07-28: https://modelcontextprotocol.io/specification/2026-07-28/changelog.md; stdio: https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio.md
- MCPJam CLI: `npx mcpjam --help`, `npx mcpjam server doctor --help`
