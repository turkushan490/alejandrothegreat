import { SlashCommandBuilder } from 'discord.js';
import { setLoopMode } from '../actions.js';
import { flair } from '../flair.js';

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
  const mode = interaction.options.getString('mode', true);
  setLoopMode(interaction.guild.id, mode);
  await interaction.reply(flair.loopSet(mode));
}
