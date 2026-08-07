import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

// User-editable reactions for when a song is queued. The file lives in the
// data dir (on Unraid: /mnt/user/appdata/alejandrothegreat/queued-lines.txt)
// so anyone can edit it without rebuilding. One reaction per line; lines
// starting with # are ignored. Changes apply on the next queue (the file is
// re-read whenever its modified time changes).
const QUOTES_FILE = path.join(config.dataDir, 'queued-lines.txt');

const DEFAULT_QUOTES = `# One reaction per line - the bot picks a random one each time a song is queued.
# Lines starting with # are ignored. Edit freely and save; changes apply on the next /play.

absolute bop, queued.
oh HELL yes—queued.
put it on the list! The Playlist baby grrrl!
oooh just wait for this one, y'all.
slaps harder than Ron "Wolverine" Bata!
of course this one makes the list, no question.
...you sure about this one, girl? Queued, I guess.
Put. It. In. The. Playlist.
Unnnghh this one takes me back... It was winter in Prague, and the consumption hung low in the air... queued, no question.
Next.
now That's What I Call Music!
kidz bop did it better.
it's not exactly Céline Marie Claudette Dion but it's fine.
you know how I know that you're gay? This song right here.
YASS QUEEN, slay them with your exquisite taste!
I danced so hard to this one night at the club when I was high on Molly and ended up in the hospital. Worth it. added.
no notes, great choice.
this playlist is shaping up to be a GAYlist honey, I love love love it!
how dare you. But queued, nevertheless.
eargasms for days, more like this!
if boots ever brought the house down, the boots were this song.
100% pure love.
okay but your next choice better be something with more bpm.
huh. Okay, I can dig it.
we're gonna get your ears wet with this one.
I should have already had this one in the queue, that's on me, guys.
an acquired taste...
if you can read this Turk has me chained to a radiator in his basement, I'm not really a bot at all please HELP ME
of course you'd add this one. Queued.
bounced on my boy's speakers to this one for hours.
I was going to add it myself if you didn't, queued.
`;

function parseLines(text) {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
}

// Creates the file with the defaults if it doesn't exist yet.
export function ensureQuotesFile() {
  try {
    if (!fs.existsSync(QUOTES_FILE)) {
      fs.mkdirSync(config.dataDir, { recursive: true });
      fs.writeFileSync(QUOTES_FILE, DEFAULT_QUOTES);
      console.log(`[quotes] created editable ${QUOTES_FILE}`);
    }
  } catch (err) {
    console.error('[quotes] could not create queued-lines.txt:', err.message);
  }
}

let cache = null;
let cacheMtime = -1;

function loadQuotes() {
  try {
    const mtime = fs.statSync(QUOTES_FILE).mtimeMs;
    if (cache && mtime === cacheMtime) return cache;
    const lines = parseLines(fs.readFileSync(QUOTES_FILE, 'utf8'));
    cache = lines.length ? lines : parseLines(DEFAULT_QUOTES);
    cacheMtime = mtime;
    return cache;
  } catch {
    return cache || parseLines(DEFAULT_QUOTES);
  }
}

export function randomQueuedLine() {
  const lines = loadQuotes();
  return lines[Math.floor(Math.random() * lines.length)];
}
