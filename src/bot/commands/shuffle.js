import { SlashCommandBuilder } from 'discord.js';
import { shuffleQueue } from '../actions.js';
import { flair } from '../flair.js';

export const data = new SlashCommandBuilder().setName('shuffle').setDescription('Shuffle the queue');

export async function execute(interaction) {
  shuffleQueue(interaction.guild.id);
  await interaction.reply(flair.shuffled());
}
