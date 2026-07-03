(async () => {
  await loadUser();

  const grid = document.getElementById('guildGrid');
  try {
    const { guilds } = await api('/api/guilds');
    if (guilds.length === 0) {
      grid.innerHTML = '<p class="muted">None of your configured bots are in a server you\'re a member of yet. <a href="/setup.html">Invite one</a>.</p>';
      return;
    }
    grid.innerHTML = guilds
      .map(
        (g) => `
      <a class="guild-card" href="/guild.html?id=${g.id}">
        <div class="guild-icon">${g.icon ? `<img src="${g.icon}" alt="">` : g.name[0]}</div>
        <div>
          <div>${g.name}${g.playing ? '<span class="playing-dot" title="Playing"></span>' : ''}</div>
          <div class="muted">${g.memberCount} members &middot; ${g.botName}</div>
        </div>
      </a>`
      )
      .join('');
  } catch (err) {
    grid.innerHTML = `<div class="error-banner">${err.message}</div>`;
  }
})();
