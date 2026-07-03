import { SlashCommandBuilder } from 'discord.js';
import { player } from '../client.js';

export const data = new SlashCommandBuilder().setName('stop').setDescription('Stop playback and clear the queue');

export async function execute(interaction) {
  const queue = player.nodes.get(interaction.guild.id);
  if (!queue) {
    await interaction.reply({ content: 'Nothing is playing.', ephemeral: true });
    return;
  }
  queue.delete();
  await interaction.reply('Stopped playback and cleared the queue.');
}
