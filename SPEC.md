# Phonics Game: Build Spec

Oct 2, 2026 · @Asaf Bernstein

## Purpose and learner

A 10-minute daily phonics game for one beginning first grader, built to turn letter knowledge into word reading. He knows letter names well. His DIBELS results were somewhat low on phoneme segmentation and lower on nonsense-word decoding.

The game trains three separate skills and the reading they add up to. When he misses an item, the app records which skill failed, not only that the item was wrong.

| Skill | What it is | Starting point |
| --- | --- | --- |
| Letter sounds | See a letter, know its sound | Unknown; strong letter names do not guarantee sounds |
| Blending | Join separate sounds into a word | Likely weak; nonsense-word decoding was his lowest score |
| Segmenting | Break a spoken word into its sounds | Somewhat low |
| Decoding | Letter sounds plus blending, on a printed word | The target outcome |

This is not a DIBELS replica. Most practice uses real words he has not memorized, with nonsense words mixed in to catch guessing.

## Ground rules

Every feature has to respect these eight rules. Where a later section seems to conflict with one, the rule wins.

1. **The app scores only what it can check.** Taps are scored by the app. Anything he says aloud is scored by a parent's tap, or not scored.
2. **No speech recognition.** Recognizers return dictionary words, so a correctly read "mip" comes back as "map."
3. **Every isolated sound is a recorded clip.** Text-to-speech says the letter name ("em"), not the sound ("mmm").
4. **Instructions are spoken, never written.** He cannot read them yet. Every screen has one replay button.
5. **Only decodable text.** Every printed word uses letter-sounds already introduced, plus the taught sight words.
6. **Only first attempts count toward mastery.** A correct answer after help is logged as assisted.
7. **No timers, lives, or penalties on the child's screens.** Activities end on item counts. Every number he sees only goes up: goals, words, squad value. No percentages.
8. **He can run the solo part alone.** Large targets, a confirm button to absorb stray taps, no menus.

## Session flow

One session is six activities in a fixed order, about 32 items, which takes roughly 10 minutes. The order never changes, so the routine becomes familiar.

| # | Activity | Items | Print on screen | Scored by | Trains |
| --- | --- | --- | --- | --- | --- |
| 1 | Sound match | 6 | Single letters | App | Letter sounds |
| 2 | Blend it | 5 | None | App | Blending |
| 3 | Find the sound | 5 | None | App | Segmenting |
| 4 | Build it | 4 | Letter tiles | App | Segmenting and letter sounds |
| 5 | Read and find | 6 | Words | App | Decoding |
| 6 | Read aloud | 6 words, 1 sentence | Words | Parent, or unscored | Decoding |

The start screen has two picture buttons, spoken as "Just me" and "With a grown-up." The choice changes only how activity 6 is scored.

Item counts live in one config object. The pitch shows how far along he is, with no clock. Halftime, between activities 3 and 4, is the team chant. The app never prompts for a second session.

## Game layer

His team is chess pieces playing soccer, and every number on screen is one he can count or add. Soccer drives the moment-to-moment play, chess is the collection, math is the scorekeeping, and a sing-along chant marks halftime. After the match, goals become blocks in a world he builds.

### The match

- A session is a match in two halves: activities 1 to 3, then 4 to 6.
- The progress path is the pitch. Every first-try correct answer is a pass.
- Three passes in a row make a goal, with a celebration of two seconds or less.
- A miss ends the move and costs nothing. The correction routine is the coach showing the play, and the next answer starts a new move.
- Unscored items count as passes.
- There is no opponent and no way to lose.
- At full time the screen shows the two halves as a sum, such as 4 + 3, and he taps the total. The answer is shown either way and added to his season goals.

### The team chant

- At halftime the team sings a chant of two to four lines. The words show on screen and a soccer ball bounces from word to word on the beat.
- Lyrics are original and decodable at his current step, plus sight words. Every word at levels 1 and 2 is one syllable, so each word gets one beat.
- The app makes the music itself with Web Audio: a drum beat and a simple tune, with no music files. Tunes are public-domain nursery melodies he already knows.
- It plays twice. On the first pass each word's recorded clip plays on its beat. On the second pass only the music plays, and he sings.
- One or two words change every match, such as the player's name or the action word. He has to read the line and cannot recite it.
- Each step unlocks a new verse. Example for step 1B, to the tune of "Twinkle, Twinkle, Little Star": "Tap it, tap it, tap it, Tim. Rip it, rip it, rip it in."
- The chant is unscored. Tempo is a setting and starts slow, at about 70 beats per minute.

### The squad

- Each nonsense word is a player's name. A player is a chess piece with a jersey number.
- He signs a player by reading or picking its name correctly on the first try. Unsigned players show as silhouettes in the squad album.
- Card values are the chess ones: pawn 1, knight 3, bishop 3, rook 5, queen 9. The album shows squad value as a running sum.
- Each step has ten players: six pawns, a knight, a bishop, a rook, and a queen.
- The queen is the promotion. She can be signed only when the step is mastered, and signing her is the ceremony for moving up.
- The king is goalkeeper and captain from the first day.

### The word book

- Every real word he reads correctly on a first try goes into his word book, once. The home screen shows the count.
- At 10, 25, 50, and 100 words his block world gets bigger.

### The block world

- After full time he builds in a saved grid world with sky and ground. The look is blocky and pixel-style, with no names, characters, or art from Minecraft.
- Each goal earns one block to place. Old blocks can be moved at any time.
- The blocks come from his word book: every pictured word he has read is a kind of block, such as log, net, bed, web, pig, and sun.
- The palette shows each block as its printed word, in shuffled order. He has to read "log" to pick the log.
- Build it is styled as crafting. Letter blocks go into a crafting row, and a correct word crafts its picture.
- The blocky style applies to scenery only. Words he reads stay in the clear print font.
- Building happens outside the ten minutes and is unscored.

### His own stamp

- He names the team and picks the kit color at first launch.
- He records his own goal shout on the recording page.
- A parent records about ten commentary lines, such as "What a pass!" They rotate with his shout on goals.

### The headline

- The closing sentence of each match is a silly headline, shown with emoji once he has read it.
- A parent can add sentences to a custom file, such as "Dad is a big pig." The app checks every word against his current step and flags any he cannot decode yet.

### Pace and art

- Celebrations and the full-time sum get at most one minute of a match. The chant adds about half a minute and counts as reading.
- Any celebration can be skipped with a tap.
- After three sessions a short sound cue replaces each spoken prompt. The replay button still plays the full prompt.
- Pieces are the Unicode chess symbols in his kit color, forced to text style so iOS does not swap in emoji. The pitch is drawn in CSS.

## Activities

Four of the six share one screen pattern: a spoken prompt, two to four choices, and a confirm button. Tapping a choice selects it and plays its audio; confirm submits. A first-try correct answer is a pass up the pitch. A miss gets no buzzer, only the correction routine at the end of this section.

### 1. Sound match

- **Prompt:** one recorded sound, such as /m/.
- **Response:** he taps the matching lowercase letter from four.
- **Reverse form, every other item:** he sees one letter and picks its sound from three speaker buttons. This is the direction reading uses.
- **Wrong choices:** letters he has confused before, then look-alikes (b, d, p) and sound-alikes (m, n). Never show c and k together.
- **Priority letters:** those whose names mislead, namely c, g, h, w, y, and the five vowels.
- **Records:** hit or miss on that letter-sound, plus what he picked instead.

### 2. Blend it

- **Prompt:** the sounds of a word, one clip at a time, 0.7 seconds apart: /s/ /u/ /n/. No print.
- **Response:** he taps the matching picture from three. Tapping a picture says its name.
- **Wrong choices:** pictures sharing the first sound where possible (sun: sock, six), so one sound alone never gives the answer.
- **Order:** words starting with a sound he can stretch (m, s, f, n, r, l) come first. Stop sounds (b, d, g, p, t, c) follow.
- **Records:** blending hit or miss, tagged continuous-first or stop-first.

### 3. Find the sound

- **Prompt:** a whole spoken word, with three boxes on screen and one box glowing.
- **Response:** he picks the sound for the glowing box from three speaker buttons.
- **Wrong choices:** the word's other two sounds, so the task tests position. Skip words that repeat a sound, such as dad.
- **Order:** first sound, then last, then middle.
- **Records:** segmenting hit or miss, by position.

### 4. Build it

- **Prompt:** a whole spoken word, one empty box per sound, and a tray of five or six letter tiles.
- **Response:** he taps tiles into the boxes, then confirms. A placed tile plays its sound; tapping it again returns it.
- **Tray:** the word's letters plus two or three extras, always including one other vowel.
- **After a correct build:** the tiles slide together, the word is spoken, and its picture is crafted if it has one.
- **Records:** the first tile placed in each box. A wrong tile counts against that letter-sound if it is not yet mastered, otherwise against segmenting at that position.

### 5. Read and find

- **Real words:** he sees one printed word and taps its picture from three (pin: pan, pig). The word is not spoken until he answers.
- **Nonsense words:** he hears the word and taps its printed form from four (tig: tag, pig, tip). One wrong choice differs in each position, where the bank allows.
- **Mix:** four real, two nonsense.
- **Help:** a dot sits under each letter of a single printed word and lights up silently when touched. An ear button makes the dots play their sounds for that item, and each sound played is logged as help.
- **Records:** decoding hit or miss. On a miss, the position that differed and the two letters confused.

### 6. Read aloud

- **Prompt:** one printed word with dots under the letters. He touches each dot while saying its sound, then says the whole word.
- **With a grown-up:** three small gray buttons along the bottom edge: "Read it," "Sounds right, blend wrong," and "Sound wrong." After the third, the parent taps the letters he missed.
- **Just me:** he says the word, then taps it to hear it and check himself. Nothing is scored.
- **Mix:** four real words, two nonsense, then one decodable sentence where the parent taps any word missed.
- **Records, parent mode only:** decoding hit or miss, a blending miss when the sounds were right, and a letter-sound miss on each marked letter.

### Correction routine

A first-try miss never just shows the answer. The app runs four steps:

1. Light each letter or box of the target while its sound plays, then play the whole word. Keep this under five seconds.
2. Remove the wrong choice and let him answer again.
3. On a second miss, replay the sounds with shrinking gaps, 0.7 seconds then 0.3, show the answer, and move on.
4. Bring the item back once more, at least three items later.

## Audio

All audio is recorded files in the repo, in a parent's voice; the app does no speech synthesis. Levels 1 and 2 need three sets.

| Set | Clips | Contents |
| --- | --- | --- |
| Sounds | 24 | 18 consonant sounds, /ks/ for x, and 5 short vowels |
| Prompts | About 20 | "Listen. What word?", "First sound?", praise lines |
| Words | About 200 | Every real word, nonsense word, picture name, and sentence |

### Recording page

Build a dev-only recording page before the game. It reads the content files and lists every clip they require. For each clip it shows what to say, records, plays back, and saves the file under the right name in the audio folder. It trims silence, evens out loudness, and shows which clips are still missing. For a nonsense word it shows a rhyme hint ("mip, rhymes with lip").

An item is eligible for play only when all of its audio exists. Recording can then proceed one level at a time.

### How to say the sounds

Show these notes on the recording page. Clean sounds matter more than anything else in the app.

- **Stretchable sounds** (f, l, m, n, r, s, v, z, and the vowels): hold for one second. "Mmm," not "muh."
- **Stop sounds** (b, d, g, k, p, t) and j: short and clipped, with as little "uh" as possible.
- **h, w, y:** h is a breath; w and y are quick, with no vowel after.
- **Short vowels:** a as in apple, e as in bed, i as in itch, o as in octopus, u as in up.
- **Words:** once, at normal speed, clearly.
- **Consistency:** one voice, one quiet room, same distance from the microphone.

## Content

Build levels 1 and 2 now. Levels 3 to 6 are listed so the data format can hold them later.

| Level | New letter-sounds | Examples |
| --- | --- | --- |
| 1 | Short a, then short i; consonants b, c, d, f, g, h, l, m, n, p, r, s, t | map, fan, sit, pin; nonsense: mip, fim |
| 2 | Short o, then u, then e; consonants j, k, v, w, x, y, z | hot, sun, bed; nonsense: lom, nup, teg |
| 3 | sh, ch, th, wh, ck, qu; doubled ff, ll, ss, zz | ship, chat, duck, bell |
| 4 | Consonant blends, first and last | stop, frog, clap, best |
| 5 | Silent e | make, bike, hope, cute |
| 6 | Common vowel teams | rain, boat, feet |

Each vowel is its own step: 1A (a), 1B (i), 2A (o), 2B (u), 2C (e). A step's words mix in every earlier vowel, because telling the vowels apart is the hard part.

### Word bank

Each entry lists its letters and its sounds separately, so later levels can hold two-letter spellings such as sh.

```json
{ "word": "map", "letters": ["m", "a", "p"], "sounds": ["m", "a", "p"],
  "real": true, "step": "1A", "picture": "emoji, optional" }
```

- **Size:** about 25 real words and 10 nonsense words per step, plus 5 nonsense words per level held back for the level check.
- **Real words:** every letter makes its taught sound. That rule excludes was, put, son, his, car, saw, cow, and day.
- **Oral activities:** activities 2 and 3 show no print, so they may use any word whose sounds have clips, whatever its spelling (sock, duck, bell).
- **The letter x:** one tile and one box, played with the /ks/ clip. Leave x words out of Find the sound.
- **Neighbors:** computed from the bank as words that differ from the target in exactly one position. A picture task with fewer than two pictured neighbors falls back to pictures sharing the first sound.

### Nonsense words

Generate candidates in code, filter them, save the list to a file, and have a parent review it once. The game never invents words while running.

- Consonant, vowel, consonant, using only the step's letters.
- The last letter is b, d, g, m, n, p, or t. Other endings change the vowel or break English spelling habits.
- Use c only before a, o, u, and k only before e, i. No g before e or i. No a after w.
- Not a real word, name, abbreviation, or slang term (lat, sim, fab).
- Not a sound-alike of a real word (kat, sed, wun), and nothing rude.

### Sight words and sentences

Sentences need six words he cannot decode yet: the, a, I, is, his, to. Each is shown and spoken before the first sentence that uses it, and has no sound dots. Every other word in a sentence must be decodable at his current step.

Write about 20 sentences, four per step, and one chant verse per step. Examples: "The cat sat." "The pig is big." "A bug is on the rug." "Ben fed his pet hen."

### Pictures

Use emoji as the picture set for version 1, with no image files. A word appears in a picture task only if it has a clear emoji, and tapping a picture always says its name.

Starter list: cat, bat, rat, hat, map, pan, can, van, bag, cap, pig, pin, six, dog, fox, box, pot, log, sun, bus, bug, cup, nut, tub, bed, hen, pen, net, leg, web, jet, ten. Oral-only extras: sock, duck, rock, lock, bell.

## Mastery model

Keep it to a windowed tally: one small record per skill, updated on first attempts only. A session yields about 30 scored responses, which cannot support a statistical learner model.

### Skills tracked

| Family | One record per | Mastered when |
| --- | --- | --- |
| Letter sound | Letter-sound pair, such as m and /m/ | 5 hits in the last 6 first attempts |
| Blending | Word shape: continuous-first, stop-first | 5 hits in the last 6 |
| Segmenting | Position: first, last, middle | 5 hits in the last 6 |
| Decoding | Step, with real and nonsense words kept apart | 16 of the last 20 real; 8 of the last 10 nonsense |

In every family the counted attempts must span at least 3 different days.

```json
{ "id": "ls:m", "family": "letterSound", "state": "learning",
  "attempts": [{ "day": "2026-10-02", "hit": true, "activity": "soundMatch" }],
  "confusions": { "n": 2 }, "reviewDue": "2026-10-06" }
```

States are new, learning, and mastered. Keep the last 20 attempts per record.

### Where a miss goes

This table is the reason for the app. It turns one wrong answer into the skill that failed.

| What happened | Miss recorded against |
| --- | --- |
| Wrong pick in Sound match | That letter-sound, with the confusion pair |
| Wrong picture in Blend it | Blending |
| Wrong sound in Find the sound | Segmenting, at that position |
| Wrong tile in Build it, letter-sound not yet mastered | That letter-sound |
| Wrong tile in Build it, letter-sound mastered | Segmenting, at that position |
| Wrong choice in Read and find | Decoding, and the letter-sound in the position that differed |
| Parent taps "Sounds right, blend wrong" | Decoding and blending |
| Parent taps "Sound wrong" and marks letters | Decoding, and each marked letter-sound |
| Sound played with the ear button | That letter-sound; the item counts as assisted |

A correct word gives a hit to decoding and to every letter-sound in it. A correct first tile in Build it gives a hit to that letter-sound and to segmenting at that position. On a miss, skills not named above get nothing.

### Rules

1. **Placement.** First launch runs a one-time Sound match sweep over every letter in levels 1 and 2. Letters he gets right start as learning; the rest start as new. The letters a, m, s, t, p, n always start as learning, so words exist from the first session.
2. **Introducing sounds.** New letter-sounds enter through Sound match, at most two per session.
3. **Eligibility.** A word can appear only when it belongs to his current step or an earlier one, and every letter-sound in it is learning or mastered.
4. **Item choice.** Each activity draws about 70% of items from learning records, 20% from mastered records due for review, and 10% from new ones.
5. **Review.** A mastered record comes due after 2, 4, 8, then 16 days. Two misses in its last four attempts return it to learning.
6. **Recycling.** A missed item returns later in the same session and in each of the next two sessions.
7. **Keeping it winnable.** After two misses in a row, the next item is mastered material. If first-try accuracy is under 60% at halftime, fill the second half with mastered material.

### Moving up

- **Steps advance automatically** when the step's decoding records are mastered, real and nonsense both.
- **Levels need a parent.** The dashboard suggests the move. The parent runs a 10-word read-aloud check, five real and five nonsense, using nonsense words held back from normal play. Eight correct unlocks the next level.
- **Nothing moves down automatically.** A parent can set the step by hand in settings.

## Parent view

The parent area is one screen behind a three-second press on a corner icon. It holds the dashboard, settings, and backup.

### Dashboard

- **Four skill rows:** letter sounds, blending, segmenting, decoding. Each shows how many records are mastered, learning, and new.
- **Letter grid:** every letter-sound as a tile colored by state. Tapping a tile shows its recent attempts and confusions.
- **Top confusions:** the five most frequent pairs in the last two weeks, such as i and e.
- **Real versus nonsense:** first-try accuracy on each for the current step. A wide gap means he is recognizing words, not decoding them.
- **Practice history:** days practiced, and first-try accuracy per session as a small line.
- **Next step:** one plain sentence, such as "Ready for the level 2 check" or "Blending is the weak spot this week."

No percentiles, grade equivalents, or comparisons appear anywhere in the app.

### Read-aloud scoring

The scoring buttons sit on the child's Read aloud screen, not in the parent area. For the first three sessions a one-line prompt appears above them: "Ask him to touch each letter and say its sound, then say the word."

### Settings and backup

- Child's name, shown on parent screens.
- Item count per activity, and a switch to turn each activity off.
- Current step, editable by hand.
- Buttons to run the placement sweep and the level check.
- Export all progress as one JSON file, import it back, and reset behind a confirmation.

## Technical requirements

A static web app for iPad and iPhone Safari: plain HTML, CSS, and JavaScript, with no dependencies and no build step. It deploys to GitHub Pages and runs offline from the home screen.

- **Files:** index.html for the game, content/ for words, sentences, and sounds as JSON, audio/ for clips, and studio.html for recording.
- **Offline:** a service worker caches everything, with a version constant bumped on each release.
- **Storage:** progress in localStorage under one versioned key, written after every item. Install to the home screen, because Safari can clear storage for sites left unvisited.
- **Audio playback:** Web Audio API. Unlock on the first tap, decode the session's clips up front, and schedule sound sequences on the audio clock so gaps are exact.
- **Sound check:** the start screen plays a clip and waits for a tap. The iPhone silent switch can mute web audio, and a silent session is useless.
- **Audio format:** m4a, mp3, or WAV, in mono, with the full set under 10 MB. No WebM or Opus.
- **Recording:** studio.html runs on localhost only, with a small local script that writes clips into audio/.
- **Touch:** targets at least 64 px. No double-tap zoom, text selection, or page scroll during play.
- **Layout:** portrait on a phone, either orientation on a tablet, clear of the notch and home bar.
- **Print:** large lowercase letters, with capitals only at sentence starts.
- **Tunables:** one config object holds item counts, gap timings, and mastery thresholds.
- **Testable logic:** mastery updates and item choice are pure functions, with a test file that runs in Node.

## Build order

Build in seven stages and stop for review after each. Save this spec in the repo as SPEC.md so every stage can refer back to it.

1. **Content files.** Word bank, nonsense list, sentences, and picture mapping for levels 1 and 2. Stop for a parent review of the nonsense list.
2. **Recording page.** Then record the 24 sounds, the prompts, and the step 1A words.
3. **One activity end to end.** Sound match with real audio on a real phone, to prove audio timing, touch, and storage.
4. **The other five activities,** with the correction routine.
5. **Mastery model and item choice,** with tests and a simulated child: scripted sessions at a set accuracy per skill, confirming that steps advance and weak skills get more items.
6. **Game layer.** Pitch, passes and goals, the halftime chant, squad album, word book, and the headline.
7. **Parent view,** then the service worker and home-screen install.

The block world is a later addition, built only after all seven stages work. The game must be complete without it.

### Out of scope for version 1

- Content for levels 3 to 6.
- Speech recognition and text-to-speech.
- Timed fluency measures.
- Accounts, sync, or multiple profiles.
- Image files in place of emoji.
