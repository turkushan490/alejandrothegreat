import crypto from 'node:crypto';
import { Router } from 'express';
import { exchangeCode, fetchUser, fetchUserGuilds, getAuthorizeUrl } from '../oauth.js';

export const authRouter = Router();

authRouter.get('/login', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  req.session.oauthState = state;
  res.redirect(getAuthorizeUrl(state));
});

authRouter.get('/discord/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state || state !== req.session.oauthState) {
    res.status(400).send('Invalid OAuth state. Please try logging in again.');
    return;
  }
  delete req.session.oauthState;

  try {
    const token = await exchangeCode(code);
    const [user, guilds] = await Promise.all([fetchUser(token.access_token), fetchUserGuilds(token.access_token)]);

    req.session.user = { id: user.id, username: user.username, avatar: user.avatar };
    req.session.guilds = guilds.map((g) => ({ id: g.id, name: g.name, icon: g.icon, permissions: g.permissions }));

    res.redirect('/dashboard.html');
  } catch (err) {
    console.error('[web] OAuth callback failed:', err);
    res.status(500).send('Login failed. Please try again.');
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
  res.json({ user: req.session.user });
});
