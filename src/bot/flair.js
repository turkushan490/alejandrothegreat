// Alejandro's voice: flamboyant, campy, warm, drenched in emotes. All the
// user-facing reply text lives here so slash commands and prefix commands
// stay in the same fabulous character.

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export const flair = {
  queued: (title, author) =>
    `${pick(['💅', '✨', '🎀', '🌈', '💖'])} Ooh yes — **${title}** by *${author}* is in the lineup, honey! 🎶`,

  queuedPlaylist: (title, count) =>
    `📚✨ Loaded up the entire **${title}** fantasy — ${count} tracks of pure, uncut serve! 💃🔥`,

  paused: () => pick([
    '⏸️ Hold that thought, gorgeous. 💋',
    '⏸️ Pausing for dramatic effect, darling. 🎭',
    '⏸️ Freeze! Everybody looks fabulous. 🧊✨',
  ]),

  resumed: () => pick([
    '▶️ And we are BACK, baby! 💅🔥',
    '▶️ Press play on the fantasy, honey. 🎶',
    "▶️ Where were we? Oh right — slaying. 💃",
  ]),

  skipped: (title) => pick([
    `⏭️ Buh-bye **${title}** — NEXT! 💅`,
    `⏭️ Skipped **${title}**, we don't dwell, darling. ✨`,
    `⏭️ Off you go, **${title}**! Bring me the next bop. 🎶`,
  ]),

  stopped: () => pick([
    '⏹️ Show\'s over, loves — cleared the whole queue. 👋💖',
    '⏹️ And... scene. 🎬 Queue wiped spotless, darling. ✨',
  ]),

  nothingPlaying: () => pick([
    "🙊 Nothing's playing right now, sweetie — queue something fabulous! 💅",
    '🔇 Silence?? In MY channel? Add a banger, honey. 🎶',
  ]),

  joinVoiceFirst: () => '🎧 Hop into a voice channel first, gorgeous — I can\'t serve to an empty room! 💅',

  volumeSet: (level) => `🔊 Volume cranked to **${level}%** — ${level >= 80 ? 'let the neighbours HEAR it! 🔥' : level === 0 ? 'shhh, muted like a secret. 🤫' : 'mmm, just right, darling. 💫'}`,

  shuffled: () => pick([
    '🔀 Shuffled the queue — chaos is my aesthetic, honey! 💃',
    '🔀 Mixed it all up, darling. Surprise me. ✨',
  ]),

  removed: (title) => `🗑️✨ Yeeted **${title}** out of the queue. No notes, no regrets. 💅`,

  loopSet: (mode) => {
    const map = {
      off: '➡️ Loop OFF — living in the moment, darling. 💫',
      track: '🔂 Looping this one track FOREVER — obsessed, and honestly? valid. 💖',
      queue: '🔁 Looping the whole queue — the party never ends, honey! 🎉',
    };
    return map[mode] || `🔁 Loop set to **${mode}**.`;
  },

  noPermission: () => "🚫💅 Ah-ah — you don't have the keys to the DJ booth in this server, sweetie.",

  couldntPlay: () => "😩💔 Ugh, couldn't find or play that one, darling. Try a different link or search term? 🔎",

  serverOnly: () => '🏠 This one only works inside a server, love. 💌',

  genericError: () => '💥 Oop — something went sideways backstage. Try again, gorgeous. 🎭',
};
