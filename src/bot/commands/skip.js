import { SlashCommandBuilder } from 'discord.js';
import { player } from '../client.js';

export const data = new SlashCommandBuilder().setName('skip').setDescription('Skip the current track');

export async function execute(interaction) {
  const queue = player.nodes.get(interaction.guild.id);
  if (!queue || !queue.currentTrack) {
    await interaction.reply({ content: 'Nothing is playing.', ephemeral: true });
    return;
  }
  const current = queue.currentTrack;
  queue.node.skip();
  await interaction.reply(`Skipped **${current.title}**.`);
}
