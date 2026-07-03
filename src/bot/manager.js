import {
  AppleMusicExtractor,
  AttachmentExtractor,
  ReverbnationExtractor,
  SoundCloudExtractor,
  SpotifyExtractor,
  VimeoExtractor,
} from '@discord-player/extractor';
import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';
import { Player } from 'discord-player';
import { YoutubeiExtractor } from 'discord-player-youtubei';
import { getBotConfig } from '../db.js';
import { commands } from './commands/index.js';
import { registerPlayerEvents } from './events/playerEvents.js';
import interactionCreateEvent from './events/interactionCreate.js';
import messageCreateEvent from './events/messageCreate.js';
import readyEvent from './events/ready.js';

// The bot is (re)started at runtime once credentials are saved via the
// setup wizard, so there's no module-level singleton client - callers
// always go through getClient()/getPlayer() to get the current instance.
let client = null;
let player = null;
let startPromise = null;

export function getClient() {
  return client;
}

export function getPlayer() {
  return player;
}

export function isRunning() {
  return Boolean(client?.isReady?.());
}

export async function stopBot() {
  if (client) {
    await client.destroy();
  }
  client = null;
  player = null;
}

export async function startBot() {
  if (startPromise) return startPromise;

  startPromise = (async () => {
    const cfg = getBotConfig();
    if (!cfg?.discordToken || !cfg?.discordClientId) {
      throw new Error('Bot is not configured yet. Visit /setup.html first.');
    }

    await stopBot();

    const newClient = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });
    newClient.commands = commands;

    const newPlayer = new Player(newClient);
    await newPlayer.extractors.register(YoutubeiExtractor, {});
    await newPlayer.extractors.register(SpotifyExtractor, {
      clientId: cfg.spotifyClientId || undefined,
      clientSecret: cfg.spotifyClientSecret || undefined,
    });
    await newPlayer.extractors.register(AppleMusicExtractor, {});
    await newPlayer.extractors.register(SoundCloudExtractor, {});
    await newPlayer.extractors.register(VimeoExtractor, {});
    await newPlayer.extractors.register(ReverbnationExtractor, {});
    await newPlayer.extractors.register(AttachmentExtractor, {});
    registerPlayerEvents(newPlayer);

    newClient.once('ready', readyEvent);
    newClient.on('interactionCreate', interactionCreateEvent);
    newClient.on('messageCreate', messageCreateEvent);

    client = newClient;
    player = newPlayer;

    await client.login(cfg.discordToken);
    await deploySlashCommands(cfg.discordToken, cfg.discordClientId);
  })();

  try {
    await startPromise;
  } finally {
    startPromise = null;
  }
}

export async function tryAutoStart() {
  const cfg = getBotConfig();
  if (cfg?.discordToken && cfg?.discordClientId) {
    try {
      await startBot();
    } catch (err) {
      console.error('[bot] auto-start failed:', err);
    }
  } else {
    console.log('[bot] Not configured yet. Visit /setup.html to add your Discord bot token.');
  }
}

async function deploySlashCommands(token, clientId) {
  const body = [...commands.values()].map((c) => c.data.toJSON());
  const rest = new REST().setToken(token);
  console.log(`[bot] Deploying ${body.length} slash commands...`);
  await rest.put(Routes.applicationCommands(clientId), { body });
  console.log('[bot] Slash commands deployed.');
}
