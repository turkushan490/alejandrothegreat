import { GuildQueueEvent } from 'discord-player';
import { ActivityType, EmbedBuilder } from 'discord.js';
import { botEvents } from '../emitter.js';
import { buildQueueSnapshot } from '../queueState.js';

const ACCENT = 0x58a6ff;

const START_LINES = [
  '🎶 Now spinning',
  '😏 Up next, and it slaps',
  '✨ Fresh off the queue',
  '🔊 Turn it up',
  '💫 Vibe check — playing now',
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

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

async function postNowPlaying(queue, track) {
  const channel = queue.metadata?.channel;
  if (!channel?.send) return;
  try {
    const embed = new EmbedBuilder()
      .setColor(ACCENT)
      .setAuthor({ name: pick(START_LINES) })
      .setTitle(track.title)
      .setURL(track.url || null)
      .setDescription(`by **${track.author || 'someone with taste'}** 🎧`)
      .setThumbnail(track.thumbnail || null)
      .setFooter({
        text: track.requestedBy ? `Requested by ${track.requestedBy.username} · length ${track.duration}` : `Length ${track.duration}`,
      });
    await channel.send({ embeds: [embed] });
  } catch {
    /* posting the embed is best-effort - never break playback over it */
  }
}

// Bridges discord-player's queue events to the shared in-process emitter so
// the web server's socket.io layer can push live updates to the dashboard.
export function registerPlayerEvents(player) {
  const broadcast = (queue) => {
    botEvents.emit('queueUpdate', queue.guild.id, buildQueueSnapshot(queue));
  };

  player.events.on(GuildQueueEvent.PlayerStart, (queue, track) => {
    broadcast(queue);
    setNowPlayingPresence(queue.guild.client, track);
    postNowPlaying(queue, track);
  });

  const plainBroadcastEvents = [
    GuildQueueEvent.PlayerPause,
    GuildQueueEvent.PlayerResume,
    GuildQueueEvent.PlayerFinish,
    GuildQueueEvent.AudioTrackAdd,
    GuildQueueEvent.AudioTracksAdd,
  ];
  for (const event of plainBroadcastEvents) {
    player.events.on(event, broadcast);
  }

  const endEvents = [GuildQueueEvent.EmptyQueue, GuildQueueEvent.Disconnect];
  for (const event of endEvents) {
    player.events.on(event, (queue) => {
      broadcast(queue);
      clearPresence(queue.guild.client);
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
