(async () => {
  const params = new URLSearchParams(window.location.search);
  const guildId = params.get('id');
  if (!guildId) {
    window.location.href = '/dashboard.html';
    return;
  }

  await loadUser();

  let canControl = false;
  let isManager = false;

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

  async function setupSettingsPanel(settings) {
    const panel = document.getElementById('settingsPanel');
    panel.hidden = !isManager;
    if (!isManager) return;

    document.getElementById('prefixInput').value = settings.prefix;
    document.getElementById('controlModeSelect').value = settings.controlMode;
    document.getElementById('djRoleRow').hidden = settings.controlMode !== 'dj-role';

    const roleSelect = document.getElementById('djRoleSelect');
    try {
      const { roles } = await api(`/api/guilds/${guildId}/roles`);
      roleSelect.innerHTML = roles.map((r) => `<option value="${r.id}">${r.name}</option>`).join('');
      if (settings.djRoleId) roleSelect.value = settings.djRoleId;
    } catch {
      roleSelect.innerHTML = '<option value="">(couldn\'t load roles)</option>';
    }
  }

  async function refresh() {
    try {
      const state = await api(`/api/guilds/${guildId}`);
      canControl = state.canControl;
      isManager = state.isManager;
      document.getElementById('botNameLabel').textContent = `Managed by ${state.botName}`;
      renderState(state);
      await setupSettingsPanel(state.settings);
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

  document.getElementById('controlModeSelect').addEventListener('change', (e) => {
    document.getElementById('djRoleRow').hidden = e.target.value !== 'dj-role';
  });

  document.getElementById('settingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('settingsError');
    errorEl.hidden = true;
    const body = {
      prefix: document.getElementById('prefixInput').value.trim() || '!',
      controlMode: document.getElementById('controlModeSelect').value,
      djRoleId: document.getElementById('djRoleSelect').value || null,
    };
    try {
      await api(`/api/guilds/${guildId}/settings`, { method: 'POST', body: JSON.stringify(body) });
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.hidden = false;
    }
  });
})();
