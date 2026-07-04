import crypto from 'node:crypto';
import { Router } from 'express';
import { isAppConfigured, isDiscordAdmin } from '../../db.js';
import { exchangeCode, fetchUser, fetchUserGuilds, getAuthorizeUrl, redirectUriFromRequest } from '../oauth.js';

export const authRouter = Router();

authRouter.get('/login', (req, res) => {
  if (!isAppConfigured()) {
    res.redirect('/setup.html');
    return;
  }
  const state = crypto.randomBytes(16).toString('hex');
  const redirectUri = redirectUriFromRequest(req);
  req.session.oauthState = state;
  req.session.oauthRedirectUri = redirectUri; // must match at token exchange
  res.redirect(getAuthorizeUrl(state, redirectUri));
});

authRouter.get('/discord/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    // Discord itself rejected the request (e.g. redirect_uri not registered).
    const redirectUri = req.session.oauthRedirectUri || redirectUriFromRequest(req);
    res
      .status(400)
      .type('html')
      .send(oauthErrorPage(String(req.query.error_description || error), redirectUri));
    return;
  }

  if (!code || !state || state !== req.session.oauthState) {
    res.status(400).type('html').send(oauthErrorPage('The login link expired or was invalid. Please try again.'));
    return;
  }

  const redirectUri = req.session.oauthRedirectUri || redirectUriFromRequest(req);
  delete req.session.oauthState;
  delete req.session.oauthRedirectUri;

  try {
    const token = await exchangeCode(code, redirectUri);
    const [user, guilds] = await Promise.all([fetchUser(token.access_token), fetchUserGuilds(token.access_token)]);

    req.session.user = { id: user.id, username: user.username, avatar: user.avatar };
    req.session.guilds = guilds.map((g) => ({ id: g.id, name: g.name, icon: g.icon, permissions: g.permissions }));

    // A Discord user the owner has granted admin rights to gets bot-management
    // access without needing the admin password.
    if (isDiscordAdmin(user.id)) {
      req.session.isAdmin = true;
    }

    res.redirect('/dashboard.html');
  } catch (err) {
    console.error('[web] OAuth callback failed:', err);
    res.status(500).type('html').send(oauthErrorPage('Login failed during token exchange. Please try again.', redirectUri));
  }
});

authRouter.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

authRouter.get('/me', (req, res) => {
  if (!req.session.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  const isAdmin = Boolean(req.session.isAdmin) || isDiscordAdmin(req.session.user.id);
  res.json({ user: req.session.user, isAdmin });
});

function oauthErrorPage(message, redirectUri) {
  const hint = redirectUri
    ? `<p class="muted">Admins: make sure this exact URL is added under <strong>OAuth2 &rarr; Redirects</strong> in the Discord Developer Portal:</p>
       <code style="display:block;padding:12px;margin:8px 0;word-break:break-all;">${redirectUri}</code>`
    : '';
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Login failed</title>
    <link rel="icon" href="/favicon.png"><link rel="stylesheet" href="/css/style.css"></head>
    <body><div class="center-screen"><div class="card login-card" style="max-width:520px">
      <h1>😬 Login hiccup</h1>
      <p class="subtitle">${message}</p>
      ${hint}
      <a class="btn btn-discord" href="/auth/login">Try again</a>
      <p class="muted" style="margin-top:14px"><a href="/">Back home</a></p>
    </div></div></body></html>`;
}
