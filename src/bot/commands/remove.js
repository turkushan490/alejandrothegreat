import { SlashCommandBuilder } from 'discord.js';
import { player } from '../client.js';

export const data = new SlashCommandBuilder()
  .setName('remove')
  .setDescription('Remove a track from the queue')
  .addIntegerOption((opt) =>
    opt.setName('position').setDescription('Queue position to remove (1 = next up)').setRequired(true).setMinValue(1)
  );

export async function execute(interaction) {
  const queue = player.nodes.get(interaction.guild.id);
  const position = interaction.options.getInteger('position', true);
  const index = position - 1;
  const track = queue?.tracks.at(index);

  if (!track) {
    await interaction.reply({ content: 'No track at that position.', ephemeral: true });
    return;
  }

  queue.removeTrack(track);
  await interaction.reply(`Removed **${track.title}** from the queue.`);
}
