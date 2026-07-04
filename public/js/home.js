(async () => {
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // If the app isn't set up yet, this is a fresh install - send the very
  // first visitor straight to the setup wizard.
  let status;
  try {
    status = await api('/api/setup/status');
  } catch {
    status = null;
  }
  if (status && !status.configured) {
    window.location.href = '/setup.html';
    return;
  }

  // Show the redirect-uri admin helper (handy for the login error).
  if (status?.redirectUri) {
    document.getElementById('redirectUri').textContent = status.redirectUri;
    document.getElementById('adminHint').hidden = false;
    document.getElementById('copyRedirect').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(status.redirectUri);
        document.getElementById('copyRedirect').textContent = 'Copied ✓';
      } catch {
        /* clipboard may be blocked on http - user can select manually */
      }
    });
  }

  // If already signed in, swap the top-right button for their name + a
  // dashboard link.
  try {
    const { user, isAdmin } = await api('/auth/me');
    const area = document.getElementById('userArea');
    area.innerHTML = `<span class="muted">${esc(user.username)}</span>
      <a class="btn" href="/dashboard.html">Dashboard</a>
      ${isAdmin ? '<a class="btn" href="/setup.html">Manage</a>' : ''}
      <button class="btn" id="logoutBtn">Logout</button>`;
    document.getElementById('logoutBtn').addEventListener('click', async () => {
      await api('/auth/logout', { method: 'POST' });
      window.location.reload();
    });
    document.getElementById('dashLink').hidden = false;
  } catch {
    // Not signed in - leave the default "Sign in with Discord" button.
  }
})();
