import { SlashCommandBuilder } from 'discord.js';
import { QueueRepeatMode } from 'discord-player';
import { player } from '../client.js';

const MODE_MAP = {
  off: QueueRepeatMode.OFF,
  track: QueueRepeatMode.TRACK,
  queue: QueueRepeatMode.QUEUE,
};

export const data = new SlashCommandBuilder()
  .setName('loop')
  .setDescription('Set the loop mode')
  .addStringOption((opt) =>
    opt
      .setName('mode')
      .setDescription('Loop mode')
      .setRequired(true)
      .addChoices(
        { name: 'Off', value: 'off' },
        { name: 'Track', value: 'track' },
        { name: 'Queue', value: 'queue' }
      )
  );

export async function execute(interaction) {
  const queue = player.nodes.get(interaction.guild.id);
  if (!queue) {
    await interaction.reply({ content: 'Nothing is playing.', ephemeral: true });
    return;
  }
  const mode = interaction.options.getString('mode', true);
  queue.setRepeatMode(MODE_MAP[mode]);
  await interaction.reply(`Loop mode set to **${mode}**.`);
}
