import { DefaultExtractors } from '@discord-player/extractor';
import { Client, GatewayIntentBits } from 'discord.js';
import { Player } from 'discord-player';
import { YoutubeiExtractor } from 'discord-player-youtubei';
import { commands } from './commands/index.js';
import { registerPlayerEvents } from './events/playerEvents.js';
import readyEvent from './events/ready.js';
import interactionCreateEvent from './events/interactionCreate.js';

export const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

client.commands = commands;

export const player = new Player(client);

export async function createBot() {
  // discord-player's Spotify/Apple Music extractors only resolve metadata
  // (Spotify doesn't allow bots to stream its audio). YoutubeiExtractor is
  // registered as the playback "bridge" that actually fetches audio from
  // YouTube for whatever track was resolved.
  await player.extractors.register(YoutubeiExtractor, {});
  await player.extractors.loadMulti(DefaultExtractors);

  registerPlayerEvents(player);

  client.once('ready', readyEvent);
  client.on('interactionCreate', interactionCreateEvent);

  return client;
}
