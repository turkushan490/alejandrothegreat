import { SlashCommandBuilder } from 'discord.js';
import { ActionError, playTrack } from '../actions.js';
import { flair } from '../flair.js';

export const data = new SlashCommandBuilder()
  .setName('play')
  .setDescription('Play a song or playlist (Spotify link, YouTube link, or search terms)')
  .addStringOption((opt) =>
    opt.setName('query').setDescription('Spotify/YouTube link or search terms').setRequired(true)
  );

export async function execute(interaction) {
  const voiceChannel = interaction.member?.voice?.channel;
  if (!voiceChannel) {
    await interaction.reply({ content: flair.joinVoiceFirst(), ephemeral: true });
    return;
  }

  await interaction.deferReply();
  const query = interaction.options.getString('query', true);

  try {
    const { track, playlist } = await playTrack({
      guildId: interaction.guild.id,
      voiceChannel,
      textChannel: interaction.channel,
      query,
      requestedBy: interaction.user,
    });
    await interaction.editReply(
      playlist ? flair.queuedPlaylist(playlist.title, playlist.tracks.length) : flair.queued(track.title, track.author)
    );
  } catch (err) {
    console.error('[bot] play command failed:', err);
    await interaction.editReply(err instanceof ActionError ? err.message : flair.couldntPlay());
  }
}
