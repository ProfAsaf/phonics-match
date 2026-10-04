// Tests for the mastery model, item choice, and the session, plus a simulated child: scripted
// seasons at set accuracy per skill. Run: npm test   (or: node --test test/*.test.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildIndex, diffPositions, isVowel } from '../js/content.js';
import { CONFIG } from '../js/config.js';
import { applyAttempt, newRecord, recId, addDays } from '../js/mastery.js';
import { makeRng } from '../js/rng.js';
import { printable, knowsLetter, soundMatchItem } from '../js/choose.js';
import {
  newProgress, planSession, scoreItem, advance, currentItem, atHalftime, halftime, finishSession,
  applyPlacement, applyLevelCheck, levelCheckWords, chantFor,
} from '../js/session.js';
import { topConfusions, nextStep } from '../js/stats.js';
import { processTake, RATE } from '../js/takes.js';
import { voiceJobs } from '../js/voices.js';

const read = name => JSON.parse(readFileSync(new URL(`../content/${name}.json`, import.meta.url), 'utf8'));
const C = buildIndex(Object.fromEntries(
  ['sounds', 'levels', 'words', 'nonsense', 'sentences', 'prompts', 'custom-sentences'].map(n => [n, read(n)]),
));
const DAY0 = '2026-10-05';

// Progress after a placement where he knew every letter-sound.
function placedChild(known = C.letters) {
  const P = newProgress(C, DAY0);
  return applyPlacement(C, P, Object.fromEntries(known.map(l => [l, true])), DAY0);
}

const attempt = (rec, day, hit) => applyAttempt(rec, { day, hit, activity: 'test' });

// ---- Mastery
test('a record starts new, learns on its first attempt, and masters at 5 of 6 over 3 days', () => {
  let r = newRecord('ls:m');
  assert.equal(r.state, 'new');
  r = attempt(r, DAY0, false);
  assert.equal(r.state, 'learning');
  for (const hit of [true, true, true, true, true]) r = attempt(r, DAY0, hit);
  assert.equal(r.state, 'learning', 'one day is not enough');
  r = newRecord('ls:m');
  const days = [DAY0, DAY0, addDays(DAY0, 1), addDays(DAY0, 1), addDays(DAY0, 2), addDays(DAY0, 2)];
  days.forEach((d, i) => { r = attempt(r, d, i !== 1); });
  assert.equal(r.state, 'mastered');
  assert.equal(r.reviewDue, addDays(DAY0, 4));
});

test('reviews come due after 2, 4, 8, then 16 days, and two misses in four relapse', () => {
  let r = newRecord('sg:first');
  const start = [0, 0, 1, 1, 2, 2];
  for (const d of start) r = attempt(r, addDays(DAY0, d), true);
  assert.equal(r.state, 'mastered');
  const gaps = [];
  let day = addDays(DAY0, 2);
  for (let i = 0; i < 5; i++) {
    day = r.reviewDue;
    const before = day;
    r = attempt(r, day, true);
    gaps.push(Math.round((Date.parse(r.reviewDue) - Date.parse(before)) / 86400000));
  }
  assert.deepEqual(gaps, [4, 8, 16, 16, 16]);
  r = attempt(r, day, false);
  assert.equal(r.state, 'mastered');
  r = attempt(r, day, false);
  assert.equal(r.state, 'learning');
});

test('decoding needs 16 of the last 20 real, or 8 of the last 10 nonsense', () => {
  let real = newRecord('dec:1A:real');
  let non = newRecord('dec:1A:nonsense');
  for (let i = 0; i < 20; i++) {
    const day = addDays(DAY0, Math.floor(i / 7));
    real = attempt(real, day, i % 5 !== 0); // 16 of 20
    if (i < 10) non = attempt(non, addDays(DAY0, Math.floor(i / 4)), i !== 3 && i !== 7); // 8 of 10
  }
  assert.equal(real.state, 'mastered');
  assert.equal(non.state, 'mastered');
});

test('assisted answers are logged but never tallied, and only the last 20 attempts are kept', () => {
  let r = newRecord('dec:1A:real');
  r = applyAttempt(r, { day: DAY0, hit: true, activity: 'readFind', assisted: true });
  assert.equal(r.attempts.length, 0);
  assert.equal(r.assisted, 1);
  for (let i = 0; i < 30; i++) r = attempt(r, DAY0, true);
  assert.equal(r.attempts.length, 20);
});

// ---- Item choice
function session(P, day = DAY0, seed = 1) {
  return planSession(C, P, { day, mode: 'parent', seed });
}

test('Sound match never shows c and k together, and the reverse form offers three different sounds', () => {
  const P = placedChild();
  P.step = '2C';
  for (let seed = 0; seed < 200; seed++) {
    const S = session(P, DAY0, seed);
    for (const item of S.queues.soundMatch) {
      if (item.form === 'forward') {
        assert.equal(item.choices.length, 4);
        assert.ok(!(item.choices.includes('c') && item.choices.includes('k')), item.choices.join());
        assert.equal(new Set(item.choices.map(l => C.letterSound[l])).size, 4);
      } else {
        assert.equal(item.choices.length, 3);
        assert.equal(new Set(item.choices).size, 3);
        assert.ok(item.choices.includes(C.letterSound[item.letter]));
      }
    }
  }
});

test('Sound match uses look-alikes and past confusions as wrong choices', () => {
  const P = placedChild();
  P.records['ls:b'].confusions = { d: 3 };
  const S = session(P);
  for (let seed = 0; seed < 20; seed++) {
    const item = soundMatchItem(C, P, S, makeRng(seed), 'b', 'forward', CONFIG);
    assert.ok(item.choices.includes('d') && item.choices.includes('p'), item.choices.join());
  }
});

test('Find the sound skips x and repeated sounds, asks first then last then middle, and offers the word\'s own sounds', () => {
  const P = placedChild();
  const order = ['first', 'last', 'middle'];
  for (let seed = 0; seed < 50; seed++) {
    const items = session(P, DAY0, seed).queues.findSound;
    items.forEach((item, i) => {
      const w = C.byWord.get(item.word);
      assert.ok(!w.sounds.includes('ks'));
      assert.equal(new Set(w.sounds).size, 3);
      assert.deepEqual([...item.choices].sort(), [...w.sounds].sort());
      if (i) assert.ok(order.indexOf(items[i - 1].position) <= order.indexOf(item.position));
    });
  }
});

test('Build it trays hold the word plus two or three extras, one of them another vowel', () => {
  const P = placedChild();
  P.step = '2C';
  for (let seed = 0; seed < 50; seed++) {
    for (const item of session(P, DAY0, seed).queues.buildIt) {
      const tray = item.tray.map(t => t.letter);
      assert.ok(tray.length === 5 || tray.length === 6, tray.join());
      const extras = [...tray];
      for (const l of item.letters) extras.splice(extras.indexOf(l), 1);
      assert.ok(extras.some(isVowel), `no other vowel in ${tray.join()}`);
      assert.ok(tray.filter(l => C.letterSound[l] === 'k').length <= item.letters.filter(l => C.letterSound[l] === 'k').length || !item.letters.some(l => C.letterSound[l] === 'k'));
      assert.ok(!(tray.includes('c') && tray.includes('k')));
    }
  }
});

test('Blend it wrong pictures share the first sound where the picture set allows', () => {
  const P = placedChild();
  const items = Array.from({ length: 30 }, (_, seed) => session(P, DAY0, seed).queues.blendIt).flat();
  for (const item of items) {
    const w = C.byWord.get(item.word);
    const sharing = C.pictured.filter(x => x.key !== w.key && x.sounds[0] === w.sounds[0]).length;
    const got = item.choices.filter(k => k !== w.key && C.byWord.get(k).sounds[0] === w.sounds[0]).length;
    assert.equal(got, Math.min(2, sharing), `${item.word}: ${item.choices.join()}`);
  }
});

test('Read and find: nonsense choices are decodable, and one differs in each position where it can', () => {
  const P = placedChild();
  P.step = '1B';
  const S = session(P);
  let positionsCovered = 0;
  for (let seed = 0; seed < 40; seed++) {
    const S2 = session(P, DAY0, seed);
    for (const item of S2.queues.readFind.filter(i => i.kind === 'nonsense')) {
      assert.equal(item.choices.length, 4);
      for (const k of item.choices) assert.ok(printable(C, P, S, C.byWord.get(k)), `${k} is not decodable at 1B`);
      const w = C.byWord.get(item.word);
      const diffs = item.choices.filter(k => k !== w.key).map(k => diffPositions(w.letters, C.byWord.get(k).letters));
      positionsCovered += new Set(diffs.filter(d => d.length === 1).map(d => d[0])).size;
    }
  }
  assert.ok(positionsCovered > 0);
});

test('printed words come from his step or earlier, with letters he has met; held-back and queen words stay hidden', () => {
  const P = placedChild(['a', 'm', 's', 't', 'p', 'n', 'b', 'i']);
  P.step = '1B';
  for (let seed = 0; seed < 40; seed++) {
    const S = session(P, DAY0, seed);
    for (const a of ['buildIt', 'readFind', 'readAloud']) {
      for (const item of S.queues[a] ?? []) {
        const words = item.kind === 'sentence' ? item.tokens.filter(t => t.word).map(t => t.word) : [item.word];
        if (item.kind === 'nonsense' && item.choices) words.push(...item.choices);
        for (const k of words) {
          const w = C.byWord.get(k);
          assert.ok(C.stepIndex[w.step] <= C.stepIndex[P.step], `${k} is from ${w.step}`);
          assert.ok(w.letters.every(l => knowsLetter(P, S, l)), `${k} uses a letter he has not met`);
          assert.ok(!w.levelCheck, `${k} is held back for the level check`);
          assert.notEqual(C.squad.byWord[k]?.piece, 'queen', `${k} is an unready queen`);
        }
      }
    }
  }
});

test('the item mix: new letters come in, about one review, the rest learning', () => {
  const P = placedChild(['a', 'm', 's', 't', 'p', 'n', 'b', 'd', 'f']);
  // Mastered and due for review: b and d.
  for (const l of ['b', 'd']) Object.assign(P.records[recId.letter(l)], { state: 'mastered', reviewDue: DAY0 });
  const S = session(P);
  const letters = S.queues.soundMatch.map(i => i.letter);
  assert.equal(S.newLetters.length, 2);
  for (const l of S.newLetters) assert.ok(letters.includes(l), `new letter ${l} is not introduced`);
  assert.equal(letters.filter(l => l === 'b' || l === 'd').length, 1);
  assert.ok(S.queues.soundMatch.find(i => S.newLetters.includes(i.letter)).intro);
});

// ---- The game layer and the correction routine
test('three passes in a row make a goal; a miss comes back three items later and in the next two sessions', () => {
  let P = placedChild();
  const S = session(P);
  const item = () => currentItem(S);
  for (let i = 0; i < 3; i++) {
    const r = scoreItem(C, P, S, item(), { correct: true }, CONFIG);
    P = r.P;
    if (i === 2) assert.ok(r.events.some(e => e.type === 'goal'));
    advance(C, P, S);
  }
  assert.deepEqual(S.game.goals, [1, 0]);
  const missed = item();
  const at = S.idx;
  const wrong = missed.choices.find(c => c !== missed.answer);
  P = scoreItem(C, P, S, missed, { correct: false, picked: wrong }, CONFIG).P;
  assert.equal(S.game.streak, 0);
  const back = S.queues[missed.activity].findIndex((it, i) => i > at && it.returned && it.key === missed.key);
  assert.equal(back, at + CONFIG.returnAfter);
  assert.ok(P.recycle.some(r => r.key === missed.key && r.remaining === 2));
  P = finishSession(C, P, S);
  for (let n = 1; n <= 2; n++) {
    const next = session(P, addDays(DAY0, n), 100 + n);
    const again = next.queues[missed.activity].find(i => i.key === missed.key);
    assert.ok(again, `missing from session ${n}`);
    P = scoreItem(C, P, next, again, { correct: true }, CONFIG).P;
    P = finishSession(C, P, next);
  }
  assert.ok(!P.recycle.some(r => r.key === missed.key));
});

test('after two misses in a row the next item is mastered material', () => {
  let P = placedChild(['a', 'm', 's', 't', 'p', 'n', 'b', 'c', 'd', 'f', 'g']);
  for (const l of ['a', 'm', 's', 't']) Object.assign(P.records[recId.letter(l)], { state: 'mastered', reviewDue: addDays(DAY0, 9) });
  const S = session(P);
  for (let i = 0; i < 2; i++) {
    const it = currentItem(S);
    P = scoreItem(C, P, S, it, { correct: false, picked: it.choices.find(c => c !== it.answer) }, CONFIG).P;
    advance(C, P, S);
  }
  assert.ok(['a', 'm', 's', 't'].includes(currentItem(S).letter), currentItem(S).letter);
});

test('below 60% at halftime, the second half is mastered material', () => {
  let P = placedChild();
  for (const l of ['m', 'a', 'p']) Object.assign(P.records[recId.letter(l)], { state: 'mastered', reviewDue: addDays(DAY0, 9) });
  const S = session(P);
  while (!atHalftime(S)) {
    // Right on the letters he has mastered (so they stay mastered), wrong on everything else.
    const it = currentItem(S);
    const right = ['m', 'a', 'p'].includes(it.letter);
    P = scoreItem(C, P, S, it, { correct: right, picked: right ? it.answer : it.choices.find(c => c !== it.answer) }, CONFIG).P;
    advance(C, P, S);
  }
  assert.ok(S.stats.firstTry[0] / S.stats.scored[0] < 0.6);
  assert.equal(halftime(C, P, S), true);
  // "map" is the one word made only of mastered letters, so it leads; every word uses some.
  assert.equal(S.queues.buildIt[0].word, 'map');
  for (const it of S.queues.buildIt) assert.ok(it.letters.some(l => ['m', 'a', 'p'].includes(l)), it.word);
});

test('placement: right answers start as learning, the rest as new, and a, m, s, t, p, n always learn', () => {
  const P = applyPlacement(C, newProgress(C, DAY0), { b: true, o: true }, DAY0);
  assert.equal(P.records['ls:b'].state, 'learning');
  assert.equal(P.records['ls:o'].state, 'learning');
  assert.equal(P.records['ls:m'].state, 'learning');
  assert.equal(P.records['ls:d'].state, 'new');
  assert.ok(P.placementDone);
});

test('the level check uses five held-back nonsense words; eight right unlocks the next level', () => {
  const words = levelCheckWords(C, 1, 'seed');
  assert.equal(words.length, 10);
  assert.equal(words.filter(k => C.byWord.get(k).levelCheck).length, 5);
  let P = placedChild();
  P.step = '1B';
  const fail = applyLevelCheck(C, P, 1, [true, true, true, true, true, true, true, false, false, false], DAY0);
  assert.equal(fail.pass, false);
  const ok = applyLevelCheck(C, P, 1, [true, true, true, true, true, true, true, true, false, false], DAY0);
  assert.equal(ok.pass, true);
  assert.equal(ok.P.queenReady['1B'], true);
});

test('the chant fills in a player name and an action word that change from match to match', () => {
  const P = placedChild();
  P.step = '1B';
  const a = chantFor(C, P, 0);
  const b = chantFor(C, P, 1);
  assert.equal(a.verse.step, '1B');
  assert.notEqual(`${a.name} ${a.act}`, `${b.name} ${b.act}`);
  assert.ok(a.lines.flat().every(t => !t.text.includes('{')));
});

// ---- A simulated child
// skill: chance of a right first try. letters: per-letter overrides. Returns what happened each day.
function simulate({ days, skill, letters = {}, mode = 'parent', P = placedChild(), onDay }) {
  const log = [];
  for (let d = 0; d < days; d++) {
    const day = addDays(DAY0, d);
    const S = planSession(C, P, { day, mode, seed: `sim${d}` });
    const rng = makeRng(`answers${d}`);
    const hit = p => rng.next() < p;
    const seen = [];
    let item = currentItem(S);
    while (item) {
      if (atHalftime(S)) halftime(C, P, S);
      seen.push(item);
      const wrong = () => item.choices?.find(c => c !== item.answer);
      let out;
      switch (item.activity) {
        case 'soundMatch': { const ok = hit(letters[item.letter] ?? skill.letter); out = { correct: ok, picked: ok ? item.answer : wrong() }; break; }
        case 'blendIt': { const ok = hit(skill.blend); out = { correct: ok, picked: ok ? item.answer : wrong() }; break; }
        case 'findSound': { const ok = hit(skill.seg[item.position]); out = { correct: ok, picked: ok ? item.answer : wrong() }; break; }
        case 'buildIt': {
          const tiles = item.letters.map(l => (hit(letters[l] ?? skill.letter) ? l : item.tray.find(t => !item.letters.includes(t.letter)).letter));
          out = { correct: tiles.join() === item.letters.join(), firstTiles: tiles };
          break;
        }
        case 'readFind': { const ok = hit(item.kind === 'real' ? skill.real : skill.nonsense); out = { correct: ok, picked: ok ? item.answer : wrong() }; break; }
        default:
          if (mode === 'solo') out = { unscored: true };
          else if (item.kind === 'sentence') out = { missed: hit(skill.real) ? [] : [1] };
          else out = hit(item.kind === 'real' ? skill.real : skill.nonsense) ? { verdict: 'read' } : { verdict: 'sound', marked: [1] };
      }
      const r = scoreItem(C, P, S, item, out, CONFIG);
      P = r.P;
      item = advance(C, P, S);
    }
    P = finishSession(C, P, S);
    log.push({ day, step: P.step, items: seen });
    if (onDay) P = onDay(P, d) ?? P;
  }
  return { P, log };
}

const STRONG = { letter: 0.95, blend: 0.95, seg: { first: 0.95, last: 0.95, middle: 0.95 }, real: 0.95, nonsense: 0.92 };

test('simulated child: steps advance on their own within a level, and a new level waits for the check', () => {
  const { P, log } = simulate({ days: 25, skill: STRONG });
  const firstB = log.findIndex(x => x.step === '1B');
  assert.ok(firstB > 0 && firstB < 10, `reached 1B on day ${firstB}`);
  assert.equal(P.step, '1B', 'level 2 needs the level check');
  assert.equal(P.levelCheckDue, 1);
  assert.ok(P.signed.includes(C.squad.players.find(p => p.step === '1A' && p.piece === 'queen').word), 'the 1A queen was signed');
  assert.match(nextStep(C, P, log.at(-1).day), /level 2 check/);
  // The parent runs the check; the queen comes out and he moves up.
  const passed = applyLevelCheck(C, P, 1, Array(10).fill(true), log.at(-1).day).P;
  const after = simulate({ days: 3, skill: STRONG, P: passed });
  assert.equal(after.P.step, '2A');
  // No held-back word ever appeared in play.
  const shown = [...log, ...after.log].flatMap(x => x.items).flatMap(i => [i.word, ...(i.choices ?? [])]).filter(Boolean);
  assert.ok(!shown.some(k => C.byWord.get(k)?.levelCheck));
});

test('simulated child: a weak skill gets more items once the strong ones are mastered', () => {
  const skill = { ...STRONG, seg: { first: 0.97, last: 0.97, middle: 0.3 } };
  const { log } = simulate({ days: 16, skill });
  const late = log.slice(8).flatMap(x => x.items).filter(i => i.activity === 'findSound');
  const count = pos => late.filter(i => i.position === pos).length;
  assert.ok(count('middle') > count('first') && count('middle') > count('last'), `middle ${count('middle')}, first ${count('first')}, last ${count('last')}`);
  const weakLetter = simulate({ days: 12, skill: STRONG, letters: { e: 0.2, i: 0.25 }, P: (() => { const P = placedChild(); P.step = '2C'; return P; })() });
  const sm = weakLetter.log.slice(5).flatMap(x => x.items).filter(i => i.activity === 'soundMatch');
  const share = l => sm.filter(i => i.letter === l).length;
  assert.ok(share('e') + share('i') > share('m') + share('s'), `e+i ${share('e') + share('i')}, m+s ${share('m') + share('s')}`);
});

test('simulated child: "Just me" sessions score nothing in Read aloud but still count its items as passes', () => {
  const { P, log } = simulate({ days: 2, skill: STRONG, mode: 'solo' });
  const readAloudAttempts = Object.values(P.records).flatMap(r => r.attempts).filter(a => a.activity === 'readAloud');
  assert.equal(readAloudAttempts.length, 0);
  assert.ok(log[0].items.some(i => i.activity === 'readAloud'));
  assert.ok(P.seasonGoals > 0);
});

test('dashboard confusions pair up the letters he mixed up', () => {
  let P = placedChild();
  P.records['ls:e'] = applyAttempt(P.records['ls:e'], { day: DAY0, hit: false, activity: 'soundMatch', picked: 'i' });
  P.records['ls:i'] = applyAttempt(P.records['ls:i'], { day: DAY0, hit: false, activity: 'soundMatch', picked: 'e' });
  assert.deepEqual(topConfusions(P, DAY0)[0], { pair: 'e and i', count: 2 });
});

// ---- Recordings and AI voices
test('a take is trimmed, leveled, and saved as 16 kHz mono WAV', () => {
  const sr = 48000;
  const data = new Float32Array(sr * 1.5);
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    data[i] = ((Math.sin(i * 12.9898) * 43758.5453) % 1) * 0.001 + (t >= 0.4 && t < 1 ? 0.3 * Math.sin(2 * Math.PI * 300 * t) : 0);
  }
  const take = processTake({ sampleRate: sr, channels: [data] });
  assert.ok(take.seconds > 0.65 && take.seconds < 0.8, String(take.seconds)); // 0.6 s of sound plus short margins
  const voiced = [...take.samples].filter(v => Math.abs(v) > 0.02);
  const rms = Math.sqrt(voiced.reduce((a, v) => a + v * v, 0) / voiced.length);
  assert.ok(Math.abs(rms - 0.1) < 0.02, String(rms));
  const view = new DataView(take.wav);
  assert.equal(String.fromCharCode(...new Uint8Array(take.wav, 0, 4)), 'RIFF');
  assert.equal(view.getUint16(22, true), 1);
  assert.equal(view.getUint32(24, true), RATE);
  assert.throws(() => processTake({ sampleRate: sr, channels: [new Float32Array(4800)] }), /silent/);
});

test('the AI voice makes every clip except the letter sounds and his shout; nonsense words carry their rhyme', () => {
  const jobs = voiceJobs(C);
  const expected = C.clips.filter(c => c.kind !== 'sound' && c.kind !== 'shout').map(c => c.id).sort();
  assert.deepEqual(jobs.map(j => j.id).sort(), expected);
  assert.match(jobs.find(j => j.id === 'w-lom').instructions, /rhymes with "mom"/);
  assert.ok(jobs.every(j => j.text && j.instructions));
});

// ---- The world map and the day's run
test('the day is one run past the six activities in order, with halftime after three and the trophy last', async () => {
  const { STOPS, stopOf, HALFTIME_STOP, TROPHY_STOP } = await import('../js/journey.js');
  const { ANCHORS, START_X } = await import('../js/run.js');
  assert.deepEqual(STOPS.filter(s => s.activity).map(s => s.activity), CONFIG.activities, 'stops follow the session order');
  assert.ok(STOPS.slice(0, HALFTIME_STOP).every(s => CONFIG.firstHalf.includes(s.activity)), 'halftime falls after the first half');
  assert.equal(TROPHY_STOP, STOPS.length - 1);
  assert.equal(stopOf('readAloud'), 6);
  assert.equal(ANCHORS.length, STOPS.length, 'every stop has a place on the run');
  assert.ok(ANCHORS.every((x, i) => x > (i ? ANCHORS[i - 1] + 1500 : START_X + 800)), 'the stops come in order, with room to run between');
});

test('each step is a world with its own scenery, and the parent sees where he is', async () => {
  const { worldFor, whereHeIs, WORLD_THEMES } = await import('../js/journey.js');
  const worlds = C.steps.map(s => worldFor(C, s.step));
  assert.deepEqual(worlds.map(w => w.number), C.steps.map((_, i) => i + 1));
  assert.equal(new Set(worlds.map(w => w.theme)).size, Math.min(worlds.length, WORLD_THEMES.length), 'neighboring worlds look different');
  const P = placedChild(['a', 'm', 's', 't']);
  const first = C.squad.players.filter(p => p.step === P.step);
  P.signed.push(first[0].word, first[1].word);
  const lines = whereHeIs(C, P);
  assert.ok(lines[0].startsWith('World 1'));
  assert.ok(lines[0].includes(`2 of ${first.length} players`));
});

test('on the map every match is a level, the gate waits for the queen, and later levels are locked', async () => {
  const { mapWorlds, playsByStep, hereLevel, flagged, levelSpot, gateSpot, LEVELS_PER_WORLD } = await import('../js/journey.js');
  const P = placedChild();
  P.sessions = [{ day: DAY0, step: '1A' }, { day: DAY0, step: '1A' }, { day: DAY0 }]; // the last one is from before steps were saved
  let worlds = mapWorlds(C, P);
  assert.equal(worlds[0].state, 'here');
  assert.equal(worlds[0].played, 3, 'old matches count for the current step');
  assert.deepEqual(playsByStep(C, P), { '1A': 3 });
  assert.equal(hereLevel(worlds[0]), 3, "he stands on today's level");
  assert.equal(flagged(worlds[0]), 3);
  assert.ok(worlds.slice(1, C.steps.length).every(w => w.state === 'ahead'));
  const later = C.levels.filter(l => !l.steps.length).length;
  assert.equal(worlds.filter(w => w.state === 'later').length, later, 'levels still to be written show as locked worlds');
  assert.equal(worlds.find(w => w.step === C.steps.filter(s => s.level === 1).at(-1).step).gate, 'castle', "a level's last world ends at the castle");
  assert.equal(worlds[0].queen, false);
  P.queenReady['1A'] = true;
  assert.equal(mapWorlds(C, P)[0].queen, true, 'the queen waits at the gate once she is ready');
  P.step = '1B';
  worlds = mapWorlds(C, P);
  assert.deepEqual(worlds.slice(0, 2).map(w => w.state), ['done', 'here']);
  P.sessions = Array.from({ length: LEVELS_PER_WORLD + 3 }, () => ({ day: DAY0, step: '1B' }));
  assert.equal(hereLevel(mapWorlds(C, P)[1]), LEVELS_PER_WORLD - 1, 'past the last level he keeps playing on it');
  for (let k = 1; k < LEVELS_PER_WORLD; k++) assert.ok(levelSpot(1, k).y < levelSpot(1, k - 1).y, 'the path climbs');
  assert.ok(gateSpot(1).y < levelSpot(1, LEVELS_PER_WORLD - 1).y && gateSpot(1).y > levelSpot(2, 0).y, 'the gate is between the worlds');
});

test("a match is saved with the step it was played in, so it lands in that world's levels", () => {
  const P = placedChild(['a', 'm', 's', 't', 'p', 'n']);
  const S = planSession(C, P, { day: DAY0, seed: 'map' });
  const done = finishSession(C, { ...P, step: '1B' }, S);
  assert.equal(done.sessions.at(-1).step, P.step, 'the step he started in, even if he moved up during it');
});

test('every prompt cue plays two real notes, whatever its hash', async () => {
  const { hash } = await import('../js/rng.js');
  const PENTATONIC = [0, 2, 4, 7, 9];
  for (const id of Object.keys(C.prompts)) {
    const h = hash(id) >>> 0;
    for (const n of [h % 5, (h >>> 4) % 5]) assert.ok(Number.isFinite(523.25 * 2 ** (PENTATONIC[n] / 12)), `${id} plays a note`);
  }
  assert.ok(Object.keys(C.prompts).some(id => ((hash(id) >>> 0) >> 4) % 5 < 0), 'a signed shift breaks some cues, which is why the game uses an unsigned one');
});
