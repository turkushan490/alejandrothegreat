import 'dotenv/config';

// Only infra-level settings (fixed at container start) live in env vars.
// Discord/Spotify credentials are configured at runtime via the setup
// wizard and stored in the database instead - see src/db.js.
export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  dataDir: process.env.DATA_DIR || './data',
};

// Optional env vars, used only to pre-fill the first-run setup form so
// people who prefer the old .env workflow can still use it.
export const envDefaults = {
  discordToken: process.env.DISCORD_BOT_TOKEN || '',
  discordClientId: process.env.DISCORD_CLIENT_ID || '',
  discordClientSecret: process.env.DISCORD_CLIENT_SECRET || '',
  discordRedirectUri: process.env.DISCORD_REDIRECT_URI || '',
  spotifyClientId: process.env.SPOTIFY_CLIENT_ID || '',
  spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET || '',
};
