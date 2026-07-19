(async () => {
  const passwordSection = document.getElementById('passwordSection');
  const botsSection = document.getElementById('botsSection');
  const botFormSection = document.getElementById('botFormSection');
  const successSection = document.getElementById('successSection');
  const botForm = document.getElementById('botForm');
  const adminPasswordFieldset = document.getElementById('adminPasswordFieldset');
  const cancelBotFormBtn = document.getElementById('cancelBotFormBtn');

  let formMode = 'create'; // 'create-first' | 'create' | 'edit'
  let editingId = null;

  function showOnly(section) {
    for (const el of [passwordSection, botsSection, botFormSection, successSection]) {
      el.hidden = el !== section;
    }
  }

  function clearForm() {
    botForm.reset();
    document.getElementById('configError').hidden = true;
  }

  async function prefillDefaults() {
    const defaults = await api('/api/setup/defaults');
    document.getElementById('discordRedirectUri').value = defaults.discordRedirectUri || '';
    document.getElementById('spotifyClientId').value = defaults.spotifyClientId || '';
    if (formMode === 'create-first') {
      document.getElementById('discordClientId').value = defaults.discordClientId || '';
    }
  }

  async function openCreateForm(isFirst) {
    clearForm();
    formMode = isFirst ? 'create-first' : 'create';
    editingId = null;
    document.getElementById('botFormTitle').textContent = 'Add a bot';
    adminPasswordFieldset.hidden = !isFirst;
    cancelBotFormBtn.hidden = isFirst;
    await prefillDefaults();
    showOnly(botFormSection);
  }

  async function openEditForm(botId) {
    clearForm();
    const { bot } = await api(`/api/setup/bots/${botId}`);
    formMode = 'edit';
    editingId = botId;
    document.getElementById('botFormTitle').textContent = `Edit "${bot.name}"`;
    adminPasswordFieldset.hidden = true;
    cancelBotFormBtn.hidden = false;
    document.getElementById('botName').value = bot.name || '';
    document.getElementById('discordToken').value = bot.discordToken || '';
    document.getElementById('discordClientId').value = bot.discordClientId || '';
    document.getElementById('discordClientSecret').value = bot.discordClientSecret || '';
    document.getElementById('discordRedirectUri').value = bot.discordRedirectUri || '';
    document.getElementById('spotifyClientId').value = bot.spotifyClientId || '';
    document.getElementById('spotifyClientSecret').value = bot.spotifyClientSecret || '';
    showOnly(botFormSection);
  }

  function botCardHtml(bot) {
    const badges = [
      bot.isPrimary ? '<span class="bot-badge bot-badge-primary">Login bot</span>' : '',
      !bot.enabled ? '<span class="bot-badge bot-badge-disabled">Disabled</span>' : '',
    ].join(' ');
    return `
      <li class="bot-card" data-id="${bot.id}">
        <div class="bot-card-name">${bot.name} ${badges}</div>
        <div class="bot-card-actions">
          <button type="button" class="btn" data-action="invite">Invite link</button>
          <button type="button" class="btn" data-action="toggle">${bot.enabled ? 'Disable' : 'Enable'}</button>
          <button type="button" class="btn" data-action="edit">Edit</button>
          <button type="button" class="btn btn-danger" data-action="remove">Remove</button>
        </div>
      </li>`;
  }

  async function renderBotList() {
    const { bots } = await api('/api/setup/bots');
    const list = document.getElementById('botList');
    list.innerHTML = bots.length
      ? bots.map(botCardHtml).join('')
      : '<p class="muted">No bots yet.</p>';

    list.querySelectorAll('.bot-card').forEach((card) => {
      const botId = card.dataset.id;
      card.querySelector('[data-action="edit"]').addEventListener('click', () => openEditForm(botId));
      card.querySelector('[data-action="remove"]').addEventListener('click', async () => {
        if (!confirm('Remove this bot? It will disconnect immediately.')) return;
        await api(`/api/setup/bots/${botId}`, { method: 'DELETE' });
        await renderBotList();
      });
      card.querySelector('[data-action="toggle"]').addEventListener('click', async () => {
        try {
          await api(`/api/setup/bots/${botId}/toggle`, { method: 'POST' });
        } catch (err) {
          alert(err.message);
        }
        await renderBotList();
      });
      card.querySelector('[data-action="invite"]').addEventListener('click', async () => {
        try {
          const { url } = await api(`/api/setup/bots/${botId}/invite-link`);
          window.open(url, '_blank', 'noopener');
        } catch (err) {
          alert(err.message);
        }
      });
    });

    showOnly(botsSection);
    await renderAdmins();
  }

  const escA = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  async function renderAdmins() {
    const list = document.getElementById('adminList');
    try {
      const { admins } = await api('/api/setup/admins');
      list.innerHTML = admins.length
        ? admins
            .map(
              (a) => `<li>
                <span><span class="track-title">${escA(a.name || 'Admin')}</span> <code>${escA(a.id)}</code></span>
                <button type="button" class="btn btn-danger" data-admin="${escA(a.id)}">Remove</button>
              </li>`
            )
            .join('')
        : '<li class="muted">No extra admins yet — just you.</li>';
      list.querySelectorAll('[data-admin]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          await api(`/api/setup/admins/${btn.dataset.admin}`, { method: 'DELETE' });
          await renderAdmins();
        });
      });
    } catch {
      list.innerHTML = '<li class="muted">Couldn\'t load admins.</li>';
    }
  }

  document.getElementById('addAdminForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('adminError');
    errorEl.hidden = true;
    const discordUserId = document.getElementById('adminUserId').value.trim();
    const name = document.getElementById('adminName').value.trim();
    try {
      await api('/api/setup/admins', { method: 'POST', body: JSON.stringify({ discordUserId, name }) });
      document.getElementById('adminUserId').value = '';
      document.getElementById('adminName').value = '';
      await renderAdmins();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.hidden = false;
    }
  });

  async function render() {
    const status = await api('/api/setup/status');
    if (!status.configured) {
      await openCreateForm(true);
      return;
    }
    if (!status.isAdmin) {
      showOnly(passwordSection);
      return;
    }
    await renderBotList();
  }

  await render();

  document.getElementById('passwordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('passwordError');
    errorEl.hidden = true;
    try {
      await api('/api/setup/login', {
        method: 'POST',
        body: JSON.stringify({ password: document.getElementById('adminPasswordInput').value }),
      });
      await render();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.hidden = false;
    }
  });

  document.getElementById('addBotBtn').addEventListener('click', () => openCreateForm(false));
  document.getElementById('backToBotsBtn').addEventListener('click', renderBotList);
  cancelBotFormBtn.addEventListener('click', renderBotList);

  function validateBotFields(body) {
    if (!/^\d{17,20}$/.test(body.discordClientId)) {
      return 'Discord Client ID must be the numeric ID from the Discord Developer Portal (17-20 digits) - not a name, username, or anything else.';
    }
    if (body.discordClientSecret.length < 16) {
      return 'Discord Client Secret looks too short - copy it again from OAuth2 -> General in the Discord Developer Portal.';
    }
    if (!body.discordToken.includes('.') || body.discordToken.length < 50) {
      return "Discord Bot Token doesn't look like a real token - copy it again from the Bot tab.";
    }
    try {
      new URL(body.discordRedirectUri);
    } catch {
      return 'Redirect URI must be a full URL, e.g. http://192.168.1.100:3005/auth/discord/callback';
    }
    if (body.spotifyClientId && !/^[a-zA-Z0-9]{16,40}$/.test(body.spotifyClientId)) {
      return 'Spotify Client ID looks wrong - copy it again from the Spotify Developer Dashboard.';
    }
    if (body.spotifyClientSecret && !/^[a-zA-Z0-9]{16,40}$/.test(body.spotifyClientSecret)) {
      return 'Spotify Client Secret looks wrong - copy it again from the Spotify Developer Dashboard.';
    }
    return null;
  }

  botForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('configError');
    errorEl.hidden = true;

    const body = {
      name: document.getElementById('botName').value.trim(),
      discordToken: document.getElementById('discordToken').value.trim(),
      discordClientId: document.getElementById('discordClientId').value.trim(),
      discordClientSecret: document.getElementById('discordClientSecret').value.trim(),
      discordRedirectUri: document.getElementById('discordRedirectUri').value.trim(),
      spotifyClientId: document.getElementById('spotifyClientId').value.trim(),
      spotifyClientSecret: document.getElementById('spotifyClientSecret').value.trim(),
    };
    if (formMode === 'create-first') {
      body.adminPassword = document.getElementById('newAdminPassword').value;
    }

    const validationError = validateBotFields(body);
    if (validationError) {
      errorEl.textContent = validationError;
      errorEl.hidden = false;
      return;
    }

    try {
      if (formMode === 'edit') {
        await api(`/api/setup/bots/${editingId}`, { method: 'PUT', body: JSON.stringify(body) });
        await renderBotList();
        return;
      }

      const { bot } = await api('/api/setup/bots', { method: 'POST', body: JSON.stringify(body) });
      showOnly(successSection);
      try {
        const { url } = await api(`/api/setup/bots/${bot.id}/invite-link`);
        document.getElementById('inviteLink').href = url;
      } catch {
        // Non-fatal - the bot is still configured, the invite link just isn't ready yet.
      }
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.hidden = false;
    }
  });
})();
