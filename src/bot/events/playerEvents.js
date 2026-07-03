import { GuildQueueEvent } from 'discord-player';
import { botEvents } from '../emitter.js';
import { buildQueueSnapshot } from '../queueState.js';

// Bridges discord-player's queue events to the shared in-process emitter so
// the web server's socket.io layer can push live updates to the dashboard.
export function registerPlayerEvents(player) {
  const broadcast = (queue) => {
    botEvents.emit('queueUpdate', queue.guild.id, buildQueueSnapshot(queue));
  };

  const events = [
    GuildQueueEvent.PlayerStart,
    GuildQueueEvent.PlayerPause,
    GuildQueueEvent.PlayerResume,
    GuildQueueEvent.PlayerFinish,
    GuildQueueEvent.AudioTrackAdd,
    GuildQueueEvent.AudioTracksAdd,
    GuildQueueEvent.EmptyQueue,
    GuildQueueEvent.Disconnect,
  ];

  for (const event of events) {
    player.events.on(event, broadcast);
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
