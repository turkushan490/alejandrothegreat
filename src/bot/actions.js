import { QueueRepeatMode } from 'discord-player';
import { getGuildSettings } from '../db.js';
import { findInstanceForGuild } from './manager.js';

// Thrown for expected, user-facing failures ("nothing is playing", bad
// input, etc). Slash commands, prefix commands, and the web API all catch
// this the same way and show err.message directly instead of a generic error.
export class ActionError extends Error {}

// Multiple bot instances can be running at once - find whichever one is
// actually a member of this guild rather than assuming a single global bot.
function requirePlayer(guildId) {
  const instance = findInstanceForGuild(guildId);
  if (!instance) throw new ActionError('🥺 None of my bots are in this server right now.');
  return instance.player;
}

function requireQueue(guildId) {
  const queue = requirePlayer(guildId).nodes.get(guildId);
  if (!queue || !queue.currentTrack) throw new ActionError("🙊 Nothing's playing — go queue something. 😏");
  return queue;
}

export async function playTrack({ guildId, voiceChannel, textChannel, query, requestedBy }) {
  if (!voiceChannel) throw new ActionError("🎧 Hop in a voice channel first — I'm not singing to an empty room. 😌");
  if (!query) throw new ActionError('🔎 Give me something to play — a name, a link, anything. ✨');

  const settings = getGuildSettings(guildId);
  const player = requirePlayer(guildId);

  const { track, searchResult } = await player.play(voiceChannel, query, {
    requestedBy,
    nodeOptions: {
      metadata: { channel: textChannel },
      volume: settings.defaultVolume,
      leaveOnEmpty: true,
      leaveOnEmptyCooldown: 300_000,
      leaveOnEnd: true,
      leaveOnEndCooldown: 300_000,
    },
  });

  return { track, playlist: searchResult?.playlist || null };
}

export function pauseTrack(guildId) {
  requireQueue(guildId).node.setPaused(true);
}

export function resumeTrack(guildId) {
  requireQueue(guildId).node.setPaused(false);
}

export function skipTrack(guildId) {
  const queue = requireQueue(guildId);
  const current = queue.currentTrack;
  queue.node.skip();
  return current;
}

export function stopPlayback(guildId) {
  const queue = requirePlayer(guildId).nodes.get(guildId);
  if (!queue) throw new ActionError("🙊 Nothing's playing right now. 😏");
  queue.delete();
}

export function setVolume(guildId, level) {
  if (!Number.isInteger(level) || level < 0 || level > 100) {
    throw new ActionError('🔊 Volume has to be between 0 and 100. 😎');
  }
  requireQueue(guildId).node.setVolume(level);
}

export function shuffleQueue(guildId) {
  const queue = requirePlayer(guildId).nodes.get(guildId);
  if (!queue || queue.tracks.size < 2) {
    throw new ActionError('🔀 Need at least two tracks to shuffle — add more bops. 🎶');
  }
  queue.tracks.shuffle();
}

export function removeTrackAt(guildId, index) {
  const queue = requirePlayer(guildId).nodes.get(guildId);
  const track = queue?.tracks.at(index);
  if (!track) throw new ActionError("🤷 There's no track at that spot. 😏");
  queue.removeTrack(track);
  return track;
}

const LOOP_MODES = { off: QueueRepeatMode.OFF, track: QueueRepeatMode.TRACK, queue: QueueRepeatMode.QUEUE };

export function setLoopMode(guildId, mode) {
  const queue = requireQueue(guildId);
  if (!(mode in LOOP_MODES)) throw new ActionError('🔁 Loop mode must be off, track, or queue. ✨');
  queue.setRepeatMode(LOOP_MODES[mode]);
}

export function listQueue(guildId) {
  return requireQueue(guildId);
}

export function nowPlaying(guildId) {
  return requireQueue(guildId);
}
