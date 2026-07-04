import { SlashCommandBuilder } from 'discord.js';
import { stopPlayback } from '../actions.js';
import { flair } from '../flair.js';

export const data = new SlashCommandBuilder().setName('stop').setDescription('Stop playback and clear the queue');

export async function execute(interaction) {
  stopPlayback(interaction.guild.id);
  await interaction.reply(flair.stopped());
}
