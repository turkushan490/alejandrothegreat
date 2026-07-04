import { SlashCommandBuilder } from 'discord.js';
import { clearQueue } from '../actions.js';
import { flair } from '../flair.js';

export const data = new SlashCommandBuilder()
  .setName('clear')
  .setDescription('Clear the queue (keeps the current track playing)');

export async function execute(interaction) {
  const count = clearQueue(interaction.guild.id);
  await interaction.reply(flair.cleared(count));
}
