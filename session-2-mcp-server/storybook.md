# Session 2 storybook: an MCP server for an existing app

**Classroom: Moderne KI-Agents entwickeln, session 2**

In this part you add an MCP server to a real app: [Practice Jazz Chords](https://practice-jazz-chords.com), an Angular app for practicing jazz chords in all keys. You don't type the code yourself. You prompt a coding agent, check what it built, and move on to the next step. Each step has a **Goal**, the **Prompt** to paste into your coding agent, a **Verify** checklist, and a **Catch up** folder with a finished result in case your agent went off track. Step numbers continue from session 1.

## The idea of this part

The app keeps its chord logic in `src/app/chord-engine`, plain TypeScript without Angular. It parses progressions such as `iim*7* - V*7* | I*maj7*`, puts them into keys, and decides which key comes next. The Angular app uses the engine for its practice page, and your MCP server uses the same code for its tools. That is the typical situation in a real project: the business logic exists, and the MCP server is one more way to use it.

The server uses the stdio transport. The host, such as a chat app or a coding agent, starts the server as a child process on your machine and exchanges MCP messages with it over stdin and stdout. There is no port, no URL, and no login: whoever can start the process can use it. In session 3 you make the same server available over Streamable HTTP.

The three steps build on each other:

1. Step 11 sets up the project and a hello world server, so that you know the setup works before the real tools come in.
2. Step 12 adds tools that create practice sheets: rows of all twelve keys in random order, with the chords of an exercise in each key.
3. Step 13 adds an MCP App, an interactive chord trainer that the host shows right in the chat.

Your server speaks MCP 2026-07-28 only. That version changed the protocol fundamentally: there is no initialize handshake any more, and every request carries what the server needs to know. Your coding agent's training data most likely predates it. That's why the prompts tell the agent to read the current documentation first, starting at <https://modelcontextprotocol.io/llms.txt>. Keep that line when you write your own prompts.

## How the prompts are written

The prompts brief the agent the way you would brief an experienced colleague who doesn't know the project yet. They say what you want, which constraints apply, and when the step is done, and they leave the how to the agent. They name details only where the agent would otherwise go wrong, such as the SDK version and the protocol version, which are newer than its training data.

In step 11 the agent also starts an `AGENTS.md` in the root of your fork. Coding agents read that file at the start of a session, so it is the project's memory: how to run and check the server, the decisions and why they were made, the traps, and links to the documentation. It deliberately leaves out what a quick look at the code shows anyway. That keeps it short and keeps it from going stale. Every later prompt asks the agent to keep the file current, and none of them has to repeat what an earlier step settled.

## Prerequisites

- Node.js 24 or newer
- A coding agent, such as Claude Code, Codex, or GitHub Copilot in agent mode
- A GitHub account

Fork <https://github.com/karin112358/jazz-chord-flashcards> and clone your fork. Your work stays in your fork, so don't open pull requests to the original repository.

You check your server with [MCPJam](https://www.mcpjam.com). Its command line interface needs no installation and no API key. Run it in `mcp-server/`, and it starts your server over stdio itself:

```bash
npx -y @mcpjam/cli@latest server doctor --command node --args src/main.ts
```

The commands in this storybook assume that the server starts with `src/main.ts`. If your agent picked another file name, such as `src/index.ts`, use that one; your `AGENTS.md` names it.

For step 13 you also need the MCPJam Inspector, which shows MCP Apps the way a chat host does. It runs on your machine and needs no account for calling tools:

```bash
npx -y @mcpjam/inspector@latest
```

Open it at <http://127.0.0.1:6274>. Opened as `localhost`, it asks for the link it printed at startup instead.

## Step 11: a hello world MCP server

**Goal.** Set up the MCP server project next to the app: TypeScript in strict mode, Biome, Vitest, and the MCP TypeScript SDK v2 serving stdio. One `hello` tool proves that the setup works, from the test to a real MCP client. Notice that a stdio server must never write anything but MCP messages to stdout, and look at what your agent wrote into `AGENTS.md`.

**Prompt.**

```text
I'd like to add an MCP server to this app, so that AI assistants can use its chord logic. The logic lives in src/app/chord-engine, plain TypeScript without Angular; its README explains it. Leave the Angular app as it is.

Let's start small: a server in its own folder mcp-server/ with a single hello tool that greets a name, so that we know the setup works before the real tools come in. It runs over stdio, which means that a host such as a chat app or a coding agent starts it as a child process.

What I have in mind:
- TypeScript in strict mode, run directly by Node.js 24 without a build step
- Biome for linting and formatting, Vitest for tests, and the npm scripts test, lint and typecheck
- the MCP TypeScript SDK v2, not v1
- MCP protocol 2026-07-28 only; clients that still speak a 2025 version are turned away
- a test that talks to the server the way a real host does and makes sure that the connection really uses 2026-07-28

Your knowledge of MCP is probably outdated. Version 2026-07-28 changed the protocol fundamentally, and SDK v2 is new. Read the current documentation before you write code, starting at https://modelcontextprotocol.io/llms.txt and https://ts.sdk.modelcontextprotocol.io/v2/llms.txt.

Also start an AGENTS.md in the root of the repository for whoever works on the server next, including you in a later session. It's not documentation of the code: write down only what a quick look at the code doesn't tell, such as how to run and check the server, the decisions we made and why, the traps you ran into, and links to the docs that matter. Keep it to one page, and say so at its top, so that it stays that way.

You're done when tests, lint and type check pass and the server doctor of the MCPJam CLI (@mcpjam/cli) reports the server as ready.
```

**Verify.**

- [ ] `mcp-server/package.json` depends on `@modelcontextprotocol/server`, not on `@modelcontextprotocol/sdk`.
- [ ] `npm test`, `npm run lint`, and `npm run typecheck` pass in `mcp-server/`.
- [ ] `server doctor`, run in `mcp-server/`, reports `ready` and protocol version `2026-07-28`:

```bash
npx -y @mcpjam/cli@latest server doctor --command node --args src/main.ts
```

- [ ] This call, run in `mcp-server/`, greets you:

```bash
npx -y @mcpjam/cli@latest tools call --command node --args src/main.ts --tool-name hello --tool-args '{"name":"Karin"}'
```

- [ ] Nothing in `src/` writes to stdout with `console.log`. Logging goes to stderr.
- [ ] `AGENTS.md` in the root of your fork fits on one screen. It names the commands and explains what the code doesn't: why stdout is off limits, why the client must ask for 2026-07-28, and where the documentation is.

**Catch up.** Copy `mcp-server/` and `AGENTS.md` from `steps/11-hello-mcp/` into the root of your fork, and run `npm install` in `mcp-server/`.

## Step 12: practice sheets as tools

**Goal.** Replace `hello` with tools that build on the chord engine: list the exercises, generate a practice sheet, and check a custom progression. The step is about tool design: options a model can fill in without guessing, readable text for the model, and structured content for programs.

**Prompt.**

```text
Now the real tools: turn the hello server into a practice sheet generator for jazz chords, and drop the hello tool.

A practice sheet works like this: each row lists the keys to practice, by default all 12, each exactly once in random order. Each cell shows the chosen exercise in that key, for example Dm7 – G7 | Cmaj7 in C for a ii–V–I over two bars. A row never starts with the key the previous row ended on.

Build on the chord engine; import it, don't copy it. Change the engine only if the server really needs something it lacks, and test that change there too.

The tools I have in mind:
- list_exercises: the predefined exercises, and how to write a custom progression
- generate_exercise_sheet: the user picks a predefined exercise or writes their own progression, and chooses the number of rows, the key order (balanced rows as described above, or one of the app's key orders), which keys to practice, and ratings per key as in the app. On top of that it transposes for Bb, Eb and F instruments, which the app can't do: the chords are written for the instrument, while the keys and the ratings stay at concert pitch. A seed makes a sheet reproducible.
- check_progression: shows how the app reads a custom progression in a given key, and warns about typical mistakes, such as a chord type outside the asterisks

A model calls these tools, so describe them and their parameters well enough that it never has to guess. Return readable text for the model and structured content for programs.

Test the sheet logic, and test each tool the way a host talks to the server. Update AGENTS.md with what this step taught us that the code doesn't tell, and shorten or drop what no longer earns its place, so that it stays on one page.

You're done when tests, lint and type check pass, the doctor still reports the server as ready, and the MCPJam CLI can call generate_exercise_sheet for the exercise "ii7 - V7 - Imaj7 (two bars)" with four rows for a Bb instrument, with a response that passes its validation.
```

**Verify.**

- [ ] `npm test`, `npm run lint`, and `npm run typecheck` pass in `mcp-server/`, and the server imports the chord engine instead of copying it.
- [ ] This call, run in `mcp-server/`, prints four rows. Each row has twelve different keys, and the chords are written for a Bb instrument: the ii–V–I of concert C reads `Em7 – A7 | Dmaj7`.

```bash
npx -y @mcpjam/cli@latest tools call --command node --args src/main.ts --tool-name generate_exercise_sheet --tool-args '{"exercise":"ii7 - V7 - Imaj7 (two bars)","rows":4,"transposition":"Bb"}' --expect-success --validate-response
```

- [ ] `check_progression` with `viidim7 - V*7*` warns that `dim` stands outside the asterisks:

```bash
npx -y @mcpjam/cli@latest tools call --command node --args src/main.ts --tool-name check_progression --tool-args '{"progression":"viidim7 - V*7*"}'
```

Your agent may have named the parameters differently. `tools list` with the same `--command` and `--args` shows its names.

- [ ] `AGENTS.md` mentions what the step added that the code doesn't explain, such as the decision to import the engine and what the transposition means, without describing the tools one by one.

**Catch up.** Copy `mcp-server/` and `AGENTS.md` from `steps/12-chord-tools/` into the root of your fork, replacing yours, and run `npm install` in `mcp-server/`.

## Step 13: the chord trainer as an MCP App

**Goal.** Give the server a user interface. An MCP App is a small web page that a tool declares and the host renders inside the chat. The trainer shows a bar of chords at a time, like the app's practice page, and tells the model afterwards which keys were practiced. The transport doesn't matter for that: the host fetches the page from your server over stdio like any other resource.

**Prompt.**

```text
Next, the server gets a user interface: an MCP App with a chord trainer that the host shows right in the chat. It complements the Angular app and doesn't replace it.

The trainer works like the app's practice page (src/app/components/player): it shows the current bar large and the next bar small, and moves on every four beats at the chosen tempo. A visual beat counter is enough, no sound. The user can start, stop, and change the tempo. A tool open_trainer opens it with the exercise options of the sheet generator plus a tempo; rows, seed, and the choice of keys don't apply, because the trainer runs until the user stops it. The bars come from the chord engine, running in the browser. When the user stops, the trainer lets the model know which keys were practiced since it was opened.

For the UI I'd like React, bundled into a single HTML file that the server hands to the host; npm run build creates it. Hosts block external fonts, scripts, and requests inside an app. The trainer follows the host's light or dark theme, not the operating system's. The tests must still run without a built bundle.

MCP Apps is new and still changing, so read the docs before you write code: https://modelcontextprotocol.io/extensions/apps/overview.md, https://modelcontextprotocol.io/extensions/apps/build.md, and the README and docs of https://github.com/modelcontextprotocol/ext-apps. The build guide still shows code for SDK v1; we use SDK v2, so take the API from ext-apps 2.x. Update AGENTS.md with what this step taught us that the code doesn't tell, and shorten or drop what no longer earns its place, so that it stays on one page.

You're done when tests, lint and type check pass, the build creates the bundle, the doctor still reports the server as ready, and the apps conformance check of the MCPJam CLI passes.
```

**Verify.**

- [ ] `npm run build` writes one HTML file, and `npm test`, `npm run lint`, and `npm run typecheck` pass.
- [ ] `apps conformance`, run in `mcp-server/`, passes:

```bash
npx -y @mcpjam/cli@latest apps conformance --command node --args src/main.ts
```

- [ ] In the MCPJam Inspector, click **Add Server** under **Connect**, set **Connection Type** to **STDIO**, and enter `node` followed by the absolute path of your `mcp-server/src/main.ts` as the command. The first time, the Inspector asks whether it may run that command on your machine; allow it. Open the **Playground** and pick `open_trainer` in its tool list. Clear **skip** next to `exercise`, choose an exercise, and click **Run**. You don't need a model or an account for that. The trainer appears, Start counts in 4-3-2-1 and shows the chords, and the next bar moves up every four beats.
- [ ] The trainer switches between light and dark when you switch the theme with the moon icon above the chat. Set the Inspector itself to **Light** first, under **Settings > Appearance**. The Inspector sometimes hands dark colors to a light preview: the trainer then looks half dark, although it follows the host correctly. If that happens, click **Reset** under **Client Context** and run the tool again.
- [ ] After Stop, the trainer says that it told the chat which keys you practiced.
- [ ] Above the trainer, **Sandbox** may report blocked `eval` requests. That is zod, which the SDK uses: it tests once whether `eval` is allowed and works without it.
- [ ] `AGENTS.md` now covers the UI: how to build it, why the server must work without the bundle, and the limits a host puts on an app.

**Catch up.** Copy `mcp-server/` and `AGENTS.md` from `steps/13-mcp-app/` into the root of your fork, replacing yours, then run `npm install` and `npm run build` in `mcp-server/`.

## Optional: notes in the trainer

**Goal.** Show the chord tones of the current bar as notes on a staff, for players who know their instrument better than music theory. The step adds something the app can't do yet: a converter from chord symbols to notes. It runs on the server as a tool that only the trainer may call. The model never sees that tool or its results, so the notes cost no tokens, and the conversion is code with tests instead of something the model works out anew every time. Do this step if there is time left; session 3 works with or without it.

**Prompt.**

```text
One more thing for the trainer: below the chord symbols of the current bar, show the chord tones as notes on a staff, so that players who aren't fluent in music theory see what to play. Root position on a treble staff is fine. For Bb, Eb and F instruments the notes are written for the instrument, like the chord symbols.

The conversion from chord symbol to notes belongs on the server, not in the UI; the practice sheet or the Angular app may want it later. Offer it as a tool that only the trainer can call. The model doesn't need it, and the notes would only cost tokens in its context. The trainer draws the staff in the browser from ABC notation. I looked at tonal for the chord tones and abcjs for drawing; check their current docs, and check the spelling of the notes, because no library gets every chord right. A chord the converter doesn't understand simply gets no notes.

The trainer moves on every four beats and must not wait for the server, so fetch what it needs up front instead of asking for every bar. The same rules as before apply to the bundle and the theme: no external requests, and the staff follows the host's light or dark theme.

Read how ext-apps handles tools that only an app may call before you write code. Update AGENTS.md with what this step taught us that the code doesn't tell, and shorten or drop what no longer earns its place, so that it stays on one page.

You're done when tests, lint and type check pass, the build creates the bundle, the doctor still reports the server as ready, apps conformance still passes, and the new tool is marked as callable by the app only.
```

**Verify.**

- [ ] `npm test`, `npm run lint`, and `npm run typecheck` pass, and `npm run build` writes one HTML file.
- [ ] `apps conformance` from step 13 still passes.
- [ ] `tools list` shows the new tool with `"visibility":["app"]` in its `_meta`. Hosts read that and don't offer the tool to the model:

```bash
npx -y @mcpjam/cli@latest tools list --command node --args src/main.ts
```

- [ ] In the MCPJam Inspector, the tool list of the **Playground** shows the new tool with visibility `app`. Run `open_trainer` as in step 13 with the exercise `ii7 - V7 - Imaj7 (two bars)` and the transposition for Bb. Below the trainer, the Inspector lists one call of the new tool: the trainer made it, not the model. After Start you see a staff below the chords, and its notes match them: `Em7` shows E, G, B, and D.
- [ ] The staff is readable in the light and the dark theme.
- [ ] `AGENTS.md` names the decision to convert on the server and why the tool is hidden from the model.

**Catch up.** Copy `mcp-server/` and `AGENTS.md` from `steps/13-optional-notes/` into the root of your fork, replacing yours, then run `npm install` and `npm run build` in `mcp-server/`.
