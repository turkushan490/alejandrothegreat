import crypto from 'node:crypto';
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
    default_volume INTEGER NOT NULL DEFAULT 100,
    prefix TEXT NOT NULL DEFAULT '!'
  );

  CREATE TABLE IF NOT EXISTS bot_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    discord_token TEXT,
    discord_client_id TEXT,
    discord_client_secret TEXT,
    discord_redirect_uri TEXT,
    spotify_client_id TEXT,
    spotify_client_secret TEXT,
    admin_password_hash TEXT
  );

  CREATE TABLE IF NOT EXISTS app_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    session_secret TEXT NOT NULL
  );
`);

// --- guild settings ---

const GUILD_DEFAULTS = { controlMode: 'everyone', djRoleId: null, defaultVolume: 100, prefix: '!' };

const selectGuildStmt = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?');
const upsertGuildStmt = db.prepare(`
  INSERT INTO guild_settings (guild_id, control_mode, dj_role_id, default_volume, prefix)
  VALUES (@guildId, @controlMode, @djRoleId, @defaultVolume, @prefix)
  ON CONFLICT(guild_id) DO UPDATE SET
    control_mode = excluded.control_mode,
    dj_role_id = excluded.dj_role_id,
    default_volume = excluded.default_volume,
    prefix = excluded.prefix
`);

export function getGuildSettings(guildId) {
  const row = selectGuildStmt.get(guildId);
  if (!row) return { guildId, ...GUILD_DEFAULTS };
  return {
    guildId: row.guild_id,
    controlMode: row.control_mode,
    djRoleId: row.dj_role_id,
    defaultVolume: row.default_volume,
    prefix: row.prefix,
  };
}

export function updateGuildSettings(guildId, patch) {
  const current = getGuildSettings(guildId);
  const next = { ...current, ...patch, guildId };
  upsertGuildStmt.run(next);
  return next;
}

export function findGuildByPrefix(prefix) {
  return db.prepare('SELECT guild_id FROM guild_settings WHERE prefix = ?').all(prefix);
}

// --- bot config (Discord/Spotify credentials, set via the setup wizard) ---

const selectBotConfigStmt = db.prepare('SELECT * FROM bot_config WHERE id = 1');
const upsertBotConfigStmt = db.prepare(`
  INSERT INTO bot_config (
    id, discord_token, discord_client_id, discord_client_secret, discord_redirect_uri,
    spotify_client_id, spotify_client_secret, admin_password_hash
  ) VALUES (
    1, @discordToken, @discordClientId, @discordClientSecret, @discordRedirectUri,
    @spotifyClientId, @spotifyClientSecret, @adminPasswordHash
  )
  ON CONFLICT(id) DO UPDATE SET
    discord_token = excluded.discord_token,
    discord_client_id = excluded.discord_client_id,
    discord_client_secret = excluded.discord_client_secret,
    discord_redirect_uri = excluded.discord_redirect_uri,
    spotify_client_id = excluded.spotify_client_id,
    spotify_client_secret = excluded.spotify_client_secret,
    admin_password_hash = excluded.admin_password_hash
`);

export function getBotConfig() {
  const row = selectBotConfigStmt.get();
  if (!row) return null;
  return {
    discordToken: row.discord_token,
    discordClientId: row.discord_client_id,
    discordClientSecret: row.discord_client_secret,
    discordRedirectUri: row.discord_redirect_uri,
    spotifyClientId: row.spotify_client_id,
    spotifyClientSecret: row.spotify_client_secret,
    adminPasswordHash: row.admin_password_hash,
  };
}

export function isBotConfigured() {
  const cfg = getBotConfig();
  return Boolean(cfg?.discordToken && cfg?.adminPasswordHash);
}

export function saveBotConfig(patch) {
  const current = getBotConfig() || {};
  const next = { ...current, ...patch };
  upsertBotConfigStmt.run(next);
  return next;
}

// --- app-level session secret (auto-generated once, persisted) ---

function ensureSessionSecret() {
  const row = db.prepare('SELECT session_secret FROM app_config WHERE id = 1').get();
  if (row) return row.session_secret;
  const secret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO app_config (id, session_secret) VALUES (1, ?)').run(secret);
  return secret;
}

export const sessionSecret = ensureSessionSecret();

export default db;
