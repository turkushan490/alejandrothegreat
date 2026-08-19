import fs from 'node:fs';
import path from 'node:path';
import ytdl from 'youtube-dl-exec';
import { config } from '../config.js';
import { getAudioCacheMax } from '../db.js';

// Download-then-play cache: instead of live-streaming YouTube (which stutters
// and re-hits YouTube every play), we download the audio-only file once, then
// play it from disk. Replaying a cached track never touches YouTube again.
//
// Max number of cached files is set in the dashboard (getAudioCacheMax, which
// falls back to the AUDIO_CACHE_MAX env var, then 30); when exceeded, the
// least-recently-played files are deleted.
const CACHE_DIR = path.join(config.dataDir, 'audio-cache');

// A single stuck yt-dlp (e.g. a livestream, or YouTube throttling to a crawl)
// used to hang the whole queue - the bot would just sit there "dead". Cap it.
const DOWNLOAD_TIMEOUT_MS = 90_000;
// YouTube 403-blocks the default "web" client's media URLs on many hosts
// (datacenter + flagged residential IPs). The "android" client's URLs still
// download fine - verified on the server that every other client 403s or
// exposes no audio format. Try android first, keep a couple of alternates as
// fallback in case YouTube shifts which client works, then android once more
// to ride out a transient hiccup on the good one.
const DOWNLOAD_CLIENTS = ['android', 'android_vr', 'ios', 'tv_embedded', 'android'];

fs.mkdirSync(CACHE_DIR, { recursive: true });

// Files currently being read into a voice connection. These must never be
// pruned out from under a playing track, and we de-dupe concurrent downloads
// of the same video so two yt-dlp processes don't fight over one output path.
const inUse = new Map(); // filePath -> refcount
const inFlight = new Map(); // videoId -> Promise<filePath>

function markInUse(file) {
  inUse.set(file, (inUse.get(file) || 0) + 1);
}
function releaseInUse(file) {
  const n = (inUse.get(file) || 0) - 1;
  if (n <= 0) inUse.delete(file);
  else inUse.set(file, n);
}

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

// Keep only the newest N (dashboard-configurable) by last-access, delete rest -
// but never delete a file that's currently being played.
function pruneCache() {
  try {
    const max = getAudioCacheMax();
    const files = fs
      .readdirSync(CACHE_DIR)
      .filter((f) => !f.endsWith('.part'))
      .map((f) => {
        const full = path.join(CACHE_DIR, f);
        return { full, atime: fs.statSync(full).atimeMs };
      })
      .sort((a, b) => b.atime - a.atime); // newest first
    for (const stale of files.slice(max)) {
      if (inUse.has(stale.full)) continue; // don't yank a playing track
      fs.unlink(stale.full, () => {});
    }
  } catch {
    /* pruning is best-effort */
  }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Runs yt-dlp once for this id. Resolves to the downloaded file path, or
// throws if yt-dlp fails / times out.
async function runDownload(id, track, cookieFile, playerClient) {
  const videoUrl = `https://youtu.be/${id}`;
  const outputTemplate = path.join(CACHE_DIR, `${id}.%(ext)s`);
  // 'bestaudio' already selects an audio-only format (no video), kept in its
  // native container - no re-encode, fast. player_client picks a YouTube
  // client whose media URLs aren't 403'd; yt-dlp's own retries smooth over
  // transient network hiccups.
  await ytdl(
    videoUrl,
    {
      format: track.live ? 'best[height<=360]/best' : 'bestaudio/best',
      jsRuntimes: 'node',
      output: outputTemplate,
      noPlaylist: true,
      noWarnings: true,
      noProgress: true,
      retries: 3,
      fragmentRetries: 3,
      socketTimeout: 20,
      extractorArgs: `youtube:player_client=${playerClient}`,
      ...(cookieFile ? { cookies: cookieFile } : {}),
    },
    { timeout: DOWNLOAD_TIMEOUT_MS, killSignal: 'SIGKILL' }
  );
  const file = findCachedFile(id);
  if (!file) throw new Error('yt-dlp finished but produced no file');
  return file;
}

// Ensures the track's audio is downloaded (audio-only) and returns the file
// path. Cache hit -> returns immediately. Cache miss -> downloads (with a
// couple of retries) first. Concurrent calls for the same id share one download.
async function ensureDownloaded(track, cookieFile) {
  const id = extractVideoId(track.url);

  const existing = findCachedFile(id);
  if (existing) {
    fs.utimes(existing, new Date(), fs.statSync(existing).mtime, () => {}); // bump access time (LRU)
    return existing;
  }

  if (inFlight.has(id)) return inFlight.get(id);

  const job = (async () => {
    let lastErr;
    for (let i = 0; i < DOWNLOAD_CLIENTS.length; i++) {
      const client = DOWNLOAD_CLIENTS[i];
      try {
        const file = await runDownload(id, track, cookieFile, client);
        pruneCache();
        return file;
      } catch (err) {
        lastErr = err;
        // Clean up any half-written .part so the next try starts fresh.
        try {
          for (const f of fs.readdirSync(CACHE_DIR)) {
            if (f.startsWith(`${id}.`) && f.endsWith('.part')) fs.unlink(path.join(CACHE_DIR, f), () => {});
          }
        } catch {
          /* ignore */
        }
        console.warn(`[audio] download failed for ${id} via ${client}: ${err.shortMessage || err.message}`);
        if (i < DOWNLOAD_CLIENTS.length - 1) await wait(600);
      }
    }
    throw lastErr;
  })();

  inFlight.set(id, job);
  try {
    return await job;
  } finally {
    inFlight.delete(id);
  }
}

// createStream for the Youtubei extractor: download audio-only, then hand
// discord-player a read stream of the local file. The file is marked in-use
// for the life of the stream so pruning can't delete it mid-song.
export function createCachedStream(cookieFile) {
  return async (track) => {
    const file = await ensureDownloaded(track, cookieFile);
    if (!file) throw new Error('audio download failed');
    markInUse(file);
    const stream = fs.createReadStream(file);
    const release = () => releaseInUse(file);
    stream.once('close', release);
    stream.once('error', release);
    return stream;
  };
}

export function cacheInfo() {
  let count = 0;
  try {
    count = fs.readdirSync(CACHE_DIR).filter((f) => !f.endsWith('.part')).length;
  } catch {
    /* ignore */
  }
  return { dir: CACHE_DIR, count, max: getAudioCacheMax() };
}

// Delete every cached file (dashboard "clear cache" action). Skips any file
// that's currently playing.
export function clearCache() {
  let removed = 0;
  try {
    for (const f of fs.readdirSync(CACHE_DIR)) {
      const full = path.join(CACHE_DIR, f);
      if (inUse.has(full)) continue;
      fs.unlinkSync(full);
      removed++;
    }
  } catch {
    /* best-effort */
  }
  return removed;
}
