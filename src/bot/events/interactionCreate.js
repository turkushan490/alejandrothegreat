import { ActionError } from '../actions.js';
import { flair } from '../flair.js';
import { canControl } from '../permissions.js';

// Commands that change playback and are subject to the guild's control-mode setting.
// /dj is intentionally excluded here since it's gated by Discord's own
// ManageGuild permission requirement on the command itself.
const CONTROL_COMMANDS = new Set([
  'play', 'pause', 'resume', 'skip', 'stop', 'volume', 'shuffle', 'remove', 'loop',
]);

export default async function interactionCreate(interaction) {
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
