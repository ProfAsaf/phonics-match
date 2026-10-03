# Phonics Match

A 10-minute daily phonics game for one beginning reader, built from [SPEC.md](SPEC.md). Plain HTML, CSS, and JavaScript: no dependencies and no build step. You need Node only to record, to test, and to play on your own computer.

## Play on this computer

```bash
node tools/studio-server.mjs
```

Then open http://localhost:8321/. The first launch runs the sound check, team and color picks, and the placement sweep. Hold the gear in the top-left corner for three seconds to open the parent area.

## Recording

With the same server running, open http://localhost:8321/studio.html. It lists every clip the content needs, grouped so you can record one level at a time. Each take is trimmed, leveled, and saved as `audio/<id>.wav`, and `audio/manifest.json` is updated.

Until a clip is recorded, the game plays a placeholder tone and shows a caption with the words. That way the whole game can be tried before anything is recorded. Once recording is done, turn placeholders off in the parent area; from then on, anything without a recording is left out of play.

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

`check-content` validates every content file against the spec's rules. The tests cover the mastery model, item choice, the session, and a simulated child playing whole seasons.

## Where things are

- `content/`: the word bank, nonsense words, sentences and chants, prompts, sounds, levels, and your own headlines (`custom-sentences.json`).
- `js/`: the game. Pure logic is in `mastery.js`, `choose.js`, `session.js`, and `stats.js`; the screens are in `app.js`, `activities.js`, and `parent.js`.
- `tools/`: the studio server, the nonsense-word generator, the content check, and the icon maker.
- `nonsense-review.md`: the one-time review sheet for the nonsense words.
