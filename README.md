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

The image is built and published automatically to GitHub Container Registry
by `.github/workflows/docker-publish.yml` on every push to this repo:
`ghcr.io/turkushan490/alejandrothegreat:latest` (public, no login needed to pull).

### Install it on your own Unraid box right now

1. Unraid → **Docker** tab → **Add Container**.
2. Switch the template dropdown to **"Enter a template URL"** (top right) and paste:
   `https://raw.githubusercontent.com/turkushan490/alejandrothegreat/master/unraid/alejandrothegreat.xml`
3. It pre-fills the repository, port (`3000`), and appdata path (`/mnt/user/appdata/alejandrothegreat/data`). Apply.
4. Once it's running, open `http://<unraid-ip>:3000/setup.html` and follow the setup wizard above.

The appdata folder holds the SQLite database with your bot token, Spotify
credentials, admin password, and per-server settings — back it up, and
don't share it, it's more sensitive than a typical config file.

### Make it show up in your own Apps search (without a public listing)

Unraid → **Apps** tab → **Settings** (gear icon) → **Template repositories**
→ add `https://github.com/turkushan490/alejandrothegreat`. It'll then show
up when searching Apps on that box, same as any other installed app —
useful while iterating before (or instead of) a public listing.

### Getting it listed for everyone in Community Applications

That's a separate, manual submission through Unraid's own portal at
[ca.unraid.net](https://ca.unraid.net) — it walks you through pointing it at
this repo (it validates the template and shows a preview), and typically
also expects a support thread for the app on the Unraid forums. That step
is a judgment call for whenever the bot feels stable enough to hand to
strangers — happy to prep whatever's needed for that submission when you're
ready, but I'm not doing it unprompted since it publishes the app to
Unraid's whole userbase.

## Known limitations (v1)

- Sessions are stored in memory — restarting the container logs everyone out of the dashboard (the admin password and bot credentials themselves persist fine, since those live in the database).
- YouTube playback relies on `discord-player-youtubei`/`yt-dlp`, both of which can break when YouTube changes things; if playback stops working, check for updates to those packages first.
- Docker images are only tested for `linux/amd64` (standard Unraid hardware).
