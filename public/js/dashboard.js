(async () => {
  await loadUser();

  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const grid = document.getElementById('guildGrid');
  try {
    const { guilds } = await api('/api/guilds');
    if (guilds.length === 0) {
      grid.innerHTML = '<p class="muted">None of your configured bots are in a server you\'re a member of yet. <a href="/setup.html">Invite one</a>.</p>';
      return;
    }
    grid.innerHTML = guilds
      .map((g) => {
        const sub = g.nowPlaying
          ? `<div class="track-author">🎶 ${esc(g.nowPlaying)}</div>`
          : `<div class="muted">${g.memberCount} members &middot; ${esc(g.botName)}</div>`;
        return `
      <a class="guild-card" href="/guild.html?id=${g.id}">
        <div class="guild-icon">${g.icon ? `<img src="${esc(g.icon)}" alt="">` : esc(g.name[0])}</div>
        <div class="queue-meta">
          <div class="track-title">${esc(g.name)}${g.playing ? '<span class="playing-dot" title="Playing"></span>' : ''}</div>
          ${sub}
        </div>
      </a>`;
      })
      .join('');
  } catch (err) {
    grid.innerHTML = `<div class="error-banner">${esc(err.message)}</div>`;
  }
})();
