# Session 3 storybook: from stdio to Streamable HTTP

**Classroom: Moderne KI-Agents entwickeln, session 3**

In session 2 you built an MCP server for [Practice Jazz Chords](https://practice-jazz-chords.com) that a host starts as a child process and talks to over stdio. In this part you make the same server reachable over Streamable HTTP, the transport for servers that run as a service instead of as a process on the user's machine. As before, you prompt a coding agent and check its result. Each step has a **Goal**, the **Prompt** to paste into your coding agent, a **Verify** checklist, and a **Catch up** folder with a finished result.

## The idea of this part

With stdio, the host owns the server process: one host, one process, one connection. Over HTTP, the server is a service on a port, and any client that can reach it may send requests, including web pages in a browser. That changes two things:

- **State.** MCP 2026-07-28 is stateless. There are no sessions: every HTTP request carries what the server needs, and the server can answer it with a fresh instance. Your tools and the trainer don't keep state between calls, so they work unchanged.
- **Who may call.** A server on `127.0.0.1` is still reachable from any web page the user opens, through DNS rebinding. The server must check the `Host` and `Origin` headers and accept only localhost.

The tools, the MCP App, and their tests stay as they are. Only the way the messages travel changes, and the server keeps its stdio entry point, so hosts that start `node src/main.ts` don't notice anything.

The prompt is written like the ones in session 2: what you want, the constraints, and when the step is done. It doesn't repeat how to run the tests or which SDK to use, because the agent finds that in the `AGENTS.md` it has kept since step 11.

## Prerequisites

You need the result of session 2: your fork with `mcp-server/` and `AGENTS.md` after step 13, with or without the optional notes. If you don't have it, copy `mcp-server/` and `AGENTS.md` from `../session-2-mcp-server/steps/13-mcp-app/` into the root of your fork, then run `npm install` and `npm run build` in `mcp-server/`.

You check the server with the [MCPJam](https://www.mcpjam.com) command line interface and Inspector, as in session 2. This time they connect to a URL instead of starting your server.

## Step 14: the server over Streamable HTTP

**Goal.** Add a second entry point that serves the same MCP server over Streamable HTTP on `http://127.0.0.1:3000/mcp`, stateless and localhost-only. The tests run once over each transport, and the MCPJam protocol conformance check, which needs HTTP, now applies to your server.

**Prompt.**

```text
So far the server runs over stdio. I'd like to run it as a local service over Streamable HTTP as well, at http://127.0.0.1:3000/mcp, started with npm start. Stdio keeps working as it is: hosts that start the server as a child process must not notice any difference.

What I have in mind:
- both transports serve the same tools and the trainer, without registering anything twice
- still protocol 2026-07-28 only, and stateless over HTTP
- the service is for this machine only, and it must not be open to DNS rebinding
- the SDK's HTTP support instead of protocol code of our own
- the existing tests run over both transports, plus tests for what only HTTP has, such as turning away a foreign origin

Streamable HTTP changed a lot with 2026-07-28: sessions and the initialize handshake are gone. Don't rely on what you remember. Read the transport and versioning pages of the specification and how SDK v2 serves HTTP before you write code. Update AGENTS.md with what this step taught us that the code doesn't tell, and shorten or drop what no longer earns its place, so that it stays on one page.

You're done when tests, lint and type check pass, the protocol and apps conformance checks of the MCPJam CLI pass against the running HTTP server, and the doctor still reports the stdio server as ready.
```

**Verify.**

- [ ] `npm test`, `npm run lint`, and `npm run typecheck` pass, and the server tests run over both stdio and HTTP.
- [ ] With `npm start` running, `protocol conformance` reports no failed checks, and `apps conformance` passes:

```bash
npx -y @mcpjam/cli@latest protocol conformance --url http://127.0.0.1:3000/mcp
```

```bash
npx -y @mcpjam/cli@latest apps conformance --url http://127.0.0.1:3000/mcp
```

- [ ] A request with a foreign origin gets status 403. `protocol conformance` skips its DNS rebinding checks for 2026-07-28, so check it yourself:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:3000/mcp -H 'Content-Type: application/json' -H 'Origin: https://evil.example.com' -d '{}'
```

- [ ] This call prints a practice sheet over HTTP:

```bash
npx -y @mcpjam/cli@latest tools call --url http://127.0.0.1:3000/mcp --tool-name generate_exercise_sheet --tool-args '{"exercise":"Major 7","rows":1}' --expect-success --validate-response
```

- [ ] In the MCPJam Inspector, add the server `http://127.0.0.1:3000/mcp` under **Connect**, open the **Playground**, and run `open_trainer` as in step 13. The trainer works exactly as it did over stdio.
- [ ] `AGENTS.md` names both ways to start the server and the reason for the Host and Origin checks.

`server doctor --url` reports `partial` for this server. Its first probe is a 2025 `initialize` request, which your server rejects on purpose because it speaks 2026-07-28 only. The other checks connect with 2026-07-28 and pass.

**Catch up.** Copy `mcp-server/` and `AGENTS.md` from `steps/14-streamable-http/` into the root of your fork, replacing yours, then run `npm install` and `npm run build` in `mcp-server/`.
