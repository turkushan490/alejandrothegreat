import { getGuildSettings } from '../../db.js';
import {
  ActionError,
  listQueue,
  nowPlaying,
  pauseTrack,
  playTrack,
  removeTrackAt,
  resumeTrack,
  setLoopMode,
  setVolume,
  shuffleQueue,
  skipTrack,
  stopPlayback,
} from '../actions.js';
import { canControl } from '../permissions.js';

const CONTROL_COMMANDS = new Set([
  'play', 'pause', 'resume', 'skip', 'stop', 'volume', 'shuffle', 'remove', 'loop',
]);

const HANDLERS = {
  async play(message, args) {
    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel) {
      await message.reply('Join a voice channel first.');
      return;
    }
    if (!args) {
      await message.reply('Usage: `<prefix>play <Spotify link, YouTube link, or search terms>`');
      return;
    }
    const { track, playlist } = await playTrack({
      guildId: message.guild.id,
      voiceChannel,
      textChannel: message.channel,
      query: args,
      requestedBy: message.author,
    });
    await message.reply(
      playlist ? `Queued playlist **${playlist.title}** (${playlist.tracks.length} tracks).` : `Queued **${track.title}** by ${track.author}.`
    );
  },
  async pause(message) {
    pauseTrack(message.guild.id);
    await message.reply('Paused.');
  },
  async resume(message) {
    resumeTrack(message.guild.id);
    await message.reply('Resumed.');
  },
  async skip(message) {
    const current = skipTrack(message.guild.id);
    await message.reply(`Skipped **${current.title}**.`);
  },
  async stop(message) {
    stopPlayback(message.guild.id);
    await message.reply('Stopped playback and cleared the queue.');
  },
  async queue(message) {
    const queue = listQueue(message.guild.id);
    const upcoming =
      queue.tracks
        .toArray()
        .slice(0, 10)
        .map((t, i) => `${i + 1}. ${t.title} - ${t.author}`)
        .join('\n') || 'Queue is empty.';
    await message.reply(`**Now playing:** ${queue.currentTrack.title}\n\n${upcoming}`);
  },
  async nowplaying(message) {
    const queue = nowPlaying(message.guild.id);
    await message.reply(`**${queue.currentTrack.title}** by ${queue.currentTrack.author}\n${queue.node.createProgressBar()}`);
  },
  async volume(message, args) {
    const level = Number(args);
    setVolume(message.guild.id, level);
    await message.reply(`Volume set to ${level}%.`);
  },
  async shuffle(message) {
    shuffleQueue(message.guild.id);
    await message.reply('Shuffled the queue.');
  },
  async remove(message, args) {
    const position = Number(args);
    const track = removeTrackAt(message.guild.id, position - 1);
    await message.reply(`Removed **${track.title}** from the queue.`);
  },
  async loop(message, args) {
    const mode = (args || '').toLowerCase();
    setLoopMode(message.guild.id, mode);
    await message.reply(`Loop mode set to **${mode}**.`);
  },
};

export default async function messageCreate(message) {
  if (message.author.bot || !message.guild) return;

  const settings = getGuildSettings(message.guild.id);
  const prefix = settings.prefix || '!';
  if (!message.content.startsWith(prefix)) return;

  const withoutPrefix = message.content.slice(prefix.length).trim();
  if (!withoutPrefix) return;

  const [rawName, ...rest] = withoutPrefix.split(/\s+/);
  const name = rawName.toLowerCase();
  const handler = HANDLERS[name];
  if (!handler) return;

  if (CONTROL_COMMANDS.has(name) && !canControl(message.member)) {
    await message.reply("You don't have permission to control playback in this server.");
    return;
  }

  try {
    await handler(message, rest.join(' '));
  } catch (err) {
    const text = err instanceof ActionError ? err.message : 'Something went wrong running that command.';
    if (!(err instanceof ActionError)) {
      console.error(`[bot] error running prefix command "${name}":`, err);
    }
    await message.reply(text);
  }
}
