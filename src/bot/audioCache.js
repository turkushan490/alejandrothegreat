import fs from 'node:fs';
import path from 'node:path';
import ytdl from 'youtube-dl-exec';
import { config } from '../config.js';

// Download-then-play cache: instead of live-streaming YouTube (which stutters
// and re-hits YouTube every play), we download the audio-only file once, then
// play it from disk. Replaying a cached track never touches YouTube again.
//
// Max number of cached files is configurable (AUDIO_CACHE_MAX, default 30);
// when exceeded, the least-recently-played files are deleted.
const CACHE_DIR = path.join(config.dataDir, 'audio-cache');
const MAX_FILES = Math.max(1, parseInt(process.env.AUDIO_CACHE_MAX || '30', 10));

fs.mkdirSync(CACHE_DIR, { recursive: true });

function extractVideoId(url) {
  try {
    const u = new URL(url);
    return u.searchParams.get('v') || u.pathname.split('/').filter(Boolean).pop();
  } catch {
    return String(url).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'track';
  }
}

// yt-dlp writes <id>.<ext> (opus/m4a/webm); find whichever extension landed.
function findCachedFile(id) {
  try {
    const match = fs.readdirSync(CACHE_DIR).find((f) => f.startsWith(`${id}.`) && !f.endsWith('.part'));
    return match ? path.join(CACHE_DIR, match) : null;
  } catch {
    return null;
  }
}

// Keep only the newest MAX_FILES by last-access (mtime), delete the rest.
function pruneCache() {
  try {
    const files = fs
      .readdirSync(CACHE_DIR)
      .filter((f) => !f.endsWith('.part'))
      .map((f) => {
        const full = path.join(CACHE_DIR, f);
        return { full, atime: fs.statSync(full).atimeMs };
      })
      .sort((a, b) => b.atime - a.atime); // newest first
    for (const stale of files.slice(MAX_FILES)) {
      fs.unlink(stale.full, () => {});
    }
  } catch {
    /* pruning is best-effort */
  }
}

// Ensures the track's audio is downloaded (audio-only) and returns the file
// path. Cache hit -> returns immediately. Cache miss -> downloads first.
async function ensureDownloaded(track, cookieFile) {
  const id = extractVideoId(track.url);

  const existing = findCachedFile(id);
  if (existing) {
    fs.utimes(existing, new Date(), fs.statSync(existing).mtime, () => {}); // bump access time (LRU)
    return existing;
  }

  const videoUrl = `https://youtu.be/${id}`;
  const outputTemplate = path.join(CACHE_DIR, `${id}.%(ext)s`);
  await ytdl(videoUrl, {
    format: track.live ? 'best[height<=360]' : 'bestaudio', // audio-only, no video
    extractAudio: false, // keep the native audio container (fast, no re-encode)
    jsRuntimes: 'node',
    output: outputTemplate,
    noPlaylist: true,
    noWarnings: true,
    noProgress: true,
    ...(cookieFile ? { cookies: cookieFile } : {}),
  });

  const file = findCachedFile(id);
  pruneCache();
  return file;
}

// createStream for the Youtubei extractor: download audio-only, then hand
// discord-player a read stream of the local file.
export function createCachedStream(cookieFile) {
  return async (track) => {
    const file = await ensureDownloaded(track, cookieFile);
    if (!file) throw new Error('audio download failed');
    return fs.createReadStream(file);
  };
}

export function cacheInfo() {
  let count = 0;
  try {
    count = fs.readdirSync(CACHE_DIR).filter((f) => !f.endsWith('.part')).length;
  } catch {
    /* ignore */
  }
  return { dir: CACHE_DIR, count, max: MAX_FILES };
}
