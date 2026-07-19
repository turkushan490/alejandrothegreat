import { PermissionFlagsBits, PermissionsBitField } from 'discord.js';
import { Router } from 'express';
import { restartBotInstance, startBotInstance, stopBotInstance } from '../../bot/manager.js';
import { envDefaults } from '../../config.js';
import {
  addAdmin,
  createBot,
  deleteBot,
  getAdminPasswordHash,
  getBot,
  getYoutubeCookie,
  isAppConfigured,
  isDiscordAdmin,
  listAdmins,
  listBots,
  removeAdmin,
  setAdminPasswordHash,
  setYoutubeCookie,
  updateBot,
} from '../../db.js';
import { ensureCookieFile } from '../../bot/ytStream.js';
import { hashPassword, verifyPassword } from '../adminAuth.js';
import { redirectUriFromRequest } from '../oauth.js';

export const setupRouter = Router();

// Admin = the password-authenticated owner OR a signed-in Discord user the
// owner has granted admin rights to.
function isAdminUser(req) {
  if (req.session.isAdmin) return true;
  if (req.session.user && isDiscordAdmin(req.session.user.id)) return true;
  return false;
}

function requireAdmin(req, res, next) {
  if (!isAdminUser(req)) {
    res.status(403).json({ error: 'Admin access required.' });
    return;
  }
  next();
}

// Discord client IDs (and every other Discord object ID) are numeric
// snowflakes. Catching a value like "root" here means we never reach
// Discord's OAuth endpoint with obviously-wrong data.
function validateBotFields({ discordClientId, discordClientSecret, discordToken, discordRedirectUri, spotifyClientId, spotifyClientSecret }) {
  if (!/^\d{17,20}$/.test(discordClientId)) {
    return 'Discord Client ID must be the numeric ID from the Discord Developer Portal (17-20 digits), not an application name or anything else.';
  }
  if (discordClientSecret.length < 16) {
    return 'Discord Client Secret looks too short - copy it again from OAuth2 -> General in the Discord Developer Portal.';
  }
  if (!discordToken.includes('.') || discordToken.length < 50) {
    return "Discord Bot Token doesn't look like a real token - copy it again from the Bot tab in the Discord Developer Portal (it's long and contains dots).";
  }
  try {
    const url = new URL(discordRedirectUri);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('bad protocol');
  } catch {
    return 'Redirect URI must be a full URL, e.g. http://192.168.1.100:3005/auth/discord/callback';
  }
  if (spotifyClientId && !/^[a-zA-Z0-9]{16,40}$/.test(spotifyClientId)) {
    return 'Spotify Client ID looks wrong - copy it again from the Spotify Developer Dashboard.';
  }
  if (spotifyClientSecret && !/^[a-zA-Z0-9]{16,40}$/.test(spotifyClientSecret)) {
    return 'Spotify Client Secret looks wrong - copy it again from the Spotify Developer Dashboard.';
  }
  return null;
}

function botSummary(bot, isPrimary) {
  return {
    id: bot.id,
    name: bot.name,
    discordClientId: bot.discordClientId,
    hasSpotify: Boolean(bot.spotifyClientId),
    enabled: bot.enabled,
    isPrimary,
  };
}

setupRouter.get('/status', (req, res) => {
  res.json({
    configured: isAppConfigured(),
    isAdmin: isAdminUser(req),
    signedIn: Boolean(req.session.user),
    redirectUri: redirectUriFromRequest(req),
  });
});

setupRouter.get('/defaults', (req, res) => {
  res.json({
    discordClientId: envDefaults.discordClientId,
    discordRedirectUri: envDefaults.discordRedirectUri || `${req.protocol}://${req.get('host')}/auth/discord/callback`,
    spotifyClientId: envDefaults.spotifyClientId,
  });
});

setupRouter.post('/login', (req, res) => {
  const hash = getAdminPasswordHash();
  if (!hash) {
    res.status(400).json({ error: 'Not set up yet.' });
    return;
  }
  if (!verifyPassword(req.body.password, hash)) {
    res.status(401).json({ error: 'Wrong password.' });
    return;
  }
  req.session.isAdmin = true;
  res.json({ ok: true });
});

setupRouter.post('/logout', (req, res) => {
  req.session.isAdmin = false;
  res.json({ ok: true });
});

setupRouter.post('/admin-password', requireAdmin, (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) {
    res.status(400).json({ error: 'Choose a password at least 8 characters long.' });
    return;
  }
  setAdminPasswordHash(hashPassword(newPassword));
  res.json({ ok: true });
});

// --- bots ---

setupRouter.get('/bots', requireAdmin, (req, res) => {
  const bots = listBots();
  res.json({ bots: bots.map((b, i) => botSummary(b, i === 0)) });
});

setupRouter.get('/bots/:id', requireAdmin, (req, res) => {
  const bot = getBot(req.params.id);
  if (!bot) {
    res.status(404).json({ error: 'Bot not found.' });
    return;
  }
  res.json({ bot });
});

setupRouter.post('/bots', async (req, res) => {
  const existingBots = listBots();
  const firstEver = existingBots.length === 0 && !getAdminPasswordHash();

  if (!firstEver && !isAdminUser(req)) {
    res.status(403).json({ error: 'Admin access required.' });
    return;
  }

  const { name, discordToken, discordClientId, discordClientSecret, discordRedirectUri, spotifyClientId, spotifyClientSecret, adminPassword } = req.body;

  if (!discordToken || !discordClientId || !discordClientSecret || !discordRedirectUri) {
    res.status(400).json({ error: 'Discord bot token, client ID, client secret, and redirect URI are all required.' });
    return;
  }

  const validationError = validateBotFields({
    discordClientId,
    discordClientSecret,
    discordToken,
    discordRedirectUri,
    spotifyClientId: spotifyClientId || '',
    spotifyClientSecret: spotifyClientSecret || '',
  });
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }

  if (firstEver && !adminPassword) {
    res.status(400).json({ error: 'Choose an admin password to protect these settings.' });
    return;
  }

  const bot = createBot({
    name: (name || '').trim() || `Bot ${existingBots.length + 1}`,
    discordToken,
    discordClientId,
    discordClientSecret,
    discordRedirectUri,
    spotifyClientId: spotifyClientId || '',
    spotifyClientSecret: spotifyClientSecret || '',
    enabled: true,
  });

  if (firstEver) {
    setAdminPasswordHash(hashPassword(adminPassword));
  }
  req.session.isAdmin = true;

  try {
    await startBotInstance(bot.id);
    res.json({ ok: true, bot: botSummary(bot, existingBots.length === 0) });
  } catch (err) {
    console.error(`[setup] bot "${bot.name}" saved but failed to start:`, err);
    res.status(500).json({ error: `Saved, but the bot failed to log in: ${err.message}` });
  }
});

setupRouter.put('/bots/:id', requireAdmin, async (req, res) => {
  const existing = getBot(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Bot not found.' });
    return;
  }

  const { name, discordToken, discordClientId, discordClientSecret, discordRedirectUri, spotifyClientId, spotifyClientSecret } = req.body;

  if (!discordToken || !discordClientId || !discordClientSecret || !discordRedirectUri) {
    res.status(400).json({ error: 'Discord bot token, client ID, client secret, and redirect URI are all required.' });
    return;
  }

  const validationError = validateBotFields({
    discordClientId,
    discordClientSecret,
    discordToken,
    discordRedirectUri,
    spotifyClientId: spotifyClientId || '',
    spotifyClientSecret: spotifyClientSecret || '',
  });
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }

  const bot = updateBot(req.params.id, {
    name: (name || '').trim() || existing.name,
    discordToken,
    discordClientId,
    discordClientSecret,
    discordRedirectUri,
    spotifyClientId: spotifyClientId || '',
    spotifyClientSecret: spotifyClientSecret || '',
  });

  try {
    if (bot.enabled) await restartBotInstance(bot.id);
    res.json({ ok: true });
  } catch (err) {
    console.error(`[setup] bot "${bot.name}" updated but failed to restart:`, err);
    res.status(500).json({ error: `Saved, but the bot failed to log in: ${err.message}` });
  }
});

setupRouter.post('/bots/:id/toggle', requireAdmin, async (req, res) => {
  const bot = getBot(req.params.id);
  if (!bot) {
    res.status(404).json({ error: 'Bot not found.' });
    return;
  }
  const nextEnabled = !bot.enabled;
  updateBot(bot.id, { enabled: nextEnabled });

  try {
    if (nextEnabled) {
      await startBotInstance(bot.id);
    } else {
      await stopBotInstance(bot.id);
    }
    res.json({ ok: true, enabled: nextEnabled });
  } catch (err) {
    console.error(`[setup] failed to toggle bot "${bot.name}":`, err);
    res.status(500).json({ error: err.message });
  }
});

setupRouter.delete('/bots/:id', requireAdmin, async (req, res) => {
  const bot = getBot(req.params.id);
  if (!bot) {
    res.status(404).json({ error: 'Bot not found.' });
    return;
  }
  await stopBotInstance(bot.id);
  deleteBot(bot.id);
  res.json({ ok: true });
});

setupRouter.get('/bots/:id/invite-link', requireAdmin, (req, res) => {
  const bot = getBot(req.params.id);
  if (!bot) {
    res.status(404).json({ error: 'Bot not found.' });
    return;
  }
  const permissions = new PermissionsBitField([
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.EmbedLinks,
    PermissionFlagsBits.Connect,
    PermissionFlagsBits.Speak,
    PermissionFlagsBits.UseApplicationCommands,
  ]).bitfield.toString();

  const url = `https://discord.com/oauth2/authorize?client_id=${bot.discordClientId}&scope=${encodeURIComponent('bot applications.commands')}&permissions=${permissions}`;
  res.json({ url });
});

// --- admins (Discord accounts the owner grants bot-management rights to) ---

setupRouter.get('/admins', requireAdmin, (req, res) => {
  res.json({ admins: listAdmins() });
});

setupRouter.post('/admins', requireAdmin, (req, res) => {
  const discordUserId = String(req.body.discordUserId || '').trim();
  const name = String(req.body.name || '').trim();
  if (!/^\d{17,20}$/.test(discordUserId)) {
    res.status(400).json({ error: 'Enter a valid Discord user ID (the long number, 17-20 digits). Turn on Developer Mode in Discord, right-click a user, Copy User ID.' });
    return;
  }
  const admin = addAdmin(discordUserId, name);
  res.json({ ok: true, admin });
});

setupRouter.delete('/admins/:id', requireAdmin, (req, res) => {
  removeAdmin(req.params.id);
  res.json({ ok: true });
});

// --- YouTube cookie (authenticates yt-dlp against YouTube's bot-blocking) ---

setupRouter.get('/youtube-cookie', requireAdmin, (req, res) => {
  const cookie = getYoutubeCookie();
  res.json({ configured: Boolean(cookie), preview: cookie ? `${cookie.trim().split('\n').length} lines saved` : '' });
});

setupRouter.post('/youtube-cookie', requireAdmin, (req, res) => {
  const text = String(req.body.cookie ?? '');
  const trimmed = text.trim();
  if (trimmed && !/# Netscape HTTP Cookie File|\.youtube\.com/i.test(trimmed)) {
    res.status(400).json({ error: "That doesn't look like a YouTube cookies.txt file (Netscape format). Export it with a 'Get cookies.txt' browser extension while on youtube.com." });
    return;
  }
  setYoutubeCookie(trimmed || null);
  ensureCookieFile(); // rewrite the file now so it takes effect on the next stream
  res.json({ ok: true, configured: Boolean(trimmed) });
});
