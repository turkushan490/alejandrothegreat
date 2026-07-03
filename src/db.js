import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from './config.js';

fs.mkdirSync(config.dataDir, { recursive: true });

const db = new Database(path.join(config.dataDir, 'alejandrothegreat.sqlite'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS guild_settings (
    guild_id TEXT PRIMARY KEY,
    control_mode TEXT NOT NULL DEFAULT 'everyone', -- 'everyone' | 'managers' | 'dj-role'
    dj_role_id TEXT,
    default_volume INTEGER NOT NULL DEFAULT 100
  );
`);

const DEFAULTS = { controlMode: 'everyone', djRoleId: null, defaultVolume: 100 };

const selectStmt = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?');
const upsertStmt = db.prepare(`
  INSERT INTO guild_settings (guild_id, control_mode, dj_role_id, default_volume)
  VALUES (@guildId, @controlMode, @djRoleId, @defaultVolume)
  ON CONFLICT(guild_id) DO UPDATE SET
    control_mode = excluded.control_mode,
    dj_role_id = excluded.dj_role_id,
    default_volume = excluded.default_volume
`);

export function getGuildSettings(guildId) {
  const row = selectStmt.get(guildId);
  if (!row) return { guildId, ...DEFAULTS };
  return {
    guildId: row.guild_id,
    controlMode: row.control_mode,
    djRoleId: row.dj_role_id,
    defaultVolume: row.default_volume,
  };
}

export function updateGuildSettings(guildId, patch) {
  const current = getGuildSettings(guildId);
  const next = { ...current, ...patch, guildId };
  upsertStmt.run(next);
  return next;
}

export default db;
