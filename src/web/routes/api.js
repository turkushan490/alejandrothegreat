import { PermissionFlagsBits } from 'discord.js';
import { Router } from 'express';
import { client, player } from '../../bot/client.js';
import { canControl } from '../../bot/permissions.js';
import { buildQueueSnapshot } from '../../bot/queueState.js';
import { getGuildSettings, updateGuildSettings } from '../../db.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const apiRouter = Router();

apiRouter.use(requireAuth);

apiRouter.get('/guilds', (req, res) => {
  const userGuilds = req.session.guilds || [];
  const shared = userGuilds
    .filter((g) => client.guilds.cache.has(g.id))
    .map((g) => {
      const guild = client.guilds.cache.get(g.id);
      const queue = player.nodes.get(g.id);
      return {
        id: g.id,
        name: g.name,
        icon: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png` : null,
        memberCount: guild.memberCount,
        playing: Boolean(queue?.currentTrack),
      };
    });
  res.json({ guilds: shared });
});

async function loadMember(req, res, next) {
  const { guildId } = req.params;
  const guild = client.guilds.cache.get(guildId);
  const isMember = (req.session.guilds || []).some((g) => g.id === guildId);
  if (!guild || !isMember) {
    res.status(404).json({ error: 'Server not found' });
    return;
  }
  try {
    req.discordGuild = guild;
    req.discordMember = await guild.members.fetch(req.session.user.id);
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

apiRouter.get('/guilds/:guildId', loadMember, (req, res) => {
  const queue = player.nodes.get(req.params.guildId);
  res.json({
    ...buildQueueSnapshot(queue),
    canControl: canControl(req.discordMember),
    settings: getGuildSettings(req.params.guildId),
  });
});

apiRouter.get('/guilds/:guildId/search', loadMember, async (req, res) => {
  const query = String(req.query.q || '').trim();
  if (!query) {
    res.json({ results: [] });
    return;
  }
  try {
    const searchResult = await player.search(query, { requestedBy: req.session.user.id });
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

apiRouter.post('/guilds/:guildId/play', loadMember, requireControl, async (req, res) => {
  const query = String(req.body.query || '').trim();
  const voiceChannel = req.discordMember.voice.channel;
  if (!query) {
    res.status(400).json({ error: 'Missing query.' });
    return;
  }
  if (!voiceChannel) {
    res.status(400).json({ error: 'Join a voice channel in Discord first.' });
    return;
  }
  const settings = getGuildSettings(req.params.guildId);
  try {
    await player.play(voiceChannel, query, {
      nodeOptions: {
        metadata: { channel: voiceChannel },
        volume: settings.defaultVolume,
        leaveOnEmpty: true,
        leaveOnEmptyCooldown: 300_000,
        leaveOnEnd: true,
        leaveOnEndCooldown: 300_000,
      },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('[web] play failed:', err);
    res.status(500).json({ error: "Couldn't find or play that." });
  }
});

apiRouter.post('/guilds/:guildId/pause', loadMember, requireControl, (req, res) => {
  const queue = player.nodes.get(req.params.guildId);
  if (!queue) {
    res.status(400).json({ error: 'Nothing is playing.' });
    return;
  }
  queue.node.setPaused(true);
  res.json({ ok: true });
});

apiRouter.post('/guilds/:guildId/resume', loadMember, requireControl, (req, res) => {
  const queue = player.nodes.get(req.params.guildId);
  if (!queue) {
    res.status(400).json({ error: 'Nothing is playing.' });
    return;
  }
  queue.node.setPaused(false);
  res.json({ ok: true });
});

apiRouter.post('/guilds/:guildId/skip', loadMember, requireControl, (req, res) => {
  const queue = player.nodes.get(req.params.guildId);
  if (!queue || !queue.currentTrack) {
    res.status(400).json({ error: 'Nothing is playing.' });
    return;
  }
  queue.node.skip();
  res.json({ ok: true });
});

apiRouter.post('/guilds/:guildId/stop', loadMember, requireControl, (req, res) => {
  const queue = player.nodes.get(req.params.guildId);
  if (!queue) {
    res.status(400).json({ error: 'Nothing is playing.' });
    return;
  }
  queue.delete();
  res.json({ ok: true });
});

apiRouter.post('/guilds/:guildId/volume', loadMember, requireControl, (req, res) => {
  const level = Number(req.body.level);
  if (!Number.isInteger(level) || level < 0 || level > 100) {
    res.status(400).json({ error: 'Volume must be 0-100.' });
    return;
  }
  const queue = player.nodes.get(req.params.guildId);
  if (!queue) {
    res.status(400).json({ error: 'Nothing is playing.' });
    return;
  }
  queue.node.setVolume(level);
  res.json({ ok: true });
});

apiRouter.post('/guilds/:guildId/shuffle', loadMember, requireControl, (req, res) => {
  const queue = player.nodes.get(req.params.guildId);
  if (!queue || queue.tracks.size < 2) {
    res.status(400).json({ error: 'Not enough tracks to shuffle.' });
    return;
  }
  queue.tracks.shuffle();
  res.json({ ok: true });
});

apiRouter.post('/guilds/:guildId/remove', loadMember, requireControl, (req, res) => {
  const queue = player.nodes.get(req.params.guildId);
  const index = Number(req.body.index);
  const track = queue?.tracks.at(index);
  if (!track) {
    res.status(400).json({ error: 'No track at that position.' });
    return;
  }
  queue.removeTrack(track);
  res.json({ ok: true });
});

apiRouter.post('/guilds/:guildId/loop', loadMember, requireControl, (req, res) => {
  const queue = player.nodes.get(req.params.guildId);
  if (!queue) {
    res.status(400).json({ error: 'Nothing is playing.' });
    return;
  }
  const modeMap = { off: 0, track: 1, queue: 2 };
  const mode = modeMap[req.body.mode];
  if (mode === undefined) {
    res.status(400).json({ error: 'Invalid loop mode.' });
    return;
  }
  queue.setRepeatMode(mode);
  res.json({ ok: true });
});

apiRouter.post('/guilds/:guildId/settings', loadMember, (req, res) => {
  if (!req.discordMember.permissions.has(PermissionFlagsBits.ManageGuild)) {
    res.status(403).json({ error: 'Only server managers can change this setting.' });
    return;
  }
  const { controlMode, djRoleId } = req.body;
  if (!['everyone', 'managers', 'dj-role'].includes(controlMode)) {
    res.status(400).json({ error: 'Invalid control mode.' });
    return;
  }
  const settings = updateGuildSettings(req.params.guildId, { controlMode, djRoleId: djRoleId || null });
  res.json({ settings });
});
