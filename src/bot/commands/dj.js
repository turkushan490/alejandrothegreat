import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { updateGuildSettings } from '../../db.js';

export const data = new SlashCommandBuilder()
  .setName('dj')
  .setDescription('Configure who can control music playback and the text-command prefix')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((sub) => sub.setName('everyone').setDescription('Anyone can control playback'))
  .addSubcommand((sub) => sub.setName('managers').setDescription('Only members who can manage the server'))
  .addSubcommand((sub) =>
    sub
      .setName('role')
      .setDescription('Only members with a specific role')
      .addRoleOption((opt) => opt.setName('role').setDescription('The DJ role').setRequired(true))
  )
  .addSubcommand((sub) =>
    sub
      .setName('prefix')
      .setDescription('Set the text-command prefix (e.g. !)')
      .addStringOption((opt) =>
        opt.setName('value').setDescription('New prefix, 1-5 characters').setRequired(true).setMaxLength(5)
      )
  );

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  if (sub === 'everyone') {
    updateGuildSettings(interaction.guild.id, { controlMode: 'everyone', djRoleId: null });
    await interaction.reply('Anyone can now control music playback.');
  } else if (sub === 'managers') {
    updateGuildSettings(interaction.guild.id, { controlMode: 'managers', djRoleId: null });
    await interaction.reply('Only members who can manage the server can now control music playback.');
  } else if (sub === 'role') {
    const role = interaction.options.getRole('role', true);
    updateGuildSettings(interaction.guild.id, { controlMode: 'dj-role', djRoleId: role.id });
    await interaction.reply(`Only members with the **${role.name}** role can now control music playback.`);
  } else if (sub === 'prefix') {
    const value = interaction.options.getString('value', true).trim();
    if (!value) {
      await interaction.reply({ content: 'Prefix cannot be empty.', ephemeral: true });
      return;
    }
    updateGuildSettings(interaction.guild.id, { prefix: value });
    await interaction.reply(`Text-command prefix set to \`${value}\`.`);
  }
}
