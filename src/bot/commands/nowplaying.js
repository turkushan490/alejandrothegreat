import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { nowPlaying } from '../actions.js';

export const data = new SlashCommandBuilder().setName('nowplaying').setDescription('Show the current track');

export async function execute(interaction) {
  const queue = nowPlaying(interaction.guild.id);
  const track = queue.currentTrack;
  const embed = new EmbedBuilder()
    .setColor(0x58a6ff)
    .setAuthor({ name: '🎶 Now serving, darling' })
    .setTitle(track.title)
    .setURL(track.url || null)
    .setDescription(`by **${track.author}** 💖\n\n${queue.node.createProgressBar()}`)
    .setThumbnail(track.thumbnail || null);
  await interaction.reply({ embeds: [embed] });
}
