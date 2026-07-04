import { ActionError, pauseTrack, resumeTrack, setLoopMode, shuffleQueue, skipTrack, stopPlayback } from '../actions.js';
import { flair } from '../flair.js';
import { announce, updateNowPlaying } from '../nowplaying.js';
import { canControl } from '../permissions.js';

// Commands that change playback and are subject to the guild's control-mode setting.
// /dj is intentionally excluded here since it's gated by Discord's own
// ManageGuild permission requirement on the command itself.
const CONTROL_COMMANDS = new Set([
  'play', 'pause', 'resume', 'skip', 'stop', 'volume', 'shuffle', 'remove', 'loop', 'clear',
]);

// Handlers for the buttons under the persistent now-playing message.
async function handleNowPlayingButton(interaction) {
  if (!canControl(interaction.member)) {
    await interaction.reply({ content: flair.noPermission(), ephemeral: true });
    return;
  }

  const guildId = interaction.guild.id;
  const who = interaction.member?.displayName || interaction.user.username;

  try {
    switch (interaction.customId) {
      case 'np_pauseresume': {
        const { findInstanceForGuild } = await import('../manager.js');
        const q = findInstanceForGuild(guildId)?.player.nodes.get(guildId);
        if (q?.node.isPaused()) {
          resumeTrack(guildId);
          await announce(interaction.guild, `▶️ **${who}** hit resume.`);
        } else {
          pauseTrack(guildId);
          await announce(interaction.guild, `⏸️ **${who}** paused it.`);
        }
        break;
      }
      case 'np_skip': {
        const track = skipTrack(guildId);
        await announce(interaction.guild, `⏭️ **${who}** skipped **${track.title}**.`);
        break;
      }
      case 'np_shuffle': {
        shuffleQueue(guildId);
        await announce(interaction.guild, `🔀 **${who}** shuffled the queue.`);
        break;
      }
      case 'np_loop': {
        const { findInstanceForGuild } = await import('../manager.js');
        const q = findInstanceForGuild(guildId)?.player.nodes.get(guildId);
        const cur = q?.repeatMode ?? 0;
        const next = cur === 0 ? 'track' : cur === 1 ? 'queue' : 'off';
        setLoopMode(guildId, next);
        await announce(interaction.guild, `🔁 **${who}** set loop to **${next}**.`);
        break;
      }
      case 'np_stop': {
        stopPlayback(guildId);
        await announce(interaction.guild, `⏹️ **${who}** stopped the music.`);
        break;
      }
      default:
        break;
    }
    await interaction.deferUpdate().catch(() => {});
    updateNowPlaying(guildId).catch(() => {});
  } catch (err) {
    const message = err instanceof ActionError ? err.message : flair.genericError();
    if (!(err instanceof ActionError)) console.error('[bot] now-playing button error:', err);
    await interaction.reply({ content: message, ephemeral: true }).catch(() => {});
  }
}

export default async function interactionCreate(interaction) {
  if (interaction.isButton() && interaction.customId?.startsWith('np_')) {
    if (!interaction.guild) return;
    await handleNowPlayingButton(interaction);
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const command = interaction.client.commands.get(interaction.commandName);
  if (!command) return;

  if (!interaction.guild) {
    await interaction.reply({ content: flair.serverOnly(), ephemeral: true });
    return;
  }

  if (CONTROL_COMMANDS.has(interaction.commandName) && !canControl(interaction.member)) {
    await interaction.reply({ content: flair.noPermission(), ephemeral: true });
    return;
  }

  try {
    await command.execute(interaction);
  } catch (err) {
    const message = err instanceof ActionError ? err.message : flair.genericError();
    if (!(err instanceof ActionError)) {
      console.error(`[bot] error running /${interaction.commandName}:`, err);
    }
    const payload = { content: message, ephemeral: true };
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(payload);
    } else {
      await interaction.reply(payload);
    }
  }
}
