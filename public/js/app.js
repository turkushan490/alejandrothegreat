async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

const escHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// The three nav items are always present; only their labels change when you're
// not signed in, so the menu doubles as the "how do I log in" prompt.
function navHtml({ signedIn, isAdmin }) {
  const p = location.pathname;
  const homeActive = p === '/' || p === '/index.html';
  const dashActive = p.startsWith('/dashboard') || p.startsWith('/guild');
  const manageActive = p.startsWith('/setup');
  const item = (href, label, active) => `<a href="${href}"${active ? ' class="active"' : ''}>${label}</a>`;
  return [
    item('/', 'Home', homeActive),
    signedIn
      ? item('/dashboard.html', 'Dashboard', dashActive)
      : item('/auth/login', 'Log in for dashboard', dashActive),
    isAdmin
      ? item('/setup.html', 'Manage bots &amp; admin', manageActive)
      : item('/setup.html', 'Log in as admin', manageActive),
  ].join('');
}

function renderTopbar(auth) {
  const nav = document.getElementById('topnav');
  if (nav) nav.innerHTML = navHtml({ signedIn: !!auth.user, isAdmin: !!auth.isAdmin });

  const area = document.getElementById('userArea');
  if (!area) return;

  if (auth.user) {
    // Signed in with Discord.
    area.innerHTML = `<span class="muted">${escHtml(auth.user.username)}</span> <button class="btn" id="logoutBtn">Logout</button>`;
    document.getElementById('logoutBtn').addEventListener('click', async () => {
      await api('/auth/logout', { method: 'POST' });
      window.location.href = '/';
    });
  } else if (auth.isAdmin) {
    // Owner logged in with the admin password (no Discord user attached).
    area.innerHTML = `<span class="muted">Admin</span> <button class="btn" id="logoutBtn">Logout</button>`;
    document.getElementById('logoutBtn').addEventListener('click', async () => {
      await api('/api/setup/logout', { method: 'POST' });
      window.location.href = '/';
    });
  } else {
    area.innerHTML = `<a class="btn btn-discord" href="/auth/login">Sign in with Discord</a>`;
  }
}

// Load the auth/setup state once per page and render the shared top bar.
// Exposed as a promise so page scripts can reuse it instead of re-fetching.
const authReady = (async () => {
  const auth = { user: null, isAdmin: false, signedIn: false, status: null };
  try {
    const status = await api('/api/setup/status');
    auth.status = status;
    auth.isAdmin = !!status.isAdmin;
    auth.signedIn = !!status.signedIn;
  } catch {
    /* setup status is best-effort; leave the logged-out defaults */
  }
  if (auth.signedIn) {
    try {
      const me = await api('/auth/me');
      auth.user = me.user;
      auth.isAdmin = me.isAdmin || auth.isAdmin;
    } catch {
      /* ignore */
    }
  }
  renderTopbar(auth);
  return auth;
})();

// For pages that require a signed-in Discord user (dashboard, guild).
async function loadUser() {
  const auth = await authReady;
  if (!auth.user) {
    window.location.href = '/';
    return null;
  }
  return auth.user;
}
