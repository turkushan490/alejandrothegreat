import { SlashCommandBuilder } from 'discord.js';
import { player } from '../client.js';

export const data = new SlashCommandBuilder()
  .setName('volume')
  .setDescription('Set the playback volume')
  .addIntegerOption((opt) =>
    opt.setName('level').setDescription('0-100').setRequired(true).setMinValue(0).setMaxValue(100)
  );

export async function execute(interaction) {
  const queue = player.nodes.get(interaction.guild.id);
  if (!queue) {
    await interaction.reply({ content: 'Nothing is playing.', ephemeral: true });
    return;
  }
  const level = interaction.options.getInteger('level', true);
  queue.node.setVolume(level);
  await interaction.reply(`Volume set to ${level}%.`);
}
