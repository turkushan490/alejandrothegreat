(async () => {
  const passwordSection = document.getElementById('passwordSection');
  const configSection = document.getElementById('configSection');
  const successSection = document.getElementById('successSection');

  async function prefillDefaults() {
    const defaults = await api('/api/setup/defaults');
    document.getElementById('discordClientId').value = defaults.discordClientId || '';
    document.getElementById('discordRedirectUri').value = defaults.discordRedirectUri || '';
    document.getElementById('spotifyClientId').value = defaults.spotifyClientId || '';
  }

  async function prefillExisting() {
    const cfg = await api('/api/setup/config');
    document.getElementById('discordToken').value = cfg.discordToken || '';
    document.getElementById('discordClientId').value = cfg.discordClientId || '';
    document.getElementById('discordClientSecret').value = cfg.discordClientSecret || '';
    document.getElementById('discordRedirectUri').value = cfg.discordRedirectUri || '';
    document.getElementById('spotifyClientId').value = cfg.spotifyClientId || '';
    document.getElementById('spotifyClientSecret').value = cfg.spotifyClientSecret || '';
    document.getElementById('adminPasswordLegend').textContent = 'Change admin password (optional)';
    document.getElementById('adminPasswordHint').textContent = 'Leave blank to keep the current password.';
  }

  async function render() {
    const status = await api('/api/setup/status');
    if (status.configured && !status.isAdmin) {
      passwordSection.hidden = false;
      configSection.hidden = true;
      return;
    }
    passwordSection.hidden = true;
    configSection.hidden = false;
    if (status.isAdmin) {
      await prefillExisting();
    } else {
      await prefillDefaults();
    }
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

  function validateConfigBody(body) {
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

  document.getElementById('configForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('configError');
    errorEl.hidden = true;

    const body = {
      discordToken: document.getElementById('discordToken').value.trim(),
      discordClientId: document.getElementById('discordClientId').value.trim(),
      discordClientSecret: document.getElementById('discordClientSecret').value.trim(),
      discordRedirectUri: document.getElementById('discordRedirectUri').value.trim(),
      spotifyClientId: document.getElementById('spotifyClientId').value.trim(),
      spotifyClientSecret: document.getElementById('spotifyClientSecret').value.trim(),
      adminPassword: document.getElementById('newAdminPassword').value,
    };

    const validationError = validateConfigBody(body);
    if (validationError) {
      errorEl.textContent = validationError;
      errorEl.hidden = false;
      return;
    }

    try {
      await api('/api/setup/save', { method: 'POST', body: JSON.stringify(body) });
      configSection.hidden = true;
      successSection.hidden = false;
      try {
        const { url } = await api('/api/setup/invite-link');
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
