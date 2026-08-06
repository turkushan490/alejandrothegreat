import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits } from 'discord.js';

const ACCENT = 0x58a6ff;
const UPDATE_MS = 12000;

// One live "now playing" message per guild that we keep editing with the
// current progress + buttons, instead of spamming a new message each song.
// We cache the Message object itself so periodic updates edit it directly
// without an extra fetch each tick (halves the background REST traffic that
// was competing with slash-command replies).
const sessions = new Map(); // guildId -> { channelId, message, timer }

// Finds a text channel the bot can post in, for web-initiated plays (which
// have no originating chat channel) and for action announcements.
export function resolveAnnounceChannel(guild) {
  const me = guild.members.me;
  const canSend = (ch) =>
    ch && ch.isTextBased?.() && ch.viewable && ch.permissionsFor(me)?.has(PermissionFlagsBits.SendMessages);
  if (canSend(guild.systemChannel)) return guild.systemChannel;
  return guild.channels.cache.find((ch) => canSend(ch)) || null;
}

const LOOP_LABEL = ['', '🔂 Track', '🔁 Queue'];

function buildEmbed(queue) {
  const t = queue.currentTrack;
  // Timecoded bar mirrors the web card: "01:23 ┃━━━🔘────┃ 05:12".
  let bar = '';
  try {
    bar = queue.node.createProgressBar({ length: 16, timecodes: true }) || '';
  } catch {
    /* live streams have no progress bar */
  }
  const paused = queue.node.isPaused();
  const loop = LOOP_LABEL[queue.repeatMode] || '';
  const footerBits = [
    `${queue.tracks.size} in queue`,
    `vol ${queue.node.volume}%`,
    loop,
    t.requestedBy ? `added by ${t.requestedBy.username}` : '',
  ].filter(Boolean);

  return new EmbedBuilder()
    .setColor(ACCENT)
    .setAuthor({ name: paused ? '⏸ Paused' : '🎶 Now playing' })
    .setTitle(t.title)
    .setURL(t.url || null)
    .setDescription(`by **${t.author || 'unknown'}**${bar ? `\n\n${bar}` : ''}`)
    // Big album art (like the web card), not the little corner thumbnail.
    .setImage(t.thumbnail || null)
    .setFooter({ text: footerBits.join(' · ') });
}

function buildButtons(paused) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('np_pauseresume')
      .setEmoji(paused ? '▶️' : '⏸️')
      .setStyle(paused ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('np_skip').setEmoji('⏭️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('np_shuffle').setEmoji('🔀').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('np_loop').setEmoji('🔁').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('np_stop').setEmoji('⏹️').setStyle(ButtonStyle.Danger)
  );
}

// Called on each track start. Edits the cached live message in place if we
// still have one, otherwise posts a fresh one and starts the update timer.
export async function startNowPlaying(queue) {
  const guildId = queue.guild.id;
  const channel = queue.metadata?.channel || resolveAnnounceChannel(queue.guild);
  if (!channel?.send) return;

  const payload = { embeds: [buildEmbed(queue)], components: [buildButtons(queue.node.isPaused())] };
  const existing = sessions.get(guildId);

  if (existing?.message) {
    try {
      await existing.message.edit(payload);
      existing.channelId = channel.id;
      return;
    } catch {
      clearInterval(existing.timer);
      sessions.delete(guildId);
    }
  }

  try {
    const message = await channel.send(payload);
    const timer = setInterval(() => {
      updateNowPlaying(guildId).catch(() => {});
    }, UPDATE_MS);
    timer.unref?.();
    sessions.set(guildId, { channelId: channel.id, message, timer });
  } catch {
    /* posting is best-effort */
  }
}

// Refreshes the cached live message's progress bar / pause state. Edits the
// cached Message directly - no fetch. Needs the player instance, so it looks
// the queue up via the manager.
export async function updateNowPlaying(guildId) {
  const session = sessions.get(guildId);
  if (!session?.message) return;
  const { findInstanceForGuild } = await import('./manager.js');
  const instance = findInstanceForGuild(guildId);
  const queue = instance?.player.nodes.get(guildId);
  if (!queue || !queue.currentTrack) return;
  try {
    await session.message.edit({ embeds: [buildEmbed(queue)], components: [buildButtons(queue.node.isPaused())] });
  } catch {
    /* message may have been deleted - drop the session so we re-post next song */
    clearInterval(session.timer);
    sessions.delete(guildId);
  }
}

// Called when playback ends: stop the timer and strip the buttons off the
// final message so it can't be clicked into a dead queue.
export async function teardownNowPlaying(guild) {
  const session = sessions.get(guild.id);
  if (!session) return;
  clearInterval(session.timer);
  sessions.delete(guild.id);
  if (session.message) {
    const embed = EmbedBuilder.from(session.message.embeds[0] || {}).setColor(0x6e7681).setAuthor({ name: '⏹ Playback ended' });
    await session.message.edit({ embeds: [embed], components: [] }).catch(() => {});
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
