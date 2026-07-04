import { GuildQueueEvent } from 'discord-player';
import { ActivityType } from 'discord.js';
import { botEvents } from '../emitter.js';
import { startNowPlaying, teardownNowPlaying, updateNowPlaying } from '../nowplaying.js';
import { buildQueueSnapshot } from '../queueState.js';

// Discord presence is per-bot, so a bot in several guilds shows the most
// recently started track. That's expected - presence isn't per-server.
function setNowPlayingPresence(client, track) {
  try {
    client.user.setActivity({ name: `${track.title} 🎶`, type: ActivityType.Listening });
  } catch {
    /* presence is best-effort */
  }
}

function clearPresence(client) {
  try {
    client.user.setActivity(null);
  } catch {
    /* best-effort */
  }
}

// Bridges discord-player's queue events to the shared in-process emitter so
// the web server's socket.io layer can push live updates to the dashboard,
// and drives the persistent in-Discord now-playing message.
export function registerPlayerEvents(player) {
  const broadcast = (queue) => {
    botEvents.emit('queueUpdate', queue.guild.id, buildQueueSnapshot(queue));
  };

  player.events.on(GuildQueueEvent.PlayerStart, (queue, track) => {
    broadcast(queue);
    setNowPlayingPresence(queue.guild.client, track);
    startNowPlaying(queue);
  });

  for (const event of [GuildQueueEvent.PlayerPause, GuildQueueEvent.PlayerResume]) {
    player.events.on(event, (queue) => {
      broadcast(queue);
      updateNowPlaying(queue.guild.id).catch(() => {});
    });
  }

  for (const event of [GuildQueueEvent.PlayerFinish, GuildQueueEvent.AudioTrackAdd, GuildQueueEvent.AudioTracksAdd]) {
    player.events.on(event, broadcast);
  }

  for (const event of [GuildQueueEvent.EmptyQueue, GuildQueueEvent.Disconnect]) {
    player.events.on(event, (queue) => {
      broadcast(queue);
      clearPresence(queue.guild.client);
      teardownNowPlaying(queue.guild).catch(() => {});
    });
  }

  player.events.on(GuildQueueEvent.Error, (queue, error) => {
    console.error(`[player] queue error in guild ${queue.guild.id}:`, error);
    broadcast(queue);
  });

  player.events.on(GuildQueueEvent.PlayerError, (queue, error) => {
    console.error(`[player] playback error in guild ${queue.guild.id}:`, error);
    broadcast(queue);
  });
}
