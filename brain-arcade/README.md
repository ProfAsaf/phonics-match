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

Opponents, weakest first: 🐣 Chick (random moves), 🐢 Turtle (rated about 400), 🦊 Fox (about 700), 🦉 Owl (about 1000) and 🐉 Dragon, whose rating follows the child's results: it starts at 1200, goes up after a win and down after a loss (bigger steps on a streak, smaller once it has settled), so it stays near the child's level as they improve.

How a rating becomes play (`strengthFor` in `js/chess.js`): one engine scores every candidate move. From 1000 up it always plays the move it thinks is best, and only the look-ahead changes: 2 moves deep (plus any captures that follow) at about 1140, one more move every 150 points or so, and as deep as it can in 2 seconds at 2000. Below 1000 it is sometimes careless, like the skill levels of the big engines: it picks a move at random with odds that favour the better ones, so it can miss a tactic or drop a piece. The engine is an alpha-beta search (iterative deepening, transposition table, null-move pruning, late-move reductions, killer and history move ordering, check extensions, quiescence) over an evaluation of material, piece placement, mobility, pawn structure, rooks on open files and king safety. It beats the previous version of the engine 85% of the time at the same depth, and it thinks in a worker thread so the screen stays smooth.

The ratings come from self-play (`node tools/chess-calibrate.mjs`): 36–100 games between neighbouring settings, anchored at 2000 = full strength, with the measured gaps scaled by 0.7 (engines playing each other spread out more than they would against people). After calibration every 200-point step won 79–88% of self-play games. The numbers are rough, on a scale like chess sites' ratings, not measured against people. `test/chess.test.mjs` checks the move generator against the standard perft counts, the position hashing, a mirror-symmetric evaluation, and that stronger levels beat weaker ones.

**Unlocks.** Only Chick is open at first; beating an animal opens the next one, and the picker shows trophies for wins. Stars from right answers open new board colours: Ocean at 25, Candy at 75, Forest at 150, Space at 250 and Gold at 400. A newly earned board is shown off and switched to when the next chess round starts, and boards can be changed in the picker (`js/chess-rewards.js`).

**Free play** (automatic in Pre-K): any piece can go to any square, the animal only nudges its pieces one step and never catches anything, and the goal is to catch all 16 of its pieces. Grown-ups can switch any child between free play and real chess in Edit player → Chess game, or open every animal at once for a strong player. The Activity tab of the report shows chess games, wins by animal and Dragon's rating.

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
- `js/chess.js`: chess rules, free play and the computer opponents. `js/chess-ui.js`: the Chess game screen. `js/chess-rewards.js`: unlocks. `js/chess-pieces.js`: the piece drawings.
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
