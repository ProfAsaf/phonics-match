# Brain Arcade

A math-and-reading game for kids from Pre-K through about 4th grade. Kids pick a game (Balloon Pop, Chess, Monster Munch, Rocket Ride) and Math or Reading; the questions inside adapt to each child's level, skill area by skill area. A grown-up area shows grade-level estimates by category, like IXL's diagnostic strands and DIBELS' measures, plus progress over time.

Plain HTML, CSS and JavaScript: no build step, no server, no accounts. Everything is saved on the device.

## Play it

On this computer, and on an iPad or phone on the same Wi-Fi:

```bash
node tools/serve.mjs
```

It prints the addresses to open (Windows may ask once to let Node through the firewall: allow private networks). Any static web server works too.

To keep it on the iPad for good, publish the folder (GitHub Pages, like the other games), open it in Safari, and use **Share → Add to Home Screen**. That also keeps Safari from clearing its saved progress.

## First-time setup (grown-up)

1. Tap **Set up players** and add each child: name, grade, picture.
2. Optional but worthwhile: open **School scores** and enter the IXL LevelUp numbers and the DIBELS color bands from the school reports. The first level check then starts near the right place and finishes more accurately.
3. Hand over the device. The first time a child picks Math or Reading, the game runs a **level check** for that subject: 30 questions from 1st grade up (three rounds of ten), 20 in kindergarten and 14 in Pre-K (two rounds), with no right/wrong feedback and a "🤔 Not sure" button. The ribbon shows "round 1 of 3" and so on, and it can be spread over several sittings. In practice it always runs to the full length: each of the 6 math and 7 reading strands needs a few answers.

Later, hold the ⚙️ on the "Who's playing?" screen for two seconds to open the grown-up area.

## How it adapts

Every skill area ("strand") has its own level on a grade scale: 0 = start of kindergarten, 1 = start of 1st grade, 2.5 = middle of 2nd grade, negative = Pre-K. Like IXL's diagnostic, a level of 2.7 (shown as **270**) means "ready to learn late-2nd-grade skills": easier skills are mostly mastered.

- Each question has a difficulty on the same scale. After every answer the game updates a probability distribution over the child's level in that strand, allowing for lucky guesses and slips (`js/model.js`). Between days it widens a little, so it follows a child who is learning.
- **Level check:** each question is the one expected to teach the game the most about the child (`bestB`). Strands far outside the child's range are skipped; later strands start from what earlier ones showed.
- **Practice:** most questions are pitched so the child gets about 80% right, some easier (review) and some harder (stretch). Two misses in a row make the next question easier. Wrong answers get a second try, then the right answer and a one-line explanation.
- Questions that test reading never read the text aloud; listening and math questions are read aloud for children who aren't reading fluently yet (adjustable per child).

Simulated children (`test/sim.test.mjs`) check that the level check lands within about a quarter grade when school scores are entered, and within about 0.4 grade without them.

## Chess

The Chess game is a real game of chess against a computer animal. The child plays white; each right answer earns one move (during a level check, every answer does), then the animal replies. The question panel slides away for each move. Pieces move by tap-tap or drag, with dots showing where a piece can go; castling, en passant, promotion, check, checkmate and the draw rules all work. The game is saved, so it carries on from round to round until someone wins; 🏳️ starts a new one.

Opponents, weakest first: 🐣 Chick (random moves), 🐢 Turtle (grabs pieces, looks one move ahead), 🦊 Fox (two moves, sees simple traps), 🦉 Owl (three moves), 🐉 Dragon (four moves, plays carefully). The picker suggests the first animal the child hasn't beaten yet and shows trophies for wins. `test/chess.test.mjs` checks the move generator against the standard perft counts and that each animal beats the weaker ones.

## Strands

| Math (IXL strands) | Reading (DIBELS measures and more) |
|---|---|
| Counting & number sense (Pre-K–K) | Letters & letter sounds (LNF) |
| Operations & algebraic thinking | Phonemic awareness (PSF) |
| Number & operations in base ten | Phonics & decoding (NWF) |
| Fractions | Sight words (WRF) |
| Measurement & data | Vocabulary |
| Geometry | Comprehension (Maze, passages, listening) |
| | Spelling |

The report shows each strand's level, the likely range, the typical level for the child's grade today, and the starting point from school scores. Tap a strand for its skills (mastered / working on / coming next) and its history.

**Read-aloud check** (grown-up area): a one-minute oral reading fluency check, like the DIBELS ORF part. The child reads a story aloud while you tap any word they miss; the result is words correct per minute, compared with Hasbrouck & Tindal's (2017) norms.

## Files

- `js/model.js`: the ability model. `js/engine.js`: starting levels, level check, question choice, scoring, report numbers.
- `js/curriculum.js`: subjects and strands. `js/gen/math.js`, `js/gen/reading.js`: about 80 question generators.
- `js/play.js`: the play screen. `js/games.js`: the game worlds. `js/app.js`: kid screens. `js/parent.js`: grown-up area.
- `js/chess.js`: chess rules and the computer opponents. `js/chess-ui.js`: the Chess game screen. `js/chess-pieces.js`: the piece drawings.
- `content/`: word lists, phonemic-awareness picture words, vocabulary, Maze items, sentences, passages, listening stories, fluency passages. `phonics1.json` and `nonsense1.json` come from Phonics Match.
- `fonts/`: Fredoka and Andika (SIL Open Font License).

## Tests

```bash
npm test                    # generators (every skill, across its range), simulated children, chess rules
node tools/ui-test.mjs      # plays the real game in headless Chromium at iPad and iPhone sizes
node tools/ui-test.mjs chess  # chess only: a level-check round, the saved game, Home mid-move, checkmate
```

The UI test uses the Chromium that Playwright installs, saves screenshots to `%TEMP%\brain-arcade-shots`, and deletes its browser profiles when it ends.

## Publishing

The game is live at **https://profasaf.github.io/phonics-match/brain-arcade/**. It is served from a `brain-arcade/` folder in the Phonics Match repo (ProfAsaf/phonics-match); this folder stays the source. To release:

1. Bump `VERSION` in `sw.js` so installed copies pick up the new files.
2. Copy the site over, then commit and push only that folder from the phonics repo:

```bash
node tools/publish.mjs
cd ../phonics && git add brain-arcade && git commit -m "Brain Arcade: ..." && git push
```
