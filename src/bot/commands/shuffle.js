import { SlashCommandBuilder } from 'discord.js';
import { player } from '../client.js';

export const data = new SlashCommandBuilder().setName('shuffle').setDescription('Shuffle the queue');

export async function execute(interaction) {
  const queue = player.nodes.get(interaction.guild.id);
  if (!queue || queue.tracks.size < 2) {
    await interaction.reply({ content: 'Not enough tracks in the queue to shuffle.', ephemeral: true });
    return;
  }
  queue.tracks.shuffle();
  await interaction.reply('Shuffled the queue.');
}
