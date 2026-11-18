# Session 2 storybook: an MCP server for an existing app

**Classroom: Moderne KI-Agents entwickeln, session 2**

In this part you add an MCP server to a real app: [Practice Jazz Chords](https://practice-jazz-chords.com), an Angular app for practicing jazz chords in all keys. You don't type the code yourself. You prompt a coding agent, check what it built, and move on to the next step. Each step has a **Goal**, the **Prompt** to paste into your coding agent, a **Verify** checklist, and a **Catch up** folder with a finished result in case your agent went off track. Step numbers continue from session 1.

## The idea of this part

The app keeps its chord logic in `src/app/chord-engine`, plain TypeScript without Angular. It parses progressions such as `iim*7* - V*7* | I*maj7*`, puts them into keys, and decides which key comes next. The Angular app uses the engine for its practice page, and your MCP server uses the same code for its tools. That is the typical situation in a real project: the business logic exists, and the MCP server is one more way to use it.

The three steps build on each other:

1. Step 11 sets up the project and a hello world server, so that you know the setup works before the real tools come in.
2. Step 12 adds tools that create practice sheets: rows of all twelve keys in random order, with the chords of an exercise in each key.
3. Step 13 adds an MCP App, an interactive chord trainer that the host shows right in the chat.

The MCP specification changed fundamentally with version 2026-07-28: no sessions, no initialize handshake, and a new way to discover servers. Your coding agent's training data most likely predates it. That's why every prompt tells the agent to read the current documentation first, starting at <https://modelcontextprotocol.io/llms.txt>. Keep that line when you write your own prompts.

## Prerequisites

- Node.js 24 or newer
- A coding agent, such as Claude Code, Codex, or GitHub Copilot in agent mode
- A GitHub account

Fork <https://github.com/karin112358/jazz-chord-flashcards> and clone your fork. Your work stays in your fork, so don't open pull requests to the original repository.

You check your server with [MCPJam](https://www.mcpjam.com). The prompts use its command line interface, which needs no installation and no API key:

```bash
npx -y @mcpjam/cli@latest --help
```

For step 13 you also need the MCPJam Inspector, which shows MCP Apps the way a chat host does. It runs on your machine and needs no account for calling tools:

```bash
npx -y @mcpjam/inspector@latest
```

Open it at <http://127.0.0.1:6274>. Opened as `localhost`, it asks for the link it printed at startup instead.

## Step 11: a hello world MCP server

**Goal.** Set up the MCP server project next to the app: TypeScript in strict mode, Biome, Vitest, and the MCP TypeScript SDK v2 serving Streamable HTTP. One `hello` tool proves that the setup works, from the test to a real MCP client.

**Prompt.**

```text
This repository is Practice Jazz Chords, an Angular app for practicing jazz chords in all keys. Its chord logic lives in src/app/chord-engine: plain TypeScript without Angular, described in its README.md.

Add an MCP server in a new folder mcp-server/ with its own package.json. Leave the Angular app as it is.

Setup:
- Node.js 24 runs the TypeScript files directly (type stripping), no build step for the server
- TypeScript in strict mode, type-checked with tsc --noEmit
- Biome with its recommended rules for linting and formatting
- Vitest for tests; Vite comes in later for a UI bundle
- npm scripts: start, dev (restarts on changes), test, lint, typecheck

Server:
- The MCP TypeScript SDK v2 with zod 4: @modelcontextprotocol/server, @modelcontextprotocol/node for the HTTP server, and @modelcontextprotocol/client for the tests. Not the v1 package @modelcontextprotocol/sdk.
- Streamable HTTP on http://127.0.0.1:3000/mcp, accepting requests from localhost only
- MCP protocol 2026-07-28, which is stateless; clients that still use the 2025 handshake should work too
- For now one tool, hello, that greets a name

The MCP specification changed a lot with version 2026-07-28: there are no sessions and no initialize handshake any more. Before you write code, read https://modelcontextprotocol.io/llms.txt and the pages it points to that you need, and the SDK v2 documentation at https://ts.sdk.modelcontextprotocol.io/v2/llms.txt (the site's root still documents v1). Don't rely on what you remember about MCP.

Add a Vitest test that starts the server on a free port and calls the hello tool with the SDK's client over HTTP, once with protocol 2026-07-28 and once with the 2025 handshake. The test must check which protocol the client actually negotiated, because the client does not pick 2026-07-28 on its own.

You're done when npm test, npm run lint and npm run typecheck pass, and npx -y @mcpjam/cli@latest server doctor --url http://127.0.0.1:3000/mcp reports "ready" while npm start runs.
```

**Verify.**

- [ ] `mcp-server/package.json` depends on `@modelcontextprotocol/server`, not on `@modelcontextprotocol/sdk`.
- [ ] `npm test`, `npm run lint`, and `npm run typecheck` pass in `mcp-server/`.
- [ ] With `npm start` running, `server doctor` reports `ready` and protocol version `2026-07-28`.
- [ ] This call greets you:

```bash
npx -y @mcpjam/cli@latest tools call --url http://127.0.0.1:3000/mcp --tool-name hello --tool-args '{"name":"Karin"}'
```

**Catch up.** Copy `steps/11-hello-mcp/mcp-server/` into the root of your fork and run `npm install` in it.

## Step 12: practice sheets as tools

**Goal.** Replace `hello` with tools that build on the chord engine: list the exercises, generate a practice sheet, and check a custom progression. The step is about tool design: options a model can fill in without guessing, readable text for the model, and structured content for programs.

**Prompt.**

```text
Now turn the hello server into a practice sheet generator for jazz chords. Replace the hello tool.

A practice sheet works like this: each row lists the keys to practice, by default all 12, each exactly once in random order. Each cell shows the chosen exercise in that key, for example Dm7 – G7 | Cmaj7 in C for a ii–V–I over two bars. A row never starts with the key the previous row ended on.

Build on src/app/chord-engine. Import it from mcp-server (don't copy it), and only change it if the server really needs something it lacks; then add a test there too.

Tools:
- list_exercises: the predefined exercises with their progressions, and the syntax for custom progressions
- generate_exercise_sheet with these options:
  - a predefined exercise by name, or a custom progression in the app's syntax
  - number of rows
  - key order: balanced rows as described above, or one of the app's key orders (random, weighted cycle, perfect fourths up or down) cut into rows of 12
  - which keys to practice (balanced rows)
  - ratings 1–5 for some or all keys, as in the app (random and weighted cycle); keys without a rating count as 1
  - transposition for Bb, Eb and F instruments, which the app doesn't have: the chords are written for the instrument, while the keys to practice and the ratings stay at concert pitch
  - a seed, so that the same seed gives the same sheet again
- check_progression: shows how the app reads a custom progression in a given key and warns about common mistakes, such as a chord type outside the asterisks

Each tool returns readable text for the model and structured content with an output schema. Describe the tools and their parameters so that a model picks the right options without guessing.

Test the sheet logic with Vitest, and test each tool through the SDK client over HTTP. The SDK v2 documentation is at https://ts.sdk.modelcontextprotocol.io/v2/llms.txt; check there how tools declare output schemas and return structured content.

You're done when npm test, npm run lint and npm run typecheck pass, and with npm start running npx -y @mcpjam/cli@latest server doctor --url http://127.0.0.1:3000/mcp reports "ready" and this call succeeds:
npx -y @mcpjam/cli@latest tools call --url http://127.0.0.1:3000/mcp --tool-name generate_exercise_sheet --tool-args '{"exercise":"ii7 - V7 - Imaj7 (two bars)","rows":4,"transposition":"Bb"}' --expect-success --validate-response
```

**Verify.**

- [ ] `npm test`, `npm run lint`, and `npm run typecheck` pass in `mcp-server/`, and the server imports the chord engine instead of copying it.
- [ ] The `tools call` from the prompt prints four rows. Each row has twelve different keys, and the chords are written for a Bb instrument: the ii–V–I of concert C reads `Em7 – A7 | Dmaj7`.
- [ ] `check_progression` with `viidim7 - V*7*` warns that `dim` stands outside the asterisks.
- [ ] `protocol conformance` passes:

```bash
npx -y @mcpjam/cli@latest protocol conformance --url http://127.0.0.1:3000/mcp
```

**Catch up.** Copy `steps/12-chord-tools/mcp-server/` into the root of your fork, replacing your `mcp-server/`, and run `npm install` in it.

## Step 13: the chord trainer as an MCP App

**Goal.** Give the server a user interface. An MCP App is a small web page that a tool declares and the host renders inside the chat. The trainer shows a bar of chords at a time, like the app's practice page, and tells the model afterwards which keys were practiced.

**Prompt.**

```text
Now add an MCP App: an interactive chord trainer that the host shows inline in the chat. It complements the Angular app and must not replace it.

What the trainer does:
- a tool open_trainer opens it, with the exercise options of generate_exercise_sheet (predefined exercise or custom progression, key order, key ratings, transposition) and a tempo; rows, seed and the choice of keys don't apply, because the trainer runs until the user stops
- like the practice page of the Angular app (src/app/components/player), it shows the current bar large and the next bar small, and moves on every four beats at the tempo; a visual beat counter is enough, no sound
- start, stop and tempo controls
- the bars come from ChordSequence in src/app/chord-engine, running in the browser
- when the user stops, the app tells the model which keys were practiced since the trainer was opened (update the model context)

Technology:
- the MCP Apps extension (io.modelcontextprotocol/ui) with @modelcontextprotocol/ext-apps 2.x, the version for SDK v2
- the UI in mcp-server/ui/ with React and Vite, bundled into one HTML file (vite-plugin-singlefile) that the server serves as a ui:// resource with MIME type text/html;profile=mcp-app
- no external fonts, scripts or requests: the host's content security policy blocks them
- follow the host's light or dark theme, not the operating system's, also in the built bundle
- npm test works without a built bundle

MCP Apps is new and still changing. Before you write code, read https://modelcontextprotocol.io/extensions/apps/overview.md and https://modelcontextprotocol.io/extensions/apps/build.md, and the README and docs of https://github.com/modelcontextprotocol/ext-apps. The build guide still shows SDK v1 code; this server uses the MCP TypeScript SDK v2 (https://ts.sdk.modelcontextprotocol.io/v2/llms.txt), so take the API from the ext-apps 2.x documentation.

You're done when npm test, npm run lint and npm run typecheck pass, npm run build creates the bundle, and with npm start running both npx -y @mcpjam/cli@latest server doctor --url http://127.0.0.1:3000/mcp reports "ready" and npx -y @mcpjam/cli@latest apps conformance --url http://127.0.0.1:3000/mcp passes.
```

**Verify.**

- [ ] `npm run build` writes one HTML file, and `npm test`, `npm run lint`, and `npm run typecheck` pass.
- [ ] `apps conformance` passes.
- [ ] In the MCPJam Inspector, add the server `http://127.0.0.1:3000/mcp` under **Connect**. Open the **Playground** and pick `open_trainer` in its tool list. Clear **skip** next to `exercise`, choose an exercise, and click **Run**. You don't need a model or an account for that. The trainer appears, Start counts in 4-3-2-1 and shows the chords, and the next bar moves up every four beats.
- [ ] The trainer switches between light and dark when you switch the theme with the moon icon above the chat. Set the Inspector itself to **Light** first, under **Settings > Appearance**. A dark Inspector hands its dark colors to a light preview, and the trainer then looks half dark, although it follows the host correctly. If that happens with a light Inspector too, click **Reset** under **Client Context**.
- [ ] After Stop, the trainer says that it told the chat which keys you practiced.

**Catch up.** Copy `steps/13-mcp-app/mcp-server/` into the root of your fork, replacing your `mcp-server/`, then run `npm install` and `npm run build` in it.
