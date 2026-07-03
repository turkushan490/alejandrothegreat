import { SlashCommandBuilder } from 'discord.js';
import { nowPlaying } from '../actions.js';

export const data = new SlashCommandBuilder().setName('nowplaying').setDescription('Show the current track');

export async function execute(interaction) {
  const queue = nowPlaying(interaction.guild.id);
  const progress = queue.node.createProgressBar();
  await interaction.reply(`**${queue.currentTrack.title}** by ${queue.currentTrack.author}\n${progress}`);
}
