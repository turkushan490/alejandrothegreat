// Alejandro's voice: cheeky, bouncy, quick-witted, a little bit gay but not
// drowning in "darling". Teasing and playful over full drag-queen camp. All
// user-facing text lives here so slash + prefix commands stay in character.

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export const flair = {
  queued: (title, author) =>
    pick([
      `😏 Ooh, **${title}** by *${author}* — solid pick. Adding it. 🎶`,
      `🎶 **${title}** locked in. Taste! ✨`,
      `👀 **${title}** by *${author}*? Say less. It's in. 💫`,
    ]),

  queuedPlaylist: (title, count) =>
    pick([
      `📚 Loaded the whole **${title}** — ${count} tracks. Someone came to party. 🔥`,
      `✨ **${title}** (${count} tracks) is in the queue. Ambitious, I like it. 💃`,
    ]),

  paused: () => pick([
    '⏸️ Pausing… the drama builds. 🎭',
    '⏸️ Frozen in place. Everyone strike a pose. 📸',
    '⏸️ Hold up. Taking a lil breather. 😮‍💨',
  ]),

  resumed: () => pick([
    "▶️ And we're back. Miss me? 😏",
    '▶️ Un-paused. Here we go! 🎶',
    '▶️ Back to it — press play on the vibe. ✨',
  ]),

  skipped: (title) => pick([
    `⏭️ Next! **${title}** had its moment. 💅`,
    `⏭️ Skipped **${title}**. We move. 😏`,
    `⏭️ Buh-bye **${title}** — bring me the next one. 🎶`,
  ]),

  stopped: () => pick([
    "⏹️ That's a wrap. Queue's spotless. 👋",
    '⏹️ Show over, lights up. Cleared the whole queue. ✨',
  ]),

  nothingPlaying: () => pick([
    "🙊 Nothing's playing — go on, queue something. 😏",
    '🔇 Silence? In here? Add a banger. 🎶',
  ]),

  joinVoiceFirst: () => "🎧 Hop in a voice channel first — I'm not singing to an empty room. 😌",

  volumeSet: (level) =>
    `🔊 Volume → **${level}%** ${level >= 80 ? '— bold, I love it. 🔥' : level === 0 ? '— shhh, muted. 🤫' : '— just right. 😎'}`,

  shuffled: () => pick([
    '🔀 Shuffled. Chaos mode: on. 😈',
    '🔀 Mixed it up. Surprise me. ✨',
  ]),

  removed: (title) => pick([
    `🗑️ Yeeted **${title}**. Bye. 💅`,
    `🗑️ **${title}** is gone. No notes. 😏`,
  ]),

  loopSet: (mode) => {
    const map = {
      off: '➡️ Loop off. Living in the moment. 😎',
      track: '🔂 Looping this one. Obsessed? Same. 💫',
      queue: '🔁 Looping the whole queue. Party never stops. 🎉',
    };
    return map[mode] || `🔁 Loop set to **${mode}**.`;
  },

  noPermission: () => pick([
    "🚫 Nice try — you're not on the guest list for the DJ booth. 😏",
    '🚫 Ah-ah. No booth access for you this time. 💅',
  ]),

  couldntPlay: () => "😬 Couldn't find or play that one. Try a different link or search? 🔎",

  serverOnly: () => '🏠 This one only works inside a server. 😌',

  genericError: () => '💥 Oop — something broke backstage. Try again. 🎭',
};
