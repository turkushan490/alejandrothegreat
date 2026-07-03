import { SlashCommandBuilder } from 'discord.js';
import { player } from '../client.js';
import { getGuildSettings } from '../../db.js';

export const data = new SlashCommandBuilder()
  .setName('play')
  .setDescription('Play a song or playlist (Spotify link, YouTube link, or search terms)')
  .addStringOption((opt) =>
    opt.setName('query').setDescription('Spotify/YouTube link or search terms').setRequired(true)
  );

export async function execute(interaction) {
  const channel = interaction.member?.voice?.channel;
  if (!channel) {
    await interaction.reply({ content: 'Join a voice channel first.', ephemeral: true });
    return;
  }

  await interaction.deferReply();

  const query = interaction.options.getString('query', true);
  const settings = getGuildSettings(interaction.guild.id);

  try {
    const { track, searchResult } = await player.play(channel, query, {
      nodeOptions: {
        metadata: { channel: interaction.channel },
        volume: settings.defaultVolume,
        leaveOnEmpty: true,
        leaveOnEmptyCooldown: 300_000,
        leaveOnEnd: true,
        leaveOnEndCooldown: 300_000,
      },
    });

    if (searchResult?.playlist) {
      await interaction.editReply(
        `Queued playlist **${searchResult.playlist.title}** (${searchResult.tracks.length} tracks).`
      );
    } else {
      await interaction.editReply(`Queued **${track.title}** by ${track.author}.`);
    }
  } catch (err) {
    console.error('[bot] play command failed:', err);
    await interaction.editReply("Couldn't find or play that. Try a different link or search term.");
  }
}
