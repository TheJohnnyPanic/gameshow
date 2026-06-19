# Game Show — gameshow.thecultofbrighterdays.org

A self-hosted hub of browser-based party games, projected on a TV at **Pop In Off, Tucson**.
The root page is a landing hub; each game lives in its own subfolder and is reachable at a
subpath. First game: **Jeopardy**.

```
gameshow/                     ← repo root = web root (served at /srv/gameshow)
├── index.html                ← the hub landing page (edit SITE + GAMES inside it)
├── jeopardy/                 ← /jeopardy/  — the Jeopardy board
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   ├── sounds/               ← optional audio (gitignored; see its README)
│   └── README.md             ← game-specific docs
├── Caddyfile.example         ← the Caddy site block to add
├── README.md                 ← this file
└── .gitignore
```

**Adding a game later:** drop a new folder (e.g. `feud/` with its own `index.html`), then add
one entry to the `GAMES` array in the hub's `index.html`. That's the whole workflow.

---

## Deploy to the VPS (IONOS `gameserver`, 74.208.72.145)

Caddy already runs as **systemd** with its config at `/etc/caddy/Caddyfile`, serving 80/443
from the host filesystem — so this is the simple path: put the files where Caddy can read
them, add a site block, reload.

### 1. DNS — point the subdomain at the VPS

`thecultofbrighterdays.org` is a **separate domain** from the afraid.org `twilightparadox.com`
records (which are at their 5-record cap), so this doesn't touch that limit. At whatever DNS
host manages `thecultofbrighterdays.org`, add:

| Type | Host       | Value           | TTL     |
|------|------------|-----------------|---------|
| A    | `gameshow` | `74.208.72.145` | default |

The VPS has a static IP, so no DDNS is needed — a plain A record is permanent.

### 2. Put the files on the VPS

```bash
sudo mkdir -p /srv/gameshow
sudo chown -R johnnypanic:johnnypanic /srv/gameshow

# clone the repo into the web root (use your actual repo URL)
git clone git@github.com:TheJohnnyPanic/gameshow.git /srv/gameshow

# audio is gitignored — drop the sound files in by hand (see jeopardy/sounds/README.md)
# then make sure the caddy user can read everything:
sudo chmod -R a+rX /srv/gameshow
```

> `/srv` is used (not `/home`) because home dirs are usually `750`, which blocks the `caddy`
> user from reading the files. `/srv/gameshow` + `a+rX` keeps Caddy able to serve them.

### 3. Add the Caddy site block

Append the block from `Caddyfile.example` to `/etc/caddy/Caddyfile`:

```caddy
gameshow.thecultofbrighterdays.org {
    root * /srv/gameshow
    encode gzip zstd
    file_server {
        hide .git* Caddyfile.example *.md
    }
}
```

Then validate and reload:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Caddy fetches the Let's Encrypt cert automatically on the first request once DNS resolves.

### 4. Verify

- `https://gameshow.thecultofbrighterdays.org/` → the hub
- `https://gameshow.thecultofbrighterdays.org/jeopardy/` → the board

---

## Updating the site

```bash
cd /srv/gameshow && git pull
sudo chmod -R a+rX /srv/gameshow   # only needed if new files were added
```

No Caddy reload is needed for content changes — only when you edit the Caddyfile.

*(Later option: mirror your existing Wundurground `webhook` auto-deploy service so a `git push`
triggers the pull on the VPS automatically. Say the word and I'll wire that up.)*

---

## License

Code: MIT (or your choice). Third-party audio under `jeopardy/sounds/` keeps its own license.
