import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { listQueue } from '../actions.js';

export const data = new SlashCommandBuilder().setName('queue').setDescription('Show the current queue');

export async function execute(interaction) {
  const queue = listQueue(interaction.guild.id);

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

  await interaction.reply({ embeds: [embed] });
}
