# Pop In Off — Jeopardy Board

A web-based Jeopardy-style game board for running trivia nights at **Pop In Off (Tucson)**.
Built to be projected on a TV from an iPad. Buzz-in and scoring are handled separately by
**[Buzzonk](https://buzzonk.com)** — this app only displays the board and clues, so the two
stay decoupled (no integration, nothing to break mid-game).

## Features

- Classic 6×5 Jeopardy board, readable across a room on a TV
- **Spreadsheet import** — CSV (offline-safe, no dependencies) or `.xlsx`
- **Daily Double** — one random tile armed per game; gold splash, value doubled
- **Origin-aware zoom** — tap a tile and the clue zooms *from that tile* to fill the screen,
  then zooms back when you mark it answered
- Host-only "Reveal answer," misclick-safe close, board reset / re-roll
- No scoring (that's Buzzonk's job)

## Running it

1. Open `index.html` in a browser. On the iPad, open it in Safari and mirror to the TV
   (AirPlay to an Apple TV, or a USB-C/Lightning-to-HDMI adapter).
2. A sample game is pre-loaded, so it plays immediately.

> The files reference each other relatively (`styles.css`, `app.js`), so keep them together
> in the same folder. Opening `index.html` directly from the folder (`file://`) works fine.

### Hosting on the VPS (optional)

Drop the folder behind Caddy and serve it at e.g. `jeopardy.wundurland.com`:

```caddy
jeopardy.wundurland.com {
    root * /var/www/popinoff-jeopardy
    file_server
}
```

## Question format

One row per clue. Header row must include **Category**, **Clue**, and **Answer**
(**Value** optional — blank values auto-fill 200 → 1000 in row order).

| Category | Value | Clue | Answer |
|----------|-------|------|--------|
| Science  | 200   | This planet is the Red Planet | What is Mars? |

- **Clue** = what shows on the board (the prompt you read).
- **Answer** = the correct response, revealed host-side only.
- The in-app **Download CSV template** button gives you a correctly-formatted starter file.
- CSV is the offline-safe format; `.xlsx` needs the iPad to have briefly cached the reader.

## Project structure

```
popinoff-jeopardy/
├── index.html      # markup
├── styles.css      # all styling (Jeopardy blue/gold theme)
├── app.js          # board logic, CSV/XLSX import, zoom, Daily Double
├── sounds/         # drop optional audio here — see sounds/README.md
├── README.md
└── .gitignore
```

## Controls

| Action | Result |
|--------|--------|
| Tap a tile | Clue zooms from the tile to fullscreen |
| Reveal answer / `Space` | Show the correct response (host) |
| Mark answered & return / `Enter` | Zoom back, grey the tile |
| × / `Esc` | Close without marking (misclick escape) |
| ↺ Reset board | Clear tiles + re-roll a fresh Daily Double |
| ⚙ Setup | Back to the load screen |
| ▶ Think music | Loop the think music while someone's stumped (toggle) |
| ⏱ Time's up | Stop the music and hit the buzzer |
| 🔊 Sound | Mute / unmute all audio (remembered between sessions) |

## Sound

Audio is **optional** and lives in `sounds/`. Drop in up to five files (think music, a
Daily Double sting, a select blip, a correct ding, and a time's-up buzzer) and they wire up
automatically; anything missing just stays silent. See **[`sounds/README.md`](sounds/README.md)**
for the exact filenames, free/commercial-use sources (Pixabay, Mixkit), and licensing notes.

The real *Jeopardy!* theme is copyrighted — use the royalty-free *think*-style tracks the
sounds README points to instead.

## License

Code: MIT (or your choice). Any third-party audio you add under `sounds/` keeps its own
license — see `sounds/README.md`.
