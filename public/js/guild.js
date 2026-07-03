(async () => {
  const params = new URLSearchParams(window.location.search);
  const guildId = params.get('id');
  if (!guildId) {
    window.location.href = '/dashboard.html';
    return;
  }

  await loadUser();

  let canControl = false;

  function renderState(state) {
    const npEl = document.getElementById('nowPlaying');
    npEl.innerHTML = state.track
      ? `<div class="track-title">${state.track.title}</div>
         <div class="track-author">${state.track.author} &middot; ${state.paused ? 'Paused' : 'Playing'}</div>`
      : '<p class="muted">Nothing is playing.</p>';

    document.getElementById('controls').hidden = !canControl;
    document.getElementById('volume').value = state.volume;
    document.getElementById('volumeValue').textContent = state.volume;
    document.getElementById('loopMode').value = state.loopMode;

    const queueList = document.getElementById('queueList');
    queueList.innerHTML = state.queue.length
      ? state.queue
          .map((t) => `<li><span class="track-title">${t.title}</span><span class="track-author">${t.author}</span></li>`)
          .join('')
      : '<li class="muted">Queue is empty.</li>';
  }

  async function refresh() {
    try {
      const state = await api(`/api/guilds/${guildId}`);
      canControl = state.canControl;
      renderState(state);
    } catch (err) {
      document.getElementById('nowPlaying').innerHTML = `<div class="error-banner">${err.message}</div>`;
    }
  }

  await refresh();

  const socket = io();
  socket.on('connect', () => socket.emit('join', guildId));
  socket.on('state', renderState);

  async function act(action, body = {}) {
    try {
      await api(`/api/guilds/${guildId}/${action}`, { method: 'POST', body: JSON.stringify(body) });
    } catch (err) {
      alert(err.message);
    }
  }

  document.getElementById('btnPause').addEventListener('click', () => act('pause'));
  document.getElementById('btnResume').addEventListener('click', () => act('resume'));
  document.getElementById('btnSkip').addEventListener('click', () => act('skip'));
  document.getElementById('btnStop').addEventListener('click', () => act('stop'));
  document.getElementById('btnShuffle').addEventListener('click', () => act('shuffle'));

  document.getElementById('loopMode').addEventListener('change', (e) => act('loop', { mode: e.target.value }));

  let volumeTimeout;
  document.getElementById('volume').addEventListener('input', (e) => {
    document.getElementById('volumeValue').textContent = e.target.value;
    clearTimeout(volumeTimeout);
    volumeTimeout = setTimeout(() => act('volume', { level: Number(e.target.value) }), 250);
  });

  document.getElementById('searchForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('searchInput');
    const query = input.value.trim();
    if (!query) return;
    await act('play', { query });
    input.value = '';
  });
})();
