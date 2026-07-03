import { PermissionsBitField } from 'discord.js';
import { getGuildSettings } from '../db.js';

// Members who can manage the server always retain control, regardless of
// the guild's configured control mode (they're the ones who set the mode).
export function canControl(member) {
  if (!member) return false;
  if (member.permissions.has(PermissionsBitField.Flags.ManageGuild)) return true;

  const settings = getGuildSettings(member.guild.id);
  switch (settings.controlMode) {
    case 'everyone':
      return true;
    case 'dj-role':
      return settings.djRoleId ? member.roles.cache.has(settings.djRoleId) : false;
    case 'managers':
      return false; // already covered by the ManageGuild check above
    default:
      return false;
  }
}
