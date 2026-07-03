import { SlashCommandBuilder } from 'discord.js';
import { skipTrack } from '../actions.js';

export const data = new SlashCommandBuilder().setName('skip').setDescription('Skip the current track');

export async function execute(interaction) {
  const current = skipTrack(interaction.guild.id);
  await interaction.reply(`Skipped **${current.title}**.`);
}
