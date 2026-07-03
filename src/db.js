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

  CREATE TABLE IF NOT EXISTS bots (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    discord_token TEXT NOT NULL,
    discord_client_id TEXT NOT NULL,
    discord_client_secret TEXT NOT NULL,
    discord_redirect_uri TEXT NOT NULL,
    spotify_client_id TEXT,
    spotify_client_secret TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS app_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    session_secret TEXT NOT NULL,
    admin_password_hash TEXT
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

// --- bots (each is an independent Discord application/token, configured via the setup wizard) ---

function rowToBot(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    discordToken: row.discord_token,
    discordClientId: row.discord_client_id,
    discordClientSecret: row.discord_client_secret,
    discordRedirectUri: row.discord_redirect_uri,
    spotifyClientId: row.spotify_client_id,
    spotifyClientSecret: row.spotify_client_secret,
    enabled: Boolean(row.enabled),
    createdAt: row.created_at,
  };
}

const listBotsStmt = db.prepare('SELECT * FROM bots ORDER BY created_at ASC, rowid ASC');
const getBotStmt = db.prepare('SELECT * FROM bots WHERE id = ?');
const insertBotStmt = db.prepare(`
  INSERT INTO bots (
    id, name, discord_token, discord_client_id, discord_client_secret, discord_redirect_uri,
    spotify_client_id, spotify_client_secret, enabled
  ) VALUES (
    @id, @name, @discordToken, @discordClientId, @discordClientSecret, @discordRedirectUri,
    @spotifyClientId, @spotifyClientSecret, @enabled
  )
`);
const updateBotStmt = db.prepare(`
  UPDATE bots SET
    name = @name,
    discord_token = @discordToken,
    discord_client_id = @discordClientId,
    discord_client_secret = @discordClientSecret,
    discord_redirect_uri = @discordRedirectUri,
    spotify_client_id = @spotifyClientId,
    spotify_client_secret = @spotifyClientSecret,
    enabled = @enabled
  WHERE id = @id
`);
const deleteBotStmt = db.prepare('DELETE FROM bots WHERE id = ?');

export function listBots() {
  return listBotsStmt.all().map(rowToBot);
}

export function getBot(id) {
  return rowToBot(getBotStmt.get(id));
}

export function createBot(data) {
  const id = crypto.randomUUID();
  insertBotStmt.run({
    id,
    name: data.name,
    discordToken: data.discordToken,
    discordClientId: data.discordClientId,
    discordClientSecret: data.discordClientSecret,
    discordRedirectUri: data.discordRedirectUri,
    spotifyClientId: data.spotifyClientId || '',
    spotifyClientSecret: data.spotifyClientSecret || '',
    enabled: data.enabled === false ? 0 : 1,
  });
  return getBot(id);
}

export function updateBot(id, patch) {
  const current = getBot(id);
  if (!current) throw new Error('Bot not found');
  const next = { ...current, ...patch, id };
  updateBotStmt.run({ ...next, enabled: next.enabled ? 1 : 0 });
  return getBot(id);
}

export function deleteBot(id) {
  deleteBotStmt.run(id);
}

// The first bot ever added is used as the Discord application for web
// dashboard login (OAuth needs exactly one client_id/secret pair) -
// every configured bot still shows up in the dashboard once logged in.
export function getPrimaryBot() {
  const bots = listBots();
  return bots[0] || null;
}

// --- app-level config: session secret (auto-generated) + admin password ---

function ensureAppConfig() {
  const row = db.prepare('SELECT * FROM app_config WHERE id = 1').get();
  if (row) return row;
  const secret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO app_config (id, session_secret, admin_password_hash) VALUES (1, ?, NULL)').run(secret);
  return db.prepare('SELECT * FROM app_config WHERE id = 1').get();
}

export const sessionSecret = ensureAppConfig().session_secret;

export function getAdminPasswordHash() {
  return db.prepare('SELECT admin_password_hash FROM app_config WHERE id = 1').get()?.admin_password_hash || null;
}

export function setAdminPasswordHash(hash) {
  db.prepare('UPDATE app_config SET admin_password_hash = ? WHERE id = 1').run(hash);
}

export function isAppConfigured() {
  return Boolean(getAdminPasswordHash()) && listBots().length > 0;
}

export default db;
