# Alejandrothegreat

A Discord music bot with a web dashboard. Paste a Spotify link, playlist, or
just search terms in Discord or the dashboard — the bot resolves the track
via Spotify's API for metadata and actually plays the audio from YouTube
(Spotify does not allow third-party bots to stream its audio directly, so
this is the only viable approach any Spotify-integrated Discord bot uses).

Log in to the web dashboard with your Discord account to see every server
you share with the bot and control playback (search, queue, skip, pause,
volume, loop, shuffle) from a browser.

## 1. Create a Discord application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) and click **New Application**.
2. Under **Bot**, click **Reset Token** to get your bot token → `DISCORD_BOT_TOKEN`.
3. Under **Bot**, enable the **Server Members Intent** (needed to look up roles/permissions for the web dashboard).
4. Under **OAuth2 → General**, copy the **Client ID** → `DISCORD_CLIENT_ID` and **Client Secret** → `DISCORD_CLIENT_SECRET`.
5. Under **OAuth2 → General → Redirects**, add a redirect that exactly matches `DISCORD_REDIRECT_URI` in your `.env`, e.g. `http://192.168.1.100:3000/auth/discord/callback` (use your Unraid box's LAN IP).
6. To invite the bot to a server: **OAuth2 → URL Generator** → scopes `bot` + `applications.commands` → permissions `Connect`, `Speak`, `Send Messages`, `Use Slash Commands` → open the generated URL.

## 2. Create a Spotify application

1. Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) → **Create app**.
2. Any name/description works. You don't need to add a redirect URI here — this app is only used for search/metadata via client-credentials, not user login.
3. Copy the **Client ID** and **Client Secret** → `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET`.

## 3. Configure environment variables

Copy `.env.example` to `.env` and fill in the values from steps 1-2, plus:

- `SESSION_SECRET` — generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `PORT` — port the dashboard listens on (default `3000`)
- `DATA_DIR` — where the SQLite settings file is stored (mount this as a volume in Docker)

## 4. Run it

### Locally (Node 20+)

```bash
npm install
npm start
```

### Docker Compose (recommended, also works on Unraid)

```bash
docker compose up -d --build
```

This builds the image, starts the bot + dashboard, and persists guild
settings to `./data` on the host.

### Unraid

1. Copy this project (or just the `.env` you configured) onto your Unraid box, e.g. under `/mnt/user/appdata/alejandrothegreat`.
2. Either run `docker compose up -d --build` from that folder over SSH, or use the Unraid **Docker** tab to add a container pointing at the built image, mapping port `3000` and a volume for `/app/data`.
3. Once the image is published to GitHub Container Registry (see `.github/workflows/docker-publish.yml`), you can instead pull `ghcr.io/<your-github-username>/alejandrothegreat:latest` directly instead of building locally.
4. An Unraid Community Applications template will be added under `unraid/` once the image is published and tested — see that folder for submission status.

## Slash commands

| Command | Description |
|---|---|
| `/play <query>` | Play/queue a Spotify link, playlist, YouTube link, or search terms |
| `/pause` / `/resume` | Pause or resume playback |
| `/skip` | Skip the current track |
| `/stop` | Stop and clear the queue |
| `/queue` | Show the upcoming queue |
| `/nowplaying` | Show the current track with a progress bar |
| `/volume <0-100>` | Set playback volume |
| `/shuffle` | Shuffle the queue |
| `/remove <position>` | Remove a track from the queue |
| `/loop <off\|track\|queue>` | Set loop mode |
| `/dj <everyone\|managers\|role>` | (Manage Server only) Choose who's allowed to control playback |

The same permission rule applies on the web dashboard: server managers
always have control, and everyone else follows whatever `/dj` mode is set
(default: everyone can control).

## Known limitations (v1)

- Sessions are stored in memory — restarting the container logs everyone out of the dashboard.
- YouTube playback relies on `discord-player-youtubei`/`yt-dlp`, both of which can break when YouTube changes things; if playback stops working, check for updates to those packages first.
- Docker images are only tested for `linux/amd64` (standard Unraid hardware).
