# AGENTS.md

This repository holds the material for the five-session Heise Academy classroom [Moderne KI-Agents entwickeln – Function Tools, MCP und Multi-Agentensysteme](https://heise-academy.de/kurs/classroom-moderne-ki-agents-entwickeln-function-tools-mcp-ad532b), taught by Rainer Stropek from 2026-11-12 to 2026-12-10.

Read [workshop-overview.md](workshop-overview.md) first. It covers the sessions, topics, audience, and prerequisites, and lists announced topics that no session covers yet.

## Scope

Participants learn to build agents: function tools, MCP servers (stdio, Streamable HTTP, OAuth2, cloud deployment), and multi-agent systems with Mastra. Code is primarily TypeScript. Participants are experienced developers who already use AI-assisted tools.

## Repository structure

The repository is new, so this structure is the intent rather than what exists today. It loosely follows the previous classroom, [`2026-claude-classroom`](https://github.com/rstropek/2026-claude-classroom), with a local copy at `/home/rainer/github/2026-claude-classroom`. Its [README](https://github.com/rstropek/2026-claude-classroom/blob/main/README.md) explains the layout. Use it for inspiration, and adapt it where this workshop needs something else.

Concepts to reuse:

- `storybook-NN.md`: the live-coding script for one session and its source of truth, in plain Markdown. Each step has a goal, the prompt for the coding agent, teaching points, and a verification checklist. Step numbers keep counting across sessions.
- `session-N-result/`: the finished code at the end of session N.
- Separate starter repositories for participants, linked from the storybooks, instead of cloning this repository.
- `images/`: svgbob diagram sources (`.bob`) with their rendered SVGs.
- `_quarto.yml` and `_style/`: PDF rendering of the storybooks into `_output/`, which keeps styling out of the Markdown.
- `.claude/skills/`: project skills for authoring the material, such as `svgbob` and `writing-guide`.

## Differences from the previous classroom

The previous classroom taught working with Claude Code as a coding agent and grew one app, `ai-tutor`, across all sessions. This one teaches how to build agents and MCP servers yourself, so don't assume that app, its stack, or a single continuous project carries over. Participants need an OpenAI API key or OpenAI access through Azure Foundry, where the previous classroom used OpenRouter.
