import { QueueRepeatMode } from 'discord-player';

function serializeTrack(track) {
  return {
    title: track.title,
    author: track.author,
    url: track.url,
    duration: track.duration,
    thumbnail: track.thumbnail,
    requestedBy: track.requestedBy ? track.requestedBy.username : null,
  };
}

function loopModeToString(mode) {
  switch (mode) {
    case QueueRepeatMode.TRACK:
      return 'track';
    case QueueRepeatMode.QUEUE:
      return 'queue';
    case QueueRepeatMode.AUTOPLAY:
      return 'autoplay';
    default:
      return 'off';
  }
}

export function buildQueueSnapshot(queue) {
  if (!queue || !queue.currentTrack) {
    return { playing: false, paused: false, track: null, queue: [], volume: 100, loopMode: 'off' };
  }
  return {
    playing: !queue.node.isPaused(),
    paused: queue.node.isPaused(),
    track: serializeTrack(queue.currentTrack),
    queue: queue.tracks.toArray().map(serializeTrack),
    volume: queue.node.volume,
    loopMode: loopModeToString(queue.repeatMode),
  };
}
