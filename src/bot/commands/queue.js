import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { listQueue } from '../actions.js';

export const data = new SlashCommandBuilder().setName('queue').setDescription('Show the current queue');

export async function execute(interaction) {
  const queue = listQueue(interaction.guild.id);

  const upcoming =
    queue.tracks
      .toArray()
      .slice(0, 10)
      .map((t, i) => `${i + 1}. ${t.title} - ${t.author}`)
      .join('\n') || 'Queue is empty.';

  const embed = new EmbedBuilder()
    .setTitle('Queue')
    .setDescription(`**Now playing:** ${queue.currentTrack.title}\n\n${upcoming}`);

  await interaction.reply({ embeds: [embed] });
}
