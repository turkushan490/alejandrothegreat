import { PermissionFlagsBits, PermissionsBitField } from 'discord.js';
import { Router } from 'express';
import { startBot } from '../../bot/manager.js';
import { envDefaults } from '../../config.js';
import { getBotConfig, isBotConfigured, saveBotConfig } from '../../db.js';
import { hashPassword, verifyPassword } from '../adminAuth.js';

export const setupRouter = Router();

function requireAdmin(req, res, next) {
  if (!req.session.isAdmin) {
    res.status(403).json({ error: 'Admin login required.' });
    return;
  }
  next();
}

// Discord client IDs (and every other Discord object ID) are numeric
// snowflakes. Catching a value like "root" here means we never reach
// Discord's OAuth endpoint with obviously-wrong data - that only ever
// produced a cryptic error page.
function validateBotConfig({ discordClientId, discordClientSecret, discordToken, discordRedirectUri, spotifyClientId, spotifyClientSecret }) {
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

setupRouter.get('/status', (req, res) => {
  const cfg = getBotConfig();
  res.json({
    configured: isBotConfigured(),
    isAdmin: Boolean(req.session.isAdmin),
    discordClientId: cfg?.discordClientId || '',
  });
});

setupRouter.get('/defaults', (req, res) => {
  res.json({
    discordClientId: envDefaults.discordClientId,
    discordRedirectUri: envDefaults.discordRedirectUri || `${req.protocol}://${req.get('host')}/auth/discord/callback`,
    spotifyClientId: envDefaults.spotifyClientId,
  });
});

setupRouter.get('/config', requireAdmin, (req, res) => {
  const cfg = getBotConfig() || {};
  res.json({
    discordToken: cfg.discordToken || '',
    discordClientId: cfg.discordClientId || '',
    discordClientSecret: cfg.discordClientSecret || '',
    discordRedirectUri: cfg.discordRedirectUri || '',
    spotifyClientId: cfg.spotifyClientId || '',
    spotifyClientSecret: cfg.spotifyClientSecret || '',
  });
});

setupRouter.post('/login', (req, res) => {
  const cfg = getBotConfig();
  if (!cfg?.adminPasswordHash) {
    res.status(400).json({ error: 'Not set up yet.' });
    return;
  }
  if (!verifyPassword(req.body.password, cfg.adminPasswordHash)) {
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

setupRouter.post('/save', async (req, res) => {
  const cfg = getBotConfig();
  const firstRun = !cfg?.adminPasswordHash;

  if (!firstRun && !req.session.isAdmin) {
    res.status(403).json({ error: 'Admin login required.' });
    return;
  }

  const {
    discordToken,
    discordClientId,
    discordClientSecret,
    discordRedirectUri,
    spotifyClientId,
    spotifyClientSecret,
    adminPassword,
  } = req.body;

  if (!discordToken || !discordClientId || !discordClientSecret || !discordRedirectUri) {
    res.status(400).json({ error: 'Discord bot token, client ID, client secret, and redirect URI are all required.' });
    return;
  }

  const validationError = validateBotConfig({
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

  if (firstRun && !adminPassword) {
    res.status(400).json({ error: 'Choose an admin password to protect these settings.' });
    return;
  }

  saveBotConfig({
    discordToken,
    discordClientId,
    discordClientSecret,
    discordRedirectUri,
    spotifyClientId: spotifyClientId || '',
    spotifyClientSecret: spotifyClientSecret || '',
    adminPasswordHash: adminPassword ? hashPassword(adminPassword) : cfg.adminPasswordHash,
  });
  req.session.isAdmin = true;

  try {
    await startBot();
    res.json({ ok: true });
  } catch (err) {
    console.error('[setup] saved config but failed to start the bot:', err);
    res.status(500).json({ error: `Saved, but the bot failed to log in: ${err.message}` });
  }
});

setupRouter.get('/invite-link', (req, res) => {
  const cfg = getBotConfig();
  if (!cfg?.discordClientId) {
    res.status(400).json({ error: 'Bot not configured yet.' });
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

  const url = `https://discord.com/oauth2/authorize?client_id=${cfg.discordClientId}&scope=${encodeURIComponent('bot applications.commands')}&permissions=${permissions}`;
  res.json({ url });
});
