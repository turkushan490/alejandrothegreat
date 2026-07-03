import { SlashCommandBuilder } from 'discord.js';
import { removeTrackAt } from '../actions.js';

export const data = new SlashCommandBuilder()
  .setName('remove')
  .setDescription('Remove a track from the queue')
  .addIntegerOption((opt) =>
    opt.setName('position').setDescription('Queue position to remove (1 = next up)').setRequired(true).setMinValue(1)
  );

export async function execute(interaction) {
  const position = interaction.options.getInteger('position', true);
  const track = removeTrackAt(interaction.guild.id, position - 1);
  await interaction.reply(`Removed **${track.title}** from the queue.`);
}
