# Jeopardy game library

Drop `.csv` or `.xlsx` game files in **this folder** and they show up in the Jeopardy setup
screen under **Game library** — click one to load it, no upload needed.

- Same column format as everything else: `Category, Value, Clue, Answer` (Value optional).
- The file name becomes the game's display name on the board (e.g. `80s Movies.csv` →
  "80s Movies"). Underscores and dashes are shown as spaces.
- This `README.md` is hidden from the listing, so it won't appear as a selectable game.

## How the list works

The setup screen asks Caddy for a JSON listing of this folder. That requires `browse` to be
enabled for `/jeopardy/games/*` in the Caddyfile (see the repo-root `README.md` and
`Caddyfile.example`). Opened locally (without Caddy) the box just says "no server library" and
the upload options still work.

## Two ways to add games

1. **Drop on the server** (fastest): `scp yourgame.csv johnnypanic@74.208.72.145:/srv/gameshow/jeopardy/games/`
   then `sudo chmod a+rX /srv/gameshow/jeopardy/games/yourgame.csv`. These files are not in git.
2. **Commit to the repo** (version-controlled / backed up): add the file here, commit, push,
   then `git pull` on the VPS.

Either way, hit **Refresh library** on the setup screen and it appears.
