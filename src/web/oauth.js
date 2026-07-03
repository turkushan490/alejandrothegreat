import { getPrimaryBot } from '../db.js';

const API = 'https://discord.com/api';

// Dashboard login is always against the first bot ever added (Discord
// OAuth needs exactly one client_id/secret/redirect_uri) - once logged
// in, the dashboard still shows guilds across every configured bot.
export function getAuthorizeUrl(state) {
  const bot = getPrimaryBot();
  const params = new URLSearchParams({
    client_id: bot.discordClientId,
    redirect_uri: bot.discordRedirectUri,
    response_type: 'code',
    scope: 'identify guilds',
    state,
  });
  return `${API}/oauth2/authorize?${params.toString()}`;
}

export async function exchangeCode(code) {
  const bot = getPrimaryBot();
  const params = new URLSearchParams({
    client_id: bot.discordClientId,
    client_secret: bot.discordClientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: bot.discordRedirectUri,
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
  const res = await fetch(`${API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Failed to fetch Discord user: ${res.status}`);
  return res.json();
}

export async function fetchUserGuilds(accessToken) {
  const res = await fetch(`${API}/users/@me/guilds`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Failed to fetch Discord guilds: ${res.status}`);
  return res.json();
}
