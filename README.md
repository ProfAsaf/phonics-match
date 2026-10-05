# Phonics Match

A 10-minute daily phonics game for one beginning reader, built from [SPEC.md](SPEC.md). Plain HTML, CSS, and JavaScript: no dependencies and no build step. You need Node only to record, to test, and to play on your own computer.

## Play on this computer

```bash
node tools/studio-server.mjs
```

Then open http://localhost:8321/. The first launch runs the sound check, team and color picks, and the placement sweep. Hold the gear in the top-left corner for three seconds to open the parent area.

## His progress

- **His player**: at first launch he picks a boy, a girl, a robot, or a friendly zombie, all in his team color. Existing progress keeps going; he is just asked to pick once.
- **Levels 1 to 7** cover first grade's phonics: short vowels; letter pairs like sh, ck, and ng; blends; silent e; vowel teams and vowels with r; endings and two-syllable words; and about 75 sight words. The parent area's "The road through first grade" shows where he is and his own pace.
- **The world map** is home: a winding path through his worlds, one per step, in twelve kinds (meadow, river, forest, snow, beach, desert, jungle, autumn, mountain, mushroom land, town, volcano). Every match is a level on the path with a flag in his color. The next world waits under clouds; signing the queen opens its gate.
- **Something new every day**: the same stops in the same order, but each match brings its own weather, things in the sky, rival keepers who dive just too late, and a mystery chest with a surprise to use that day.
- **His locker** (the jersey button on home): goals unlock balls, hats, and goal celebrations. Locked ones show how many goals open them. A gold dot means something new.
- **The match is one run** through the day's stops: the stadium, the chess castle, the crystal cave, the halftime show, the workshop, the sky islands, the night stadium, and the trophy. Questions rise on a card from the bottom; each right answer dribbles the ball toward that stop's goal, and three in a row score.
- **His letter gems** (the gem button on home): gold when mastered, blue while learning, "?" until he meets the letter. Tap a gem to hear its sound.
- **Check-ups**: about five minutes with you, every two weeks and when the level check comes due. A gold cup on the map and a gold dot on the gear mean one is due; start it in the parent area under Check-ups. Four one-minute parts: letter sounds, the sounds in a spoken word, made-up words, and a short story. You score on the gray strip at the bottom; he sees a cup match. The parent area shows his own trend lines.
- **The parent area** starts with "Who's playing" and "Where he is": his world, step, players signed, letters, and what comes next.
- **A test player**: in the parent area, tap "Test from his place" (or "Test from the beginning") to try anything without changing his progress. A "Test player" label shows until you tap "Back to" him.

The art is from Kenney (kenney.nl), free and public domain (CC0): see `art/LICENSE.txt`. The fonts are Fredoka and Andika, under the SIL Open Font License (`fonts/`).

## Audio

- **Words, sentences, prompts, and commentary** come with a free AI voice (Kokoro, open source), made on a computer and published with the site in `audio/`. Words are spoken from their letters, sound by sound, so every vowel is the short one the game teaches and nonsense words come out exactly as spelled.
- **The letter sounds and his goal shout** need a real voice; an AI voice can't say a bare sound well. Levels 1 and 2 use 24 sounds; levels 3 to 7 add 18 more: sh, ch, th (thin), th (this), qu, ng, nk, long a, e, i, o, u, oo (tube), ar, or, er, and the endings -es, -ing, and -ed. Record them on the phone or iPad: in the parent area (hold the gear for three seconds), open Recordings → Record and make voices. Tap Record, say it, and it stops by itself; listen, then Keep. Each take is trimmed and leveled, and any other clip can be re-recorded the same way.
- **Or import a file of letter sounds** with Import recordings in that screen. Sounds you may use but not share (such as a teacher's recordings that are free for use with your own child) stay out of the repo: keep them in `private/`, which git ignores, and import them on each device.
- **Export recordings** in that screen to keep a backup, since Safari can clear a site's storage. Import puts them back on this or another device.

Clips recorded on a device stay on that device and take priority over files in `audio/`. Until a clip exists, the game plays a placeholder tone with a caption. Once everything has audio, turn placeholders off in the parent area; from then on, anything without audio is left out of play.

### Remaking the free voices

After changing words or sentences, or to try another voice, make the missing clips on a computer, then publish:

```bash
node tools/make-voices.mjs
```

The first time on a computer, run it with `--setup`: that makes a Python environment and downloads the voice model (about 400 MB) to `%LOCALAPPDATA%\phonics-voice`, outside the repo. Add `--voice af_bella --redo` to remake every AI clip in another voice; Kokoro's English voices are named `af_…` and `am_…`.

Clips recorded in the studio are never replaced.

The recorder can also make clips with an OpenAI voice instead, given an API key from platform.openai.com. On a computer, the studio (open http://localhost:8321/studio.html with the server running) records straight into `audio/`.

## Put it on the phone

1. Publish the folder with GitHub Pages; any static host works.
2. Bump `VERSION` in `sw.js` on every release, including after recording new clips, so phones fetch the new files.
3. Open the site in Safari and use Share, then Add to Home Screen. Safari can clear storage for sites left unvisited, so install it. The parent area can also export progress to a file.

## Check and test

```bash
node tools/check-content.mjs
```

```bash
npm test
```

`check-content` validates every content file against the spec's rules, including that every printed word is decodable at its step. The tests cover the mastery model, item choice, the session, a simulated child playing whole seasons, and the pace of the whole curriculum (about half a minute). To see the pace for a few skill levels:

```bash
node tools/pacing.mjs
```

## Where things are

- `content/`: the word bank, nonsense words, sentences and chants, the check-up stories (`passages.json`), prompts, sounds, levels, and your own headlines (`custom-sentences.json`).
- `js/`: the game. Pure logic is in `mastery.js`, `choose.js`, `session.js`, `stats.js`, `journey.js` (the day's stops and the map's worlds and levels), `checkup.js` (when check-ups are due, their items, and their scores), and `variety.js` (each match's look, and the gear goals unlock). The drawn world is `scene.js` (the canvas and its frame loop), `map.js` (the world map), `run.js` (the day's run), `art.js` (loading Kenney's images, plus the ball designs, goals, chess pieces, and blocky friends drawn in code), and `gear.js` (hats, goal celebrations, the chest, and visitors in the sky). The screens are in `app.js`, `activities.js`, `cup.js` (the check-up's cup match), and `parent.js`.
- `art/`: Kenney's images (CC0). After adding or removing any, run `node tools/art-index.mjs` so the offline cache lists them.
- `fonts/`: Fredoka and Andika, with their licenses.
- `tools/`: the studio server, the nonsense-word generator, the content check, and the icon maker.
- `nonsense-review.md`: the one-time review sheet for the nonsense words.
