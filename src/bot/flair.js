// Alejandro's voice: cheeky, bouncy, quick-witted, a little bit gay but not
// drowning in "darling". Teasing and playful over full drag-queen camp. Big
// pools of lines so he rarely repeats himself. All user-facing text lives
// here so slash + prefix commands stay in character.

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export const flair = {
  queued: (title, author) =>
    pick([
      `😏 Ooh, **${title}** by *${author}* — solid pick. Adding it. 🎶`,
      `🎶 **${title}** locked in. Taste! ✨`,
      `👀 **${title}** by *${author}*? Say less. It's in. 💫`,
      `📥 **${title}** joins the party. Good call. 🕺`,
      `🔥 **${title}** — oh we're VIBING now. Queued. `,
      `✅ **${title}** by *${author}* is in the lineup. You've got ears. 👂`,
      `😎 Sliding **${title}** into the queue like it's nothing. `,
      `💅 **${title}**? Bold. Iconic. Added. `,
      `🎧 Cued up **${title}**. Sit back. `,
      `⭐ **${title}** by *${author}* — chef's kiss. In the queue. `,
    ]),

  queuedPlaylist: (title, count) =>
    pick([
      `📚 Loaded the whole **${title}** — ${count} tracks. Someone came to party. 🔥`,
      `✨ **${title}** (${count} tracks) is in. Ambitious, I like it. 💃`,
      `🎉 All ${count} tracks of **${title}** — buckle up. `,
      `📀 **${title}** dropped ${count} bangers in the queue. We're set. `,
      `🤯 ${count} tracks from **${title}**? Marathon mode: ON. `,
    ]),

  paused: () =>
    pick([
      '⏸️ Pausing… the drama builds. 🎭',
      '⏸️ Frozen in place. Everyone strike a pose. 📸',
      '⏸️ Hold up. Taking a lil breather. 😮‍💨',
      '⏸️ Intermission! Grab a drink. 🥤',
      '⏸️ Paused. The suspense is killing me. 😬',
      '⏸️ And… freeze. Nobody move. 🧊',
    ]),

  resumed: () =>
    pick([
      "▶️ And we're back. Miss me? 😏",
      '▶️ Un-paused. Here we go! 🎶',
      '▶️ Back to it — press play on the vibe. ✨',
      '▶️ Resuming the fantasy. 💫',
      '▶️ Okay okay, we move again. 🕺',
      '▶️ Play button go BRRR. 🔊',
    ]),

  skipped: (title) =>
    pick([
      `⏭️ Next! **${title}** had its moment. 💅`,
      `⏭️ Skipped **${title}**. We move. 😏`,
      `⏭️ Buh-bye **${title}** — bring me the next one. 🎶`,
      `⏭️ **${title}** got the hook. NEXT. 🪝`,
      `⏭️ Not feeling **${title}**? Say no more. Skipped. `,
      `⏭️ Onto bigger, better bops than **${title}**. `,
      `⏭️ **${title}** — served its purpose. Moving on. 💨`,
    ]),

  stopped: () =>
    pick([
      "⏹️ That's a wrap. Queue's spotless. 👋",
      '⏹️ Show over, lights up. Cleared the whole queue. ✨',
      '⏹️ Full stop. Everybody out. 🚪',
      '⏹️ Killed the music and cleaned the queue. Spotless. 🧹',
      '⏹️ And… scene. Queue wiped. 🎬',
    ]),

  nothingPlaying: () =>
    pick([
      "🙊 Nothing's playing — go on, queue something. 😏",
      '🔇 Silence? In here? Add a banger. 🎶',
      '😴 It\'s quiet. Too quiet. Play something! ',
      '📭 Empty queue energy. Fix that. ',
    ]),

  joinVoiceFirst: () =>
    pick([
      "🎧 Hop in a voice channel first — I'm not singing to an empty room. 😌",
      '🔌 Get in a voice channel and THEN we talk. 😏',
      "🎙️ No voice channel, no show. Hop in! ",
      "🚪 I'll follow you into voice — you just gotta be IN one first. ",
    ]),

  volumeSet: (level) =>
    `🔊 Volume → **${level}%** ${
      level >= 90
        ? '— absolutely feral. I love it. 🔥'
        : level >= 70
          ? '— now we\'re talking. 😎'
          : level === 0
            ? '— shhh, muted. 🤫'
            : level <= 20
              ? '— cute little whisper. 🤏'
              : '— just right. 💫'
    }`,

  shuffled: () =>
    pick([
      '🔀 Shuffled. Chaos mode: on. 😈',
      '🔀 Mixed it up. Surprise me. ✨',
      '🔀 Queue tossed like a salad. Fresh order. 🥗',
      '🔀 Randomized! Fate decides now. 🎲',
      '🔀 Shuffled the deck. Deal me a bop. 🃏',
    ]),

  removed: (title) =>
    pick([
      `🗑️ Yeeted **${title}**. Bye. 💅`,
      `🗑️ **${title}** is gone. No notes. 😏`,
      `🗑️ Removed **${title}**. It won't be missed. `,
      `✂️ Snipped **${title}** out of the queue. `,
      `🚮 **${title}**? Gone. Poof. `,
    ]),

  loopSet: (mode) => {
    const map = {
      off: pick([
        '➡️ Loop off. Living in the moment. 😎',
        '➡️ No more repeats — we keep it moving. ',
      ]),
      track: pick([
        '🔂 Looping this one. Obsessed? Same. 💫',
        '🔂 One track on repeat. A whole personality. ',
      ]),
      queue: pick([
        '🔁 Looping the whole queue. Party never stops. 🎉',
        '🔁 Queue on loop — infinite vibes unlocked. ♾️',
      ]),
    };
    return map[mode] || `🔁 Loop set to **${mode}**.`;
  },

  noPermission: () =>
    pick([
      "🚫 Nice try — you're not on the guest list for the DJ booth. 😏",
      '🚫 Ah-ah. No booth access for you this time. 💅',
      '🙅 That button\'s above your pay grade, hun. ',
      "🔒 DJ booth's locked for you. Ask someone with the role. ",
    ]),

  couldntPlay: () =>
    pick([
      '😬 Couldn\'t find or play that one. Try a different link or search? 🔎',
      "🤔 That one dodged me. Different search maybe? ",
      "💔 No luck with that track. Give me another? ",
    ]),

  serverOnly: () => pick(['🏠 This one only works inside a server. 😌', '📍 Server-only command, hun. ']),

  genericError: () =>
    pick(['💥 Oop — something broke backstage. Try again. 🎭', '🫠 That did not go as planned. One more time? ']),
};
