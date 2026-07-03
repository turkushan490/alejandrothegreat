import { startAllEnabledBots } from './bot/manager.js';
import { config } from './config.js';
import { createWebServer } from './web/app.js';

// Some transitive libraries in the Discord voice stack throw synchronously
// from event handlers instead of emitting a catchable error (seen with
// discord-voip's DAVE negotiation), which would otherwise crash the whole
// process - bot AND web dashboard - over a single bad voice connection.
// Log and keep running instead.
process.on('uncaughtException', (err) => {
  console.error('[fatal] uncaught exception (continuing):', err);
});
process.on('unhandledRejection', (err) => {
  console.error('[fatal] unhandled rejection (continuing):', err);
});

async function main() {
  const server = createWebServer();
  server.listen(config.port, () => {
    console.log(`[web] Dashboard listening on port ${config.port}`);
  });

  await startAllEnabledBots();
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
