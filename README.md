# Building modern AI agents classroom

This repository holds the sample code and walkthroughs for [Moderne KI-Agents entwickeln – Function Tools, MCP und Multi-Agentensysteme](https://heise-academy.de/kurs/classroom-moderne-ki-agents-entwickeln-function-tools-mcp-ad532b), a five-session Heise Academy classroom taught by Rainer Stropek from 2026-11-12 to 2026-12-10.

The classroom is about building agents yourself, not about using a coding agent. You start with function tools and follow one tool call down to the text a model generates. Then you build Model Context Protocol (MCP) servers over stdio and Streamable HTTP, protect them with OAuth2, and deploy them to the cloud. The last session puts several agents together with Mastra. The code is TypeScript and runs directly on Node.js 24, so there's no build step.

[workshop-overview.md](workshop-overview.md) has the full course description, audience, and prerequisites.

## How the material works

You get finished sample code. Instead of typing it in, you run each sample, read it, and stop it in the debugger where something interesting happens. Each part of a session has a `storybook.md` that walks you through its steps, and every step has the same shape:

- **Goal**: what the step shows.
- **Run**: the npm command and what it prints.
- **Walkthrough**: the files to open, in reading order.
- **Debug**: the breakpoints to set and what to inspect at each one.
- **Try it**: an experiment, where one teaches something.
- **Verify**: what a working run shows.

Step numbers keep counting across parts and sessions. Breakpoints are marked in the code with comments such as `// Breakpoint 6.2: the history this step sends.`, so a search for `Breakpoint 6.` finds every stop of step 6.

## Sessions

| Session | Date | Topic | Material |
|---|---|---|---|
| 1 | 2026-11-12 | Function tools | see below |
| 2 | 2026-11-19 | MCP and skills, stdio transport | follows |
| 3 | 2026-11-26 | MCP Streamable HTTP | follows |
| 4 | 2026-12-03 | MCP servers in production: cloud deployment and OAuth2 | follows |
| 5 | 2026-12-10 | Multi-agent systems with Mastra, AG-UI, A2UI, and A2A | follows |

Session 1 has three parts, each in its own folder:

| Part | Steps | Folder |
|---|---|---|
| Function calling fundamentals: SDK, raw HTTP, chat templates, and the model's raw text | 1 to 5 | [`session-1-function-calling-fundamentals/`](session-1-function-calling-fundamentals/) |
| Function calling APIs: OpenAI, Anthropic, and Mastra side by side, structured output, programmatic tool calling | 6 to 8 | [`session-1-function-calling-apis/`](session-1-function-calling-apis/) |
| Tool design: generic search-and-call tools and an ERP as a Bash command, with a Slidev deck | 9 to 10 | [`session-1-tool-design/`](session-1-tool-design/) |

## Getting started

You need Node.js 24 or newer and Visual Studio Code. The fundamentals part also uses `curl` and `jq`.

Create `.env` in the repository root with your API keys:

```
OPENAI_API_KEY=...
OPENROUTER_API_KEY=...
```

Most samples run with an OpenAI key. A few show details that only OpenRouter exposes, such as the raw completion text of an open-weight model. The prerequisites section of each storybook says which key each step needs and how to switch a sample from one to the other.

Then pick a part, install its packages, and run a step:

```bash
cd session-1-function-calling-fundamentals
npm install
npm run 01:sdk
```

Each folder's `package.json` lists the scripts, named after their step numbers.

To debug, open the repository root in Visual Studio Code, open a sample file, set the breakpoints from the storybook, and start **Debug current sample file** from the Run and Debug view. **Debug current sample file with argument** asks for one command-line argument first. Both configurations load `.env` from the repository root.

## Repository layout

```text
workshop-overview.md            Course description, sessions, audience, prerequisites
session-N-<part>/               One part of a session
  storybook.md                  The walkthrough for that part
  NN-<name>/                    Sample code for step NN
  package.json                  npm scripts per step
.vscode/launch.json             Debug configurations for the current sample file
AGENTS.md                       Instructions for coding agents that work on this material
```
