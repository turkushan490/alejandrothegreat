import { SlashCommandBuilder } from 'discord.js';
import { resumeTrack } from '../actions.js';
import { flair } from '../flair.js';

export const data = new SlashCommandBuilder().setName('resume').setDescription('Resume playback');

export async function execute(interaction) {
  resumeTrack(interaction.guild.id);
  await interaction.reply(flair.resumed());
}
