import { SlashCommandBuilder } from 'discord.js';
import { player } from '../client.js';

export const data = new SlashCommandBuilder().setName('pause').setDescription('Pause the current track');

export async function execute(interaction) {
  const queue = player.nodes.get(interaction.guild.id);
  if (!queue || !queue.currentTrack) {
    await interaction.reply({ content: 'Nothing is playing.', ephemeral: true });
    return;
  }
  queue.node.setPaused(true);
  await interaction.reply('Paused.');
}
