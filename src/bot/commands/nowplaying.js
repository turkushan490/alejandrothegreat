import { SlashCommandBuilder } from 'discord.js';
import { player } from '../client.js';

export const data = new SlashCommandBuilder().setName('nowplaying').setDescription('Show the current track');

export async function execute(interaction) {
  const queue = player.nodes.get(interaction.guild.id);
  if (!queue || !queue.currentTrack) {
    await interaction.reply({ content: 'Nothing is playing.', ephemeral: true });
    return;
  }
  const track = queue.currentTrack;
  const progress = queue.node.createProgressBar();
  await interaction.reply(`**${track.title}** by ${track.author}\n${progress}`);
}
