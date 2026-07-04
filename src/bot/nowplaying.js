import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits } from 'discord.js';

const ACCENT = 0x58a6ff;
const UPDATE_MS = 7000;

// One live "now playing" message per guild that we keep editing with the
// current progress + buttons, instead of spamming a new message each song.
const sessions = new Map(); // guildId -> { channelId, messageId, timer }

// Finds a text channel the bot can post in, for web-initiated plays (which
// have no originating chat channel) and for action announcements.
export function resolveAnnounceChannel(guild) {
  const me = guild.members.me;
  const canSend = (ch) =>
    ch && ch.isTextBased?.() && ch.viewable && ch.permissionsFor(me)?.has(PermissionFlagsBits.SendMessages);
  if (canSend(guild.systemChannel)) return guild.systemChannel;
  return guild.channels.cache.find((ch) => canSend(ch)) || null;
}

function buildEmbed(queue) {
  const t = queue.currentTrack;
  let bar = '';
  try {
    bar = queue.node.createProgressBar({ length: 18 }) || '';
  } catch {
    /* live streams have no progress bar */
  }
  const paused = queue.node.isPaused();
  return new EmbedBuilder()
    .setColor(ACCENT)
    .setAuthor({ name: paused ? '⏸ Paused' : '🎶 Now playing' })
    .setTitle(t.title)
    .setURL(t.url || null)
    .setDescription(`by **${t.author || 'unknown'}**${bar ? `\n\n${bar}` : ''}`)
    .setThumbnail(t.thumbnail || null)
    .setFooter({
      text: `${queue.tracks.size} in queue · vol ${queue.node.volume}%${t.requestedBy ? ` · added by ${t.requestedBy.username}` : ''}`,
    });
}

function buildButtons(paused) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('np_pauseresume')
      .setEmoji(paused ? '▶️' : '⏸️')
      .setStyle(paused ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('np_skip').setEmoji('⏭️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('np_shuffle').setEmoji('🔀').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('np_stop').setEmoji('⏹️').setStyle(ButtonStyle.Danger)
  );
}

async function fetchSessionMessage(guild, session) {
  const channel = guild.channels.cache.get(session.channelId);
  if (!channel) return null;
  return channel.messages.fetch(session.messageId).catch(() => null);
}

// Called on each track start. Edits the existing live message in place if we
// still have one, otherwise posts a fresh one and starts the update timer.
export async function startNowPlaying(queue) {
  const guildId = queue.guild.id;
  const channel = queue.metadata?.channel || resolveAnnounceChannel(queue.guild);
  if (!channel?.send) return;

  const payload = { embeds: [buildEmbed(queue)], components: [buildButtons(queue.node.isPaused())] };
  const existing = sessions.get(guildId);

  if (existing) {
    const msg = await fetchSessionMessage(queue.guild, existing);
    if (msg) {
      await msg.edit(payload).catch(() => {});
      existing.channelId = channel.id;
      return;
    }
    clearInterval(existing.timer);
    sessions.delete(guildId);
  }

  try {
    const msg = await channel.send(payload);
    const timer = setInterval(() => {
      updateNowPlaying(guildId).catch(() => {});
    }, UPDATE_MS);
    timer.unref?.();
    sessions.set(guildId, { channelId: channel.id, messageId: msg.id, timer });
  } catch {
    /* posting is best-effort */
  }
}

// Refreshes the live message's progress bar / pause state. Needs the player
// instance, so it looks the queue up via the manager.
export async function updateNowPlaying(guildId) {
  const session = sessions.get(guildId);
  if (!session) return;
  const { findInstanceForGuild } = await import('./manager.js');
  const instance = findInstanceForGuild(guildId);
  const queue = instance?.player.nodes.get(guildId);
  if (!queue || !queue.currentTrack) return;
  const guild = instance.client.guilds.cache.get(guildId);
  const msg = await fetchSessionMessage(guild, session);
  if (!msg) return;
  await msg.edit({ embeds: [buildEmbed(queue)], components: [buildButtons(queue.node.isPaused())] }).catch(() => {});
}

// Called when playback ends: stop the timer and strip the buttons off the
// final message so it can't be clicked into a dead queue.
export async function teardownNowPlaying(guild) {
  const session = sessions.get(guild.id);
  if (!session) return;
  clearInterval(session.timer);
  sessions.delete(guild.id);
  const msg = await fetchSessionMessage(guild, session);
  if (msg) {
    const embed = EmbedBuilder.from(msg.embeds[0] || {}).setColor(0x6e7681).setAuthor({ name: '⏹ Playback ended' });
    await msg.edit({ embeds: [embed], components: [] }).catch(() => {});
  }
}

// Posts a short one-line announcement ("X skipped", etc) into the live
// message's channel, or a resolved channel if there's no session yet.
export async function announce(guild, text) {
  const session = sessions.get(guild.id);
  const channel = (session && guild.channels.cache.get(session.channelId)) || resolveAnnounceChannel(guild);
  if (!channel?.send) return;
  await channel.send(text).catch(() => {});
}
