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
