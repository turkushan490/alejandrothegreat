async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

async function loadUser() {
  try {
    const { user } = await api('/auth/me');
    const el = document.getElementById('userArea');
    if (el) {
      el.innerHTML = `<span class="muted">${user.username}</span> <button class="btn" id="logoutBtn">Logout</button>`;
      document.getElementById('logoutBtn').addEventListener('click', async () => {
        await api('/auth/logout', { method: 'POST' });
        window.location.href = '/';
      });
    }
    return user;
  } catch {
    window.location.href = '/';
    return null;
  }
}
