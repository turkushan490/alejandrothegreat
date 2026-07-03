# Alejandrothegreat

A Discord music bot with a web dashboard. Paste a Spotify link, playlist, or
just search terms in Discord or the dashboard — the bot resolves the track
via Spotify's API for metadata and actually plays the audio from YouTube
(Spotify does not allow third-party bots to stream its audio directly, so
this is the only viable approach any Spotify-integrated Discord bot uses).

Everything is configured through the web UI — no `.env` file to hand-edit.
Log in to the dashboard with your Discord account to see every server you
share with the bot and control playback (search, queue, skip, pause,
volume, loop, shuffle) from a browser. Playback also works with `!`-style
text commands in Discord, with the prefix configurable per server.

## 1. Run it

### Docker Compose (recommended, also works on Unraid)

```bash
docker compose up -d --build
```

### Locally (Node 20+)

```bash
npm install
npm start
```

Either way, open `http://<host>:3000` (default port `3000`) once it's running.

## 2. Set it up

On first launch the site sends you straight to the **setup wizard**
(`/setup.html`). You'll need:

1. **A Discord application** — [discord.com/developers/applications](https://discord.com/developers/applications) → New Application.
   - Under **Bot**, reset the token and copy it.
   - Under **Bot**, enable **Server Members Intent** and **Message Content Intent** (the second one is required for `!`-prefix text commands).
   - Under **OAuth2 → General**, copy the Client ID and Client Secret.
   - Under **OAuth2 → General → Redirects**, add the exact redirect URI shown in the setup wizard (defaults to `http://<your-host>:3000/auth/discord/callback`).
2. **A Spotify application (optional but recommended)** — [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) → Create app. No redirect URI needed. Copy the Client ID and Client Secret. Without this, Spotify link/playlist resolution still works but with lower rate limits.
3. **An admin password** you choose yourself — this protects the setup page so nobody else can change your bot's credentials later.

Submit the form and the bot logs in immediately — no restart needed. The
wizard then shows an **"Add to your server"** button (a ready-made Discord
invite link) and a **"Login with Discord"** button to open the dashboard.

To change any of this later (rotate the bot token, add Spotify credentials,
etc.), just go back to `/setup.html` and enter your admin password.

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
| `/dj <everyone\|managers\|role\|prefix>` | (Manage Server only) Choose who's allowed to control playback, or change the text-command prefix |

## Text commands

Every playback slash command above (except `/dj`) also works as a
`!`-prefixed text command, e.g. `!play never gonna give you up`, `!skip`,
`!volume 50`. The prefix defaults to `!` and can be changed per server
either with `/dj prefix <value>` or from the **Server settings** panel at
the bottom of that server's dashboard page.

The dashboard's Server settings panel (visible to anyone with Manage
Server permission) also controls who's allowed to send control commands —
everyone, managers only, or a specific DJ role — the same setting slash
commands, text commands, and the web dashboard all respect.

## Unraid

1. Copy this project onto your Unraid box, e.g. under `/mnt/user/appdata/alejandrothegreat`.
2. Run `docker compose up -d --build` from that folder over SSH, or use the Unraid **Docker** tab to add a container mapping port `3000` and a volume for `/app/data` (this is where the SQLite database with all your settings/credentials lives — back it up).
3. Open `http://<unraid-ip>:3000/setup.html` and follow the wizard above.
4. Once the image is published to GitHub Container Registry (see `.github/workflows/docker-publish.yml`), you can instead pull `ghcr.io/<your-github-username>/alejandrothegreat:latest` directly instead of building locally.
5. An Unraid Community Applications template will be added under `unraid/` once the image is published and tested.

## Known limitations (v1)

- Sessions are stored in memory — restarting the container logs everyone out of the dashboard (the admin password and bot credentials themselves persist fine, since those live in the database).
- YouTube playback relies on `discord-player-youtubei`/`yt-dlp`, both of which can break when YouTube changes things; if playback stops working, check for updates to those packages first.
- Docker images are only tested for `linux/amd64` (standard Unraid hardware).
