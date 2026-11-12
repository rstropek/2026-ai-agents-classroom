# AGENTS.md

This repository holds the material for the five-session Heise Academy classroom [Moderne KI-Agents entwickeln – Function Tools, MCP und Multi-Agentensysteme](https://heise-academy.de/kurs/classroom-moderne-ki-agents-entwickeln-function-tools-mcp-ad532b), taught by Rainer Stropek from 2026-11-12 to 2026-12-10.

Read [workshop-overview.md](workshop-overview.md) first. It covers the sessions, topics, audience, and prerequisites, and lists announced topics that no session covers yet.

## Scope

Participants learn to build agents: function tools, MCP servers (stdio, Streamable HTTP, OAuth2, cloud deployment), and multi-agent systems with Mastra. Code is primarily TypeScript. Participants are experienced developers who already use AI-assisted tools.

## Repository structure

The repository is new, so this structure is the intent rather than what exists today. It loosely follows the previous classroom, [`2026-claude-classroom`](https://github.com/rstropek/2026-claude-classroom), with a local copy at `/home/rainer/github/2026-claude-classroom`. Its [README](https://github.com/rstropek/2026-claude-classroom/blob/main/README.md) explains the layout. Use it for inspiration, and adapt it where this workshop needs something else.

Concepts to reuse:

- `storybook.md`: the walkthrough for one part of a session and its source of truth, in plain Markdown. Step numbers keep counting across sessions.
- `images/`: svgbob diagram sources (`.bob`) with their rendered SVGs.
- `_quarto.yml` and `_style/`: PDF rendering of the storybooks into `_output/`, which keeps styling out of the Markdown.
- `.claude/skills/`: project skills for authoring the material, such as `svgbob` and `writing-guide`.

## Storybooks are walkthroughs

Participants get the finished sample code. Nobody recreates it with a coding agent during the session. Instead, the class runs each sample, reads it, discusses it, and stops it in the debugger. Participants read the storybooks too, so they address the reader as "you" and contain no trainer-only stage directions.

Each step in a storybook has these parts:

- **Goal**: what the step shows.
- **Run**: the npm command and its expected output.
- **Walkthrough**: the files to open, in reading order, and what to notice in them.
- **Debug**: the breakpoints to set and what to inspect at each one, in the Variables, Watch, Debug Console, or Call Stack pane.
- **Try it** (only where an experiment teaches something): a change to make and what to watch for.
- **Verify**: a checklist of what a working run shows.

Breakpoints are anchored by marker comments in the sample code, never by line numbers. A marker sits on its own line directly above the line to break on, and reads `// Breakpoint <step>.<n>: <what to inspect>.`, for example `// Breakpoint 6.3: two tool calls in one message.` A marker that needs a conditional breakpoint names the condition: `// Breakpoint 8.1 (condition: mode === "programmatic"): ...`. When you change sample code, keep the markers and the storybook's Debug section in sync.

`.vscode/launch.json` has two configurations, **Debug current sample file** and **Debug current sample file with argument**. Both load `.env` from the repository root if it exists.

Code that a debugger can't stop in, such as a shell script with `curl`, gets a walkthrough without breakpoints. Don't use the Debug Console from inside a nested function to reach module-level variables that function doesn't reference, because V8 may not expose them there. Place such experiments at a top-level breakpoint.

## Differences from the previous classroom

The previous classroom taught working with Claude Code as a coding agent and grew one app, `ai-tutor`, across all sessions. This one teaches how to build agents and MCP servers yourself, so don't assume that app, its stack, or a single continuous project carries over. Participants need an OpenAI API key or OpenAI access through Azure Foundry, where the previous classroom used OpenRouter.
