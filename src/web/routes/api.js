import { PermissionFlagsBits } from 'discord.js';
import { Router } from 'express';
import {
  ActionError,
  pauseTrack,
  playTrack,
  removeTrackAt,
  resumeTrack,
  setLoopMode,
  setVolume,
  shuffleQueue,
  skipTrack,
  stopPlayback,
} from '../../bot/actions.js';
import { findInstanceForGuild, getAllInstances } from '../../bot/manager.js';
import { canControl } from '../../bot/permissions.js';
import { buildQueueSnapshot } from '../../bot/queueState.js';
import { getBot, getGuildSettings, updateGuildSettings } from '../../db.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const apiRouter = Router();

apiRouter.use(requireAuth);

apiRouter.get('/guilds', (req, res) => {
  const userGuilds = req.session.guilds || [];
  const shared = [];

  for (const { botId, client, player } of getAllInstances()) {
    const bot = getBot(botId);
    for (const g of userGuilds) {
      if (!client.guilds.cache.has(g.id)) continue;
      const guild = client.guilds.cache.get(g.id);
      const queue = player.nodes.get(g.id);
      shared.push({
        id: g.id,
        name: g.name,
        icon: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png` : null,
        memberCount: guild.memberCount,
        playing: Boolean(queue?.currentTrack),
        nowPlaying: queue?.currentTrack ? `${queue.currentTrack.title}` : null,
        botName: bot?.name || 'Bot',
      });
    }
  }

  res.json({ guilds: shared });
});

async function loadMember(req, res, next) {
  const { guildId } = req.params;
  const instance = findInstanceForGuild(guildId);
  const isMember = (req.session.guilds || []).some((g) => g.id === guildId);
  if (!instance || !isMember) {
    res.status(404).json({ error: 'Server not found' });
    return;
  }
  try {
    req.botInstance = instance;
    req.discordGuild = instance.client.guilds.cache.get(guildId);
    req.discordMember = await req.discordGuild.members.fetch(req.session.user.id);
    next();
  } catch {
    res.status(404).json({ error: 'You are not a member of that server' });
  }
}

function requireControl(req, res, next) {
  if (!canControl(req.discordMember)) {
    res.status(403).json({ error: "You don't have permission to control playback in this server." });
    return;
  }
  next();
}

function handleAction(fn) {
  return async (req, res) => {
    try {
      // Await so async actions (play) surface their errors here, and don't
      // return the raw result - discord-player Track/Queue objects have
      // circular references that crash res.json(). The dashboard updates
      // itself from the socket state push, not this response.
      await fn(req);
      res.json({ ok: true });
    } catch (err) {
      if (err instanceof ActionError) {
        res.status(400).json({ error: err.message });
        return;
      }
      console.error('[web] action failed:', err);
      res.status(500).json({ error: 'Something went wrong.' });
    }
  };
}

apiRouter.get('/guilds/:guildId', loadMember, (req, res) => {
  const queue = req.botInstance.player.nodes.get(req.params.guildId);
  res.json({
    ...buildQueueSnapshot(queue),
    canControl: canControl(req.discordMember),
    isManager: req.discordMember.permissions.has(PermissionFlagsBits.ManageGuild),
    settings: getGuildSettings(req.params.guildId),
    botName: getBot(req.botInstance.botId)?.name || 'Bot',
  });
});

apiRouter.get('/guilds/:guildId/roles', loadMember, (req, res) => {
  const roles = req.discordGuild.roles.cache
    .filter((r) => r.id !== req.discordGuild.id)
    .map((r) => ({ id: r.id, name: r.name, color: r.hexColor }))
    .sort((a, b) => a.name.localeCompare(b.name));
  res.json({ roles });
});

apiRouter.get('/guilds/:guildId/search', loadMember, async (req, res) => {
  const query = String(req.query.q || '').trim();
  if (!query) {
    res.json({ results: [] });
    return;
  }
  try {
    const searchResult = await req.botInstance.player.search(query, { requestedBy: req.discordMember.user });
    res.json({
      results: searchResult.tracks.slice(0, 10).map((t) => ({
        title: t.title,
        author: t.author,
        url: t.url,
        duration: t.duration,
        thumbnail: t.thumbnail,
      })),
    });
  } catch (err) {
    console.error('[web] search failed:', err);
    res.status(500).json({ error: 'Search failed.' });
  }
});

apiRouter.post(
  '/guilds/:guildId/play',
  loadMember,
  requireControl,
  handleAction((req) => {
    const query = String(req.body.query || '').trim();
    const voiceChannel = req.discordMember.voice.channel;
    if (!voiceChannel) throw new ActionError('Join a voice channel in Discord first.');
    return playTrack({
      guildId: req.params.guildId,
      voiceChannel,
      textChannel: null,
      query,
      requestedBy: req.discordMember.user,
    });
  })
);

apiRouter.post(
  '/guilds/:guildId/pause',
  loadMember,
  requireControl,
  handleAction((req) => pauseTrack(req.params.guildId))
);

apiRouter.post(
  '/guilds/:guildId/resume',
  loadMember,
  requireControl,
  handleAction((req) => resumeTrack(req.params.guildId))
);

apiRouter.post(
  '/guilds/:guildId/skip',
  loadMember,
  requireControl,
  handleAction((req) => skipTrack(req.params.guildId))
);

apiRouter.post(
  '/guilds/:guildId/stop',
  loadMember,
  requireControl,
  handleAction((req) => stopPlayback(req.params.guildId))
);

apiRouter.post(
  '/guilds/:guildId/volume',
  loadMember,
  requireControl,
  handleAction((req) => setVolume(req.params.guildId, Number(req.body.level)))
);

apiRouter.post(
  '/guilds/:guildId/shuffle',
  loadMember,
  requireControl,
  handleAction((req) => shuffleQueue(req.params.guildId))
);

apiRouter.post(
  '/guilds/:guildId/remove',
  loadMember,
  requireControl,
  handleAction((req) => removeTrackAt(req.params.guildId, Number(req.body.index)))
);

apiRouter.post(
  '/guilds/:guildId/loop',
  loadMember,
  requireControl,
  handleAction((req) => setLoopMode(req.params.guildId, req.body.mode))
);

apiRouter.post('/guilds/:guildId/settings', loadMember, (req, res) => {
  if (!req.discordMember.permissions.has(PermissionFlagsBits.ManageGuild)) {
    res.status(403).json({ error: 'Only server managers can change this setting.' });
    return;
  }
  const { controlMode, djRoleId, prefix } = req.body;
  if (!['everyone', 'managers', 'dj-role'].includes(controlMode)) {
    res.status(400).json({ error: 'Invalid control mode.' });
    return;
  }
  const trimmedPrefix = String(prefix || '!').trim().slice(0, 5);
  if (!trimmedPrefix) {
    res.status(400).json({ error: 'Prefix cannot be empty.' });
    return;
  }
  const settings = updateGuildSettings(req.params.guildId, {
    controlMode,
    djRoleId: djRoleId || null,
    prefix: trimmedPrefix,
  });
  res.json({ settings });
});
