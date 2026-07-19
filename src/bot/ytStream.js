import fs from 'node:fs';
import path from 'node:path';
import ytdl from 'youtube-dl-exec';
import { config } from '../config.js';
import { getYoutubeCookie } from '../db.js';

const COOKIE_FILE = path.join(config.dataDir, 'youtube-cookies.txt');

// Writes the saved YouTube cookie (if any) to a file yt-dlp can read, and
// returns its path - or null when no cookie is configured. Re-called on each
// bot (re)start so cookie changes take effect after a restart.
export function ensureCookieFile() {
  const cookie = getYoutubeCookie();
  if (cookie && cookie.trim()) {
    try {
      fs.writeFileSync(COOKIE_FILE, cookie, { mode: 0o600 });
      return COOKIE_FILE;
    } catch (err) {
      console.error('[yt] failed to write cookie file:', err.message);
      return null;
    }
  }
  // No cookie configured - remove any stale file.
  try {
    fs.unlinkSync(COOKIE_FILE);
  } catch {
    /* not there, fine */
  }
  return null;
}

function extractVideoId(url) {
  try {
    const u = new URL(url);
    return u.searchParams.get('v') || u.pathname.split('/').filter(Boolean).pop();
  } catch {
    return url;
  }
}

// Custom stream for the Youtubei extractor: streams YouTube audio via yt-dlp,
// passing the cookie file so YouTube doesn't bot-block us. This replaces the
// extractor's built-in useYoutubeDL path so we control the cookie, and it
// leaves youtubei.js's own cookie (used for search) untouched.
export function createYtStream(track) {
  const videoUrl = `https://youtu.be/${extractVideoId(track.url)}`;
  const cookieFile = getYoutubeCookie() ? COOKIE_FILE : undefined;

  const options = {
    format: track.live ? 'best[height<=360]' : 'bestaudio',
    jsRuntimes: 'node',
    output: '-',
    noWarnings: true,
    noProgress: true,
    ...(cookieFile ? { cookies: cookieFile } : {}),
  };

  const proc = ytdl.exec(videoUrl, options, { stdio: ['ignore', 'pipe', 'ignore'] });
  proc.catch(() => {
    /* yt-dlp exits non-zero on blocked/failed streams; discord-player surfaces the empty stream */
  });

  const stream = proc.stdout;
  const kill = () => {
    if (!proc.killed) {
      try {
        proc.kill();
      } catch {
        /* already gone */
      }
    }
  };
  stream.on('close', kill);
  stream.on('error', kill);
  stream.on('end', kill);
  return stream;
}
