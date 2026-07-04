import { EmbedBuilder } from 'discord.js';
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
import { flair } from '../flair.js';
import { canControl } from '../permissions.js';

const CONTROL_COMMANDS = new Set([
  'play', 'pause', 'resume', 'skip', 'stop', 'volume', 'shuffle', 'remove', 'loop',
]);

const HANDLERS = {
  async play(message, args) {
    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel) {
      await message.reply(flair.joinVoiceFirst());
      return;
    }
    if (!args) {
      await message.reply('🔎 Give me something to play, darling — `<prefix>play <song, link, or search>`! ✨');
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
      playlist ? flair.queuedPlaylist(playlist.title, playlist.tracks.length) : flair.queued(track.title, track.author)
    );
  },
  async pause(message) {
    pauseTrack(message.guild.id);
    await message.reply(flair.paused());
  },
  async resume(message) {
    resumeTrack(message.guild.id);
    await message.reply(flair.resumed());
  },
  async skip(message) {
    const current = skipTrack(message.guild.id);
    await message.reply(flair.skipped(current.title));
  },
  async stop(message) {
    stopPlayback(message.guild.id);
    await message.reply(flair.stopped());
  },
  async queue(message) {
    const queue = listQueue(message.guild.id);
    const upcoming =
      queue.tracks
        .toArray()
        .slice(0, 10)
        .map((t, i) => `\`${i + 1}.\` ${t.title} — *${t.author}*`)
        .join('\n') || '✨ Nothing lined up yet — add more bops, honey! 🎶';
    const embed = new EmbedBuilder()
      .setColor(0x58a6ff)
      .setAuthor({ name: '💅 The lineup, darling' })
      .setDescription(`🎶 **Now playing:** ${queue.currentTrack.title}\n\n${upcoming}`)
      .setThumbnail(queue.currentTrack.thumbnail || null);
    await message.reply({ embeds: [embed] });
  },
  async nowplaying(message) {
    const queue = nowPlaying(message.guild.id);
    const track = queue.currentTrack;
    const embed = new EmbedBuilder()
      .setColor(0x58a6ff)
      .setAuthor({ name: '🎶 Now serving, darling' })
      .setTitle(track.title)
      .setURL(track.url || null)
      .setDescription(`by **${track.author}** 💖\n\n${queue.node.createProgressBar()}`)
      .setThumbnail(track.thumbnail || null);
    await message.reply({ embeds: [embed] });
  },
  async volume(message, args) {
    const level = Number(args);
    setVolume(message.guild.id, level);
    await message.reply(flair.volumeSet(level));
  },
  async shuffle(message) {
    shuffleQueue(message.guild.id);
    await message.reply(flair.shuffled());
  },
  async remove(message, args) {
    const position = Number(args);
    const track = removeTrackAt(message.guild.id, position - 1);
    await message.reply(flair.removed(track.title));
  },
  async loop(message, args) {
    const mode = (args || '').toLowerCase();
    setLoopMode(message.guild.id, mode);
    await message.reply(flair.loopSet(mode));
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
    await message.reply(flair.noPermission());
    return;
  }

  try {
    await handler(message, rest.join(' '));
  } catch (err) {
    const text = err instanceof ActionError ? err.message : flair.genericError();
    if (!(err instanceof ActionError)) {
      console.error(`[bot] error running prefix command "${name}":`, err);
    }
    await message.reply(text);
  }
}
