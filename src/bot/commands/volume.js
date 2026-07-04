import { SlashCommandBuilder } from 'discord.js';
import { setVolume } from '../actions.js';
import { flair } from '../flair.js';

export const data = new SlashCommandBuilder()
  .setName('volume')
  .setDescription('Set the playback volume')
  .addIntegerOption((opt) =>
    opt.setName('level').setDescription('0-100').setRequired(true).setMinValue(0).setMaxValue(100)
  );

export async function execute(interaction) {
  const level = interaction.options.getInteger('level', true);
  setVolume(interaction.guild.id, level);
  await interaction.reply(flair.volumeSet(level));
}
