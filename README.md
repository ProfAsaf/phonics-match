# Phonics Match

A 10-minute daily phonics game for one beginning reader, built from [SPEC.md](SPEC.md). Plain HTML, CSS, and JavaScript: no dependencies and no build step. You need Node only to record, to test, and to play on your own computer.

## Play on this computer

```bash
node tools/studio-server.mjs
```

Then open http://localhost:8321/. The first launch runs the sound check, team and color picks, and the placement sweep. Hold the gear in the top-left corner for three seconds to open the parent area.

## Audio

- **Words, sentences, prompts, and commentary** come with a free AI voice (Kokoro, open source), made on a computer and published with the site in `audio/`. Words are spoken from their letters, sound by sound, so every vowel is the short one the game teaches and nonsense words come out exactly as spelled.
- **The 24 letter sounds and his goal shout** need a real voice; an AI voice can't say a bare sound well. Record them on the phone or iPad: in the parent area (hold the gear for three seconds), open Recordings → Record and make voices. Tap Record, say it, and it stops by itself; listen, then Keep. Each take is trimmed and leveled, and any other clip can be re-recorded the same way.
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

`check-content` validates every content file against the spec's rules. The tests cover the mastery model, item choice, the session, and a simulated child playing whole seasons.

## Where things are

- `content/`: the word bank, nonsense words, sentences and chants, prompts, sounds, levels, and your own headlines (`custom-sentences.json`).
- `js/`: the game. Pure logic is in `mastery.js`, `choose.js`, `session.js`, and `stats.js`; the screens are in `app.js`, `activities.js`, and `parent.js`.
- `tools/`: the studio server, the nonsense-word generator, the content check, and the icon maker.
- `nonsense-review.md`: the one-time review sheet for the nonsense words.
