# AGENTS.md

This repository holds the material for the five-session Heise Academy classroom [Moderne KI-Agents entwickeln – Function Tools, MCP und Multi-Agentensysteme](https://heise-academy.de/kurs/classroom-moderne-ki-agents-entwickeln-function-tools-mcp-ad532b), taught by Rainer Stropek from 2026-11-12 to 2026-12-10.

Read [workshop-overview.md](workshop-overview.md) first. It covers the sessions, topics, audience, and prerequisites, and lists announced topics that no session covers yet.

## Scope

Participants learn to build agents: function tools, MCP servers (stdio, Streamable HTTP, OAuth2, cloud deployment), and multi-agent systems with Mastra. Code is primarily TypeScript. Participants are experienced developers who already use AI-assisted tools.

## Repository structure

The repository is new, so this structure is the intent rather than what exists today. It loosely follows the previous classroom, [`2026-claude-classroom`](https://github.com/rstropek/2026-claude-classroom), with a local copy at `/home/rainer/github/2026-claude-classroom`. Its [README](https://github.com/rstropek/2026-claude-classroom/blob/main/README.md) explains the layout. Use it for inspiration, and adapt it where this workshop needs something else.

Concepts to reuse:

- `storybook.md`: the guide for one part of a session and its source of truth, in plain Markdown. Step numbers keep counting across sessions.
- `images/`: svgbob diagram sources (`.bob`) with their rendered SVGs.
- `_quarto.yml` and `_style/`: PDF rendering of the storybooks into `_output/`, which keeps styling out of the Markdown.
- `.claude/skills/`: project skills for authoring the material, such as `svgbob` and `writing-guide`.

## Storybooks

Participants read the storybooks too, so they address the reader as "you" and contain no trainer-only stage directions. Session 1 storybooks are walkthroughs of finished code. From session 2 on, storybooks are prompts: the class generates the code live with a coding agent.

### Session 1: walkthroughs

Participants get the finished sample code. Nobody recreates it with a coding agent during the session. Instead, the class runs each sample, reads it, discusses it, and stops it in the debugger.

Each step in a walkthrough has these parts:

- **Goal**: what the step shows.
- **Run**: the npm command and its expected output.
- **Walkthrough**: the files to open, in reading order, and what to notice in them.
- **Debug**: the breakpoints to set and what to inspect at each one, in the Variables, Watch, Debug Console, or Call Stack pane.
- **Try it** (only where an experiment teaches something): a change to make and what to watch for.
- **Verify**: a checklist of what a working run shows.

Breakpoints are anchored by marker comments in the sample code, never by line numbers. A marker sits on its own line directly above the line to break on, and reads `// Breakpoint <step>.<n>: <what to inspect>.`, for example `// Breakpoint 6.3: two tool calls in one message.` A marker that needs a conditional breakpoint names the condition: `// Breakpoint 8.1 (condition: mode === "programmatic"): ...`. When you change sample code, keep the markers and the storybook's Debug section in sync.

`.vscode/launch.json` has two configurations, **Debug current sample file** and **Debug current sample file with argument**. Both load `.env` from the repository root if it exists.

Code that a debugger can't stop in, such as a shell script with `curl`, gets a walkthrough without breakpoints. Don't use the Debug Console from inside a nested function to reach module-level variables that function doesn't reference, because V8 may not expose them there. Place such experiments at a top-level breakpoint.

### From session 2: prompts

The class builds the code during the session by prompting a coding agent, starting with an MCP server for an existing app. Write down the prompts that actually worked while building the reference solution, not afterwards from memory.

Prompts are also examples of good prompting, so write them the way a developer briefs an experienced colleague: what to build, the constraints, and when it's done, in plain sentences. Leave out commands with their flags, file layouts, MIME types, package and plugin names, and API hints. Name a detail only where the agent's training data is likely outdated, such as the MCP SDK and protocol versions, and point to the current documentation (the `llms.txt` files) instead of explaining it. The exact commands belong in **Verify**, which the participants run themselves.

In the demo app, the first prompt has the agent start an `AGENTS.md` in the root of the fork, with a sentence at its top on what belongs in it, and every later prompt asks to update it with what the step taught and to shorten or drop what no longer earns its place. Without that rule the file grows into a description of the code with every step. That file holds commands, decisions with their reasons, traps, and documentation links, but nothing a quick look at the code shows. Later prompts rely on it instead of repeating earlier details. Each catch-up folder therefore holds `AGENTS.md` next to `mcp-server/`.

Each step in a prompt storybook has these parts:

- **Goal**: what the step builds and which concept it teaches.
- **Prompt**: the prompt to paste into the coding agent, verbatim, in a code block.
- **Verify**: a checklist of what a working result shows, such as a passing test or a tool call in MCPJam.
- **Catch up**: the folder under `steps/` with the finished state of the step, for anyone whose agent went off track.

## Differences from the previous classroom

The previous classroom taught working with Claude Code as a coding agent and grew one app, `ai-tutor`, across all sessions. This one teaches how to build agents and MCP servers yourself, so don't assume that app, its stack, or a single continuous project carries over. Participants need an OpenAI API key or OpenAI access through Azure Foundry, where the previous classroom used OpenRouter.
