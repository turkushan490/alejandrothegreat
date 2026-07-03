import { SlashCommandBuilder } from 'discord.js';
import { shuffleQueue } from '../actions.js';

export const data = new SlashCommandBuilder().setName('shuffle').setDescription('Shuffle the queue');

export async function execute(interaction) {
  shuffleQueue(interaction.guild.id);
  await interaction.reply('Shuffled the queue.');
}
