import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { updateGuildSettings } from '../../db.js';

export const data = new SlashCommandBuilder()
  .setName('dj')
  .setDescription('Configure who can control music playback')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((sub) => sub.setName('everyone').setDescription('Anyone can control playback'))
  .addSubcommand((sub) => sub.setName('managers').setDescription('Only members who can manage the server'))
  .addSubcommand((sub) =>
    sub
      .setName('role')
      .setDescription('Only members with a specific role')
      .addRoleOption((opt) => opt.setName('role').setDescription('The DJ role').setRequired(true))
  );

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  if (sub === 'everyone') {
    updateGuildSettings(interaction.guild.id, { controlMode: 'everyone', djRoleId: null });
    await interaction.reply('✅ Anyone can now control the music. 🎶');
  } else if (sub === 'managers') {
    updateGuildSettings(interaction.guild.id, { controlMode: 'managers', djRoleId: null });
    await interaction.reply('🔒 Only server managers can control the music now.');
  } else if (sub === 'role') {
    const role = interaction.options.getRole('role', true);
    updateGuildSettings(interaction.guild.id, { controlMode: 'dj-role', djRoleId: role.id });
    await interaction.reply(`🎧 Only members with the **${role.name}** role can control the music now.`);
  }
}
