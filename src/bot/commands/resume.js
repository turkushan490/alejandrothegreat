import { SlashCommandBuilder } from 'discord.js';
import { resumeTrack } from '../actions.js';

export const data = new SlashCommandBuilder().setName('resume').setDescription('Resume playback');

export async function execute(interaction) {
  resumeTrack(interaction.guild.id);
  await interaction.reply('Resumed.');
}
