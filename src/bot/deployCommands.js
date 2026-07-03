import { REST, Routes } from 'discord.js';
import { config } from '../config.js';
import { commands } from './commands/index.js';

const body = [...commands.values()].map((c) => c.data.toJSON());
const rest = new REST().setToken(config.discord.token);

export async function deployCommands() {
  console.log(`[bot] Deploying ${body.length} slash commands...`);
  await rest.put(Routes.applicationCommands(config.discord.clientId), { body });
  console.log('[bot] Slash commands deployed.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  deployCommands().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
