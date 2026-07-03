import { tryAutoStart } from './bot/manager.js';
import { config } from './config.js';
import { createWebServer } from './web/app.js';

async function main() {
  const server = createWebServer();
  server.listen(config.port, () => {
    console.log(`[web] Dashboard listening on port ${config.port}`);
  });

  await tryAutoStart();
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
