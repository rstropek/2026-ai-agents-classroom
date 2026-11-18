import { access } from 'node:fs/promises';
import { startHttpServer } from './http.ts';
import { TRAINER_HTML_PATH } from './trainer-app.ts';

const port = Number(process.env.PORT ?? 3000);
const server = await startHttpServer(port);
console.log(`MCP server listening on ${server.url}`);
await access(TRAINER_HTML_PATH).catch(() =>
  console.warn('The chord trainer is not built yet: run "npm run build" so that open_trainer can show it.'),
);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, async () => {
    await server.close();
    process.exit(0);
  });
}
