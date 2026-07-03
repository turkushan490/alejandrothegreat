import { SlashCommandBuilder } from 'discord.js';
import { pauseTrack } from '../actions.js';

export const data = new SlashCommandBuilder().setName('pause').setDescription('Pause the current track');

export async function execute(interaction) {
  pauseTrack(interaction.guild.id);
  await interaction.reply('Paused.');
}
