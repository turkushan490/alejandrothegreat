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

  // Local progress ticker so the bar keeps moving smoothly between the
  // socket updates the server pushes.
  let progressState = null; // { currentMs, totalMs, playing }
  let lastTick = Date.now();

  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function fmt(ms) {
    if (!Number.isFinite(ms) || ms < 0) ms = 0;
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
  }

  function renderState(state) {
    const npEl = document.getElementById('nowPlaying');
    if (state.track) {
      const t = state.track;
      const art = t.thumbnail
        ? `<img class="np-art" src="${esc(t.thumbnail)}" alt="">`
        : '<div class="np-art"></div>';
      npEl.innerHTML = `
        ${art}
        <div class="np-info">
          <div class="np-title">${esc(t.title)}</div>
          <div class="np-author">${esc(t.author)}</div>
          <div class="np-status ${state.paused ? 'paused' : ''}">${state.paused ? '⏸ Paused' : '✨ Now playing'}</div>
        </div>`;
    } else {
      npEl.innerHTML = '<p class="muted">Nothing is playing right now — queue something fabulous below. 💅</p>';
    }

    // progress
    const wrap = document.getElementById('progressWrap');
    if (state.track && state.progress && state.progress.totalMs > 0) {
      progressState = {
        currentMs: state.progress.currentMs,
        totalMs: state.progress.totalMs,
        playing: state.playing,
      };
      lastTick = Date.now();
      wrap.hidden = false;
      document.getElementById('progressTotal').textContent = fmt(state.progress.totalMs);
      paintProgress();
    } else {
      progressState = null;
      wrap.hidden = true;
    }

    document.getElementById('controls').hidden = !canControl;
    document.getElementById('volume').value = state.volume;
    document.getElementById('volumeValue').textContent = state.volume;
    document.getElementById('loopMode').value = state.loopMode;

    const queueList = document.getElementById('queueList');
    queueList.innerHTML = state.queue.length
      ? state.queue
          .map(
            (t, i) => `<li>
              <span class="queue-num">${i + 1}</span>
              <span class="queue-meta">
                <span class="track-title">${esc(t.title)}</span>
                <span class="track-author">${esc(t.author)}</span>
              </span>
            </li>`
          )
          .join('')
      : '<li class="muted">Queue is empty — add more bangers. 🎶</li>';
  }

  function paintProgress() {
    if (!progressState) return;
    const pct = Math.min(100, (progressState.currentMs / progressState.totalMs) * 100);
    document.getElementById('progressFill').style.width = `${pct}%`;
    document.getElementById('progressCurrent').textContent = fmt(progressState.currentMs);
  }

  setInterval(() => {
    if (!progressState) return;
    const now = Date.now();
    const delta = now - lastTick;
    lastTick = now;
    if (progressState.playing) {
      progressState.currentMs = Math.min(progressState.totalMs, progressState.currentMs + delta);
      paintProgress();
    }
  }, 1000);

  async function setupSettingsPanel(settings) {
    const panel = document.getElementById('settingsPanel');
    panel.hidden = !isManager;
    if (!isManager) return;

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
  document.getElementById('btnClear').addEventListener('click', () => act('clear'));

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
