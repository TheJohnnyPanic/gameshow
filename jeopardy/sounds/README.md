# Sounds

The board looks for these five files in this folder. **All are optional** — any that
are missing simply don't play, so the game works with or without audio.

| File the app expects | When it plays | Suggested clip |
|----------------------|---------------|----------------|
| `think-music.mp3`    | "Think music" toggle in a clue (loops) | Pixabay → "Thinking Time" or a game-show *think* track, ~30–60s |
| `daily-double.mp3`   | When the Daily Double splash appears | Mixkit → "Game Show Game Win Orchestra" (a short fanfare/sting) |
| `select.mp3`         | When any clue is opened | Mixkit → "Beep Click Arcade … Game Show" (a soft blip) |
| `correct.mp3`        | When the answer is revealed | Mixkit → "Game Show Correct" / "Notification Correct" (a ding) |
| `times-up.mp3`       | The "Time's up" button | Mixkit → "Buzzer Game Show Error Wrong" |

The filenames are the only thing that matters — download whatever clips you like, then
**rename them to match the table above.**

## Where to get them (free, commercial-use OK)

- **Pixabay** — <https://pixabay.com/sound-effects/search/game-show/> and
  <https://pixabay.com/music/search/game%20show/>
  Free for commercial use, **no attribution required**. Best choice for the *think* music.
- **Mixkit** — <https://mixkit.co/free-sound-effects/game-show/>
  Free under the Mixkit License, no sign-up, no attribution. Good for the short SFX.

> Do **not** use the real *Jeopardy!* "Think!" theme — it's copyrighted (Merv Griffin / Sony)
> and you'd be performing it publicly at the store. The royalty-free *think*-style tracks above
> sound the part and are licensed for this.

## WAV instead of MP3?

Browsers play both. If you'd rather use `.wav`, change the extensions in the `FILES` map at
the top of `../app.js` (one spot) and name your files accordingly. MP3 is smaller and the
download sources above already give you MP3, so it's the easier path.

## Why these files aren't in the repo

`.gitignore` excludes audio binaries. That keeps the repo lean and sidesteps stock-audio
redistribution terms (e.g. Mixkit forbids redistributing their files *as standalone files*,
which a public repo could count as). Download them straight into this folder on each machine
that runs the board.

## A note on MIDI

MIDI files won't play in a browser without a JS synth + soundfont (e.g. Tone.js or
html-midi-player). That's a heavier add than this needs, so the app is wired for WAV/MP3.
If you ever want a true MIDI path, that's a separate feature we can bolt on.
