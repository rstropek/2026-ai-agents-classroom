import { startServer } from './server.ts';

const port = Number(process.env.PORT ?? 3000);
const server = await startServer(port);
console.log(`MCP server listening on ${server.url}`);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, async () => {
    await server.close();
    process.exit(0);
  });
}
