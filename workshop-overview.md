# Workshop overview

Condensed from the [Heise Academy announcement](https://heise-academy.de/kurs/classroom-moderne-ki-agents-entwickeln-function-tools-mcp-ad532b), retrieved 2026-11-08. The announcement is in German, so session titles are kept in their original wording.

**Moderne KI-Agents entwickeln – Function Tools, MCP und Multi-Agentensysteme**

| | |
|---|---|
| Provider | Heise Academy, live in the digital academy Campus |
| Trainer | Rainer Stropek (software architects) |
| Schedule | 5 sessions, Thursdays 09:00 to 13:00, 2026-11-12 to 2026-12-10 |
| Style | Code-heavy, with room for participants to code along |
| Main language | TypeScript, with occasional Python and C# examples |
| Trainer's tooling | Visual Studio Code with Claude Code; any modern AI-assisted IDE works |
| Price | From 895.00 € including VAT (752.10 € net), or as part of the Professional Pass |

## Learning goals

By the end, participants can design, implement, and integrate their own AI agents and multi-agent systems into production environments. Specifically, they can:

- Design and implement function tools and integrate them into their own projects.
- Use the Model Context Protocol (MCP) version 2026-07-28, including authentication, extensions such as MCP Apps, transports, and integration into common development environments such as Copilot, Codex, and Claude.
- Build and operate multi-agent systems with open-source SDKs, such as Mastra and the OpenAI Agents SDK.

## Sessions

### Session 1, 2026-11-12: Function Tools für agentische KI-Systeme entwickeln

- Introduction to agentic behavior and function tools
- Building your own function tools in TypeScript
- Structured output, ready-made function tools, and programmatic tool calling
- Good practices for designing and parameterizing function tools
- Practical examples and joint coding

### Session 2, 2026-11-19: KI-Agenten verbinden – Model Context Protocol (MCP) und Skills

- Foundations and goals of MCP
- MCP compared with CLIs
- The stdio transport
- Examples using ready-made MCP servers
- Building your own MCP server over stdio in TypeScript

### Session 3, 2026-11-26: MCP Streamable-Protokoll für KI-Anwendungen

- Overview of the MCP Streamable transport and streaming basics
- Server-Sent Events (SSE) and their peculiarities
- Implementing Streamable in your own MCP servers in TypeScript
- What's new in MCP 2026-07-28 (stateless MCP)
- Challenges and best practices for MCP servers on the internet

### Session 4, 2026-12-03: MCP-Server produktiv betreiben – Cloud-Deployment und Sicherheitskonzepte

- Deploying and running MCP servers in cloud environments
- OAuth2 authentication with MCP, from foundations to implementation
- Cloud deployment strategies
- Testing, debugging, maintenance, and good practices

### Session 5, 2026-12-10: Multi-Agentensysteme entwickeln – Agent SDKs und Protokolle

- Multi-agent systems: foundations and architecture
- Working with the Mastra SDK
- The AG-UI, A2UI, and A2A protocols: structure, purpose, and practical use

## Audience

Software developers who already have hands-on experience with AI-assisted development tools and want a deeper technical understanding of agentic AI systems, function tools, and their integration into modern development and cloud environments.

## Prerequisites

Knowledge, at a basic level unless noted:

- Hands-on experience with AI-assisted development tools such as GitHub Copilot, Cursor, Claude, or Codex
- Prompt engineering
- JavaScript or TypeScript (sample code is provided, so nobody has to write code from scratch)
- Web APIs, especially AI APIs such as the OpenAI API
- OAuth2

Setup:

- Current LTS version of Node.js or a comparable runtime
- An IDE, ideally with AI support
- An OpenAI API key with at least 10 € of credit, or OpenAI access through Azure Foundry

## Promised but not assigned to a session

The announcement names these topics without listing them under any session. Plan a place for them, or confirm with Rainer that they can be dropped:

- **Skills** appear in the title of session 2, but in none of its topics.
- **MCP Apps** appear in the learning goals and course description.
- **OpenAI Agents SDK** appears in the learning goals, while session 5 only names Mastra.
- **Integrating tools into Copilot, Codex, and Claude** appears in the course description.
- **Best practices in agent design** appear in the course description.

## Not stated in the announcement

Recordings, course materials beyond the sample code, course language, group size, and certificates aren't mentioned.
