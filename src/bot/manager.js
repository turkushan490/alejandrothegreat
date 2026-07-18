import {
  AppleMusicExtractor,
  AttachmentExtractor,
  ReverbnationExtractor,
  SoundCloudExtractor,
  SpotifyExtractor,
  VimeoExtractor,
} from '@discord-player/extractor';
import { FFmpeg } from '@discord-player/ffmpeg';
import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';
import { Player } from 'discord-player';
import { YoutubeiExtractor } from 'discord-player-youtubei';
import { getBot, listBots } from '../db.js';
import { commands } from './commands/index.js';
import { registerPlayerEvents } from './events/playerEvents.js';
import interactionCreateEvent from './events/interactionCreate.js';
import readyEvent from './events/ready.js';

// Runs once at startup so a broken audio pipeline (missing ffmpeg/opus)
// shows up clearly in the logs instead of silently queueing tracks that
// never actually play.
let diagnosticsLogged = false;
async function logAudioPipelineDiagnostics() {
  if (diagnosticsLogged) return;
  diagnosticsLogged = true;

  const resolved = FFmpeg.resolveSafe();
  if (resolved) {
    console.log(`[audio] ffmpeg resolved: ${resolved.name} (${resolved.path}), version ${resolved.version}`);
  } else {
    console.error('[audio] Could not resolve an ffmpeg binary - playback will fail silently. Check that ffmpeg is installed in the container.');
  }

  try {
    await import('@discord-player/opus');
    console.log('[audio] @discord-player/opus loaded OK');
  } catch (err) {
    console.error('[audio] @discord-player/opus failed to load - playback will fail silently:', err.message);
  }

  // yt-dlp is what actually pulls audio from YouTube. If it's missing or
  // broken, playback fails silently, so surface its status at startup.
  try {
    const ytdl = (await import('youtube-dl-exec')).default;
    const version = await ytdl('', { version: true }).catch(() => null);
    if (version) {
      console.log(`[audio] yt-dlp available: ${String(version).trim()}`);
    } else {
      console.error('[audio] yt-dlp did not respond to --version - YouTube playback may fail. Ensure python3 is installed in the container.');
    }
  } catch (err) {
    console.error('[audio] yt-dlp check failed - YouTube playback may fail:', err.message);
  }
}

// Multiple independent Discord bot instances can run from this one
// container/process - each bot has its own Client + Player, keyed by its
// database id. There's no single "the bot" anymore; every caller resolves
// the instance it needs either by botId directly or by which guild it
// controls (see findInstanceForGuild).
const instances = new Map(); // botId -> { client, player }
const startPromises = new Map(); // botId -> in-flight start promise

export function getClient(botId) {
  return instances.get(botId)?.client || null;
}

export function getPlayer(botId) {
  return instances.get(botId)?.player || null;
}

export function getAllInstances() {
  return [...instances.entries()].map(([botId, inst]) => ({ botId, ...inst }));
}

export function isInstanceRunning(botId) {
  return Boolean(instances.get(botId)?.client?.isReady?.());
}

// Finds whichever running bot instance is actually a member of the given
// guild. Playback actions and web routes are guild-scoped, not bot-scoped,
// so this is the one lookup that makes multi-bot mostly transparent to
// the rest of the app.
export function findInstanceForGuild(guildId) {
  for (const [botId, inst] of instances) {
    if (inst.client.guilds.cache.has(guildId)) {
      return { botId, ...inst };
    }
  }
  return null;
}

export async function stopBotInstance(botId) {
  const inst = instances.get(botId);
  if (inst) {
    await inst.client.destroy();
  }
  instances.delete(botId);
}

export async function startBotInstance(botId) {
  if (startPromises.has(botId)) return startPromises.get(botId);

  const promise = (async () => {
    const bot = getBot(botId);
    if (!bot) throw new Error('Bot not found.');
    if (!bot.discordToken || !bot.discordClientId) {
      throw new Error('Bot is missing credentials.');
    }

    await stopBotInstance(botId);
    await logAudioPipelineDiagnostics();

    // Slash commands + interaction buttons only - no message-content
    // reading, so no privileged Message Content intent needed.
    const newClient = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
    });
    newClient.commands = commands;

    // skipFFmpeg:false forces every source through ffmpeg transcoding. By
    // default discord-player passes an already-Opus source (YouTube's
    // WebM/Opus via yt-dlp) straight through without re-encoding, but those
    // frames don't line up to Discord's 20ms Opus framing -> robotic/choppy
    // audio on YouTube links. Spotify sounded fine only because its bridge
    // picks an AAC/mp4 format that always gets transcoded. Forcing ffmpeg
    // makes YouTube clean too (the host has CPU to spare).
    const newPlayer = new Player(newClient, { skipFFmpeg: false });
    // Stream audio via yt-dlp (useYoutubeDL) instead of youtubei.js's own
    // internal client. YouTube now frequently hands youtubei.js track
    // metadata with no usable stream URL ("No valid URL to decipher"),
    // which is silent from Discord's side - the bot joins voice, queues the
    // track, and plays nothing. yt-dlp reliably extracts a real audio URL
    // and self-updates on startup, so it keeps working as YouTube changes.
    // youtubei.js is still used for search/metadata, just not for streaming.
    await newPlayer.extractors.register(YoutubeiExtractor, { useYoutubeDL: true });
    await newPlayer.extractors.register(SpotifyExtractor, {
      clientId: bot.spotifyClientId || undefined,
      clientSecret: bot.spotifyClientSecret || undefined,
    });
    await newPlayer.extractors.register(AppleMusicExtractor, {});
    await newPlayer.extractors.register(SoundCloudExtractor, {});
    await newPlayer.extractors.register(VimeoExtractor, {});
    await newPlayer.extractors.register(ReverbnationExtractor, {});
    await newPlayer.extractors.register(AttachmentExtractor, {});
    registerPlayerEvents(newPlayer);

    // Opt-in verbose diagnostics for chasing playback stutter (buffer
    // underruns, re-buffering, voice connection jitter). Enable by setting
    // PLAYER_DEBUG=1 on the container; leave off for normal runs.
    if (process.env.PLAYER_DEBUG) {
      newPlayer.on('debug', (m) => console.log('[player]', m));
      newPlayer.events.on('debug', (queue, m) => console.log(`[queue ${queue.guild.id}]`, m));
      newPlayer.events.on('connection', (queue) =>
        console.log(`[voice ${queue.guild.id}] connected, ping ${queue.ping ?? '?'}ms`)
      );
    }

    newClient.once('ready', readyEvent);
    newClient.on('interactionCreate', interactionCreateEvent);

    instances.set(botId, { client: newClient, player: newPlayer });

    await newClient.login(bot.discordToken);
    await deploySlashCommands(bot.discordToken, bot.discordClientId);
  })();

  startPromises.set(botId, promise);
  try {
    await promise;
  } finally {
    startPromises.delete(botId);
  }
}

export async function restartBotInstance(botId) {
  await stopBotInstance(botId);
  await startBotInstance(botId);
}

export async function startAllEnabledBots() {
  const bots = listBots().filter((b) => b.enabled);
  if (bots.length === 0) {
    console.log('[bot] No bots configured yet. Visit /setup.html to add one.');
    return;
  }
  for (const bot of bots) {
    try {
      await startBotInstance(bot.id);
    } catch (err) {
      console.error(`[bot] "${bot.name}" (${bot.id}) failed to start:`, err);
    }
  }
}

async function deploySlashCommands(token, clientId) {
  const body = [...commands.values()].map((c) => c.data.toJSON());
  const rest = new REST().setToken(token);
  console.log(`[bot] Deploying ${body.length} slash commands...`);
  await rest.put(Routes.applicationCommands(clientId), { body });
  console.log('[bot] Slash commands deployed.');
}
