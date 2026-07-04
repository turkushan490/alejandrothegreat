import { PermissionFlagsBits } from 'discord.js';
import { Router } from 'express';
import {
  ActionError,
  clearQueue,
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
import { announce, resolveAnnounceChannel } from '../../bot/nowplaying.js';
import { canControl } from '../../bot/permissions.js';
import { buildQueueSnapshot } from '../../bot/queueState.js';
import { getBot, getGuildSettings, updateGuildSettings } from '../../db.js';
import { requireAuth } from '../middleware/requireAuth.js';

// Posts "X did Y (via dashboard)" into the guild's chat so people in Discord
// see who's driving from the web.
function announceWeb(req, text) {
  const who = req.discordMember?.displayName || req.session.user?.username || 'Someone';
  announce(req.discordGuild, `${text} · **${who}** (via dashboard)`).catch(() => {});
}

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
  handleAction(async (req) => {
    const query = String(req.body.query || '').trim();
    const voiceChannel = req.discordMember.voice.channel;
    if (!voiceChannel) throw new ActionError('Join a voice channel in Discord first.');
    const { track, playlist } = await playTrack({
      guildId: req.params.guildId,
      voiceChannel,
      // Web plays have no originating chat channel, so give the now-playing
      // message + announcements somewhere sensible to live.
      textChannel: resolveAnnounceChannel(req.discordGuild),
      query,
      requestedBy: req.discordMember.user,
    });
    const label = playlist ? `playlist **${playlist.title}**` : `**${track.title}**`;
    announceWeb(req, `➕ Added ${label}`);
  })
);

apiRouter.post(
  '/guilds/:guildId/pause',
  loadMember,
  requireControl,
  handleAction((req) => {
    pauseTrack(req.params.guildId);
    announceWeb(req, '⏸️ Paused');
  })
);

apiRouter.post(
  '/guilds/:guildId/resume',
  loadMember,
  requireControl,
  handleAction((req) => {
    resumeTrack(req.params.guildId);
    announceWeb(req, '▶️ Resumed');
  })
);

apiRouter.post(
  '/guilds/:guildId/skip',
  loadMember,
  requireControl,
  handleAction((req) => {
    const track = skipTrack(req.params.guildId);
    announceWeb(req, `⏭️ Skipped **${track.title}**`);
  })
);

apiRouter.post(
  '/guilds/:guildId/stop',
  loadMember,
  requireControl,
  handleAction((req) => {
    stopPlayback(req.params.guildId);
    announceWeb(req, '⏹️ Stopped the music');
  })
);

apiRouter.post(
  '/guilds/:guildId/volume',
  loadMember,
  requireControl,
  handleAction((req) => {
    const level = Number(req.body.level);
    setVolume(req.params.guildId, level);
    announceWeb(req, `🔊 Set volume to ${level}%`);
  })
);

apiRouter.post(
  '/guilds/:guildId/shuffle',
  loadMember,
  requireControl,
  handleAction((req) => {
    shuffleQueue(req.params.guildId);
    announceWeb(req, '🔀 Shuffled the queue');
  })
);

apiRouter.post(
  '/guilds/:guildId/clear',
  loadMember,
  requireControl,
  handleAction((req) => {
    const count = clearQueue(req.params.guildId);
    announceWeb(req, `🧹 Cleared ${count} track${count === 1 ? '' : 's'}`);
  })
);

apiRouter.post(
  '/guilds/:guildId/remove',
  loadMember,
  requireControl,
  handleAction((req) => {
    const track = removeTrackAt(req.params.guildId, Number(req.body.index));
    announceWeb(req, `🗑️ Removed **${track.title}**`);
  })
);

apiRouter.post(
  '/guilds/:guildId/loop',
  loadMember,
  requireControl,
  handleAction((req) => {
    setLoopMode(req.params.guildId, req.body.mode);
    announceWeb(req, `🔁 Set loop to ${req.body.mode}`);
  })
);

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
  const settings = updateGuildSettings(req.params.guildId, {
    controlMode,
    djRoleId: djRoleId || null,
  });
  res.json({ settings });
});
