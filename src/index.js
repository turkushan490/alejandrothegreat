import { client, createBot } from './bot/client.js';
import { deployCommands } from './bot/deployCommands.js';
import { config } from './config.js';
import { createWebServer } from './web/app.js';

async function main() {
  await createBot();
  await client.login(config.discord.token);
  await deployCommands();

  const server = createWebServer();
  server.listen(config.port, () => {
    console.log(`[web] Dashboard listening on port ${config.port}`);
  });
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
