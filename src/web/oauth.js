import { getPrimaryBot } from '../db.js';

const API = 'https://discord.com/api';

// The redirect URI is derived from how the user actually reached the site
// (host header) so it always matches - whether that's 192.168.0.6:3005, a
// hostname, or a domain behind a proxy. Discord requires this exact URI to
// be registered in the app's OAuth2 settings; see redirectUriFor() callers.
export function redirectUriFromRequest(req) {
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.get('host');
  return `${proto}://${host}/auth/discord/callback`;
}

// Dashboard login is always against the first bot ever added (Discord OAuth
// needs exactly one client_id/secret) - once logged in, the dashboard still
// shows guilds across every configured bot.
export function getAuthorizeUrl(state, redirectUri) {
  const bot = getPrimaryBot();
  const params = new URLSearchParams({
    client_id: bot.discordClientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'identify guilds',
    state,
  });
  return `${API}/oauth2/authorize?${params.toString()}`;
}

export async function exchangeCode(code, redirectUri) {
  const bot = getPrimaryBot();
  const params = new URLSearchParams({
    client_id: bot.discordClientId,
    client_secret: bot.discordClientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });

  const res = await fetch(`${API}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  if (!res.ok) throw new Error(`Discord token exchange failed: ${res.status}`);
  return res.json();
}

export async function fetchUser(accessToken) {
  const res = await fetch(`${API}/users/@me`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`Failed to fetch Discord user: ${res.status}`);
  return res.json();
}

export async function fetchUserGuilds(accessToken) {
  const res = await fetch(`${API}/users/@me/guilds`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`Failed to fetch Discord guilds: ${res.status}`);
  return res.json();
}
