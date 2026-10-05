// Generates content/nonsense.json, the nonsense-word list, and nonsense-review.md for the one-time
// parent review (SPEC.md, "Nonsense words"). The game never invents words; it reads the saved list.
//
// Candidates: consonant + the step's vowel + consonant, using only letters introduced by that step.
// Spec rules: the last letter is b, d, g, m, n, p, or t; c only before a, o, u; k only before e, i;
// no g before e or i; no a after w. Added rule: x never starts a word (it would not say /ks/ there).
// Every candidate that is a real word, name, abbreviation, slang term, sound-alike, or rude is then
// dropped, with its reason in EXCLUDED. Words in content/words.json are dropped automatically.
// Survivors with a faint association are kept but FLAGGED, and chosen only when clean ones run out.
//
// Levels 3 and up (letter pairs, blends, silent e, vowel teams, endings) don't fit these rules: their
// words were hand-picked once and are kept as they are each time this runs.
//
// Run: node tools/nonsense.mjs   (refuses to overwrite a list marked "reviewed" unless given --force)

import { writeFileSync } from 'node:fs';
import { loadContent, readJson, contentDir, isVowel } from './content.mjs';

const PLAY_PER_STEP = 10;
// Five per level, held back for the level check. Step 1A has no a-words to spare (see review sheet).
const CHECK_PER_STEP = { '1A': 0, '1B': 5, '2A': 1, '2B': 2, '2C': 2 };
// Held back for the check-ups' one-minute nonsense-word read: as many as the step can spare, up to
// this many, clean ones first. Step 1A has none to spare, so its check-ups read its play words.
const CHECKUP_PER_STEP = 15;
const ENDINGS = ['b', 'd', 'g', 'm', 'n', 'p', 't'];
const SPEC_EXAMPLES = ['mip', 'fim', 'tig', 'lom', 'nup', 'teg'];
const LEVEL2_CONSONANTS = ['j', 'k', 'v', 'w', 'y', 'z'];

// "word" or "word(note)". Bank words are not repeated here.
const EXCLUDED = {
  'real word': `
    ban cab cad cam dab dam fad fat gab gad(as in gad about) gag gap hag hap(old word for luck) lab lad lag lap
    mad nab nag nan pad pap rag sag sap tab tad tam(a wool hat) tan tat bap(British for a bread roll)
    bib bid did dim din fid(a rope-splicing tool) mid nib nip nit pip rid rig rim sin
    bob bog bop bot cob cod cog con cop cot don dot fob fop god hob hod hog jot lop lot mob mot nod
    nog(as in eggnog) pod rob rod rot sob sod son sop sot tog tom ton tot vog(volcanic smog) won yod(a Hebrew letter) yon
    cud dub dud dun gun gut hub jut lug mum nub nun pub pug pun put rub rum rut sub sum tun(a large cask) tut
    vug(a hollow in rock)
    deb fen hem ked(a sheep parasite) keg ken led neb(a beak) pep rem rep ret wed wen yen zen`,
  'name': `
    dan han pam sam lin sid tim nin dom gog jon lon ron tod von zod(General Zod) zog(Zog the dragon)
    jun jeb jed jen lem len meg ned seb ted tet(Tet, the Vietnamese new year)`,
  'abbreviation, slang, or foreign word': `
    dag(Australian slang) dap(slang greeting) dat(slang for that) fab fam gam(old slang for legs) gat(slang for gun)
    lan(LAN) lat(gym slang) mag nam(slang for Vietnam) rad mam(dialect for mom)
    lib min mit(MIT) sib(sibling) sig(signature) sim(SIM card)
    bod bon(French) com(.com) dob(Australian slang) gob(slang for mouth) gop(GOP) hon mod mog(British slang for cat)
    mon nob nom non pog pom rom(ROM) vod(video on demand) vom wod(workout of the day) wot yob yom(Yom Kippur)
    bub dup fud fum(fee-fi-fo-fum) gud hud(HUD) hun hup nug pud sud(suds) sup tum wub wud wut yup
    deg(degree) dem dep(dept.) det(Det.) feb(Feb.) fem heb(H-E-B stores) hep het ket med mem(a Hebrew letter) neg
    ped reb reg seg sem(semester) sen(Sen.) sep(Sep.) veg yep zed(British for z)`,
  'sounds like a real word': `
    lam(lamb) nat(gnat) lim(limb) bom(bomb) yot(yacht) dum(dumb) mut(mutt) num(numb) wun(one) wup(whup)
    ded(dead) fet(fete) hed(head) jem(gem) ren(wren) sed(said)`,
  'rude, or close to it': `
    fag fap nad nig tit wog wop zob(French slang) bum cum cun fug fup fut gub(offensive slang) tup
    feg(one letter from a slur) leb(offensive slang)`,
};

const FLAGGED = {
  bab: 'repeats b', cag: 'British slang for a rain jacket', gan: 'Scots dialect for "go"',
  hab: 'sci-fi slang for a habitat; "the Habs" hockey team', mab: 'Queen Mab, a fairy in Shakespeare',
  rab: 'Scottish nickname for Robert', sab: 'British slang for a protester',
  san: 'Japanese title, as in Tanaka-san; starts place names like San Diego',
  bim: 'old slang; short for Barbadian', dib: 'close to "dibs"', dit: 'the short beep in Morse code',
  hin: 'a measure in the Bible', lig: 'British slang for freeloading', mib: 'a marble, in marble games',
  mig: 'MiG fighter jet; MIG welding', mim: 'repeats m; old word for prim', nim: 'a math game called Nim',
  pid: 'a computing abbreviation, PID', pim: 'Dutch first name', rin: 'Japanese first name', rit: 'sounds like "writ"',
  dod: 'repeats d', dop: 'South African slang for a drink', fon: 'a language of Benin', gom: 'Irish slang for a fool',
  gon: 'slang for "going to"', nop: 'a computing abbreviation, NOP', pon: 'poetic short form of "upon"',
  rog: 'short for Roger', wob: 'w can pull o toward the u in "won"', wom: 'w can pull o toward the u in "won"',
  fub: 'old word for cheat', gug: 'repeats g', gup: 'British slang for nonsense', jud: 'a first name, Jud',
  lub: 'baby talk for "love"', lud: 'old word for lord, as in "m\'lud"', lum: 'Scots for chimney',
  mun: 'dialect for "man"', nud: 'close to "nude"', rud: 'sounds like Rudd, a surname', sut: 'can sound like "soot"',
  tud: 'close to a rude word', wug: 'a made-up word from a famous language test', yun: 'Korean surname',
  yut: 'a Korean board game', zug: 'German for "train"', zum: 'a German word', zut: 'French for "darn!"',
  beb: 'repeats b', nem: 'a Vietnamese spring roll', nen: 'repeats n', ven: 'sounds like Venn, as in Venn diagram',
  ved: 'Indian first name', zeb: 'a first name, Zeb', zep: 'slang for Led Zeppelin',
};

// A common real word for each vowel + ending, for the recording page's hint: "mip, rhymes with lip".
const RHYMES = {
  ab: 'cab', ad: 'dad', ag: 'bag', am: 'ham', an: 'can', ap: 'cap', at: 'cat',
  ib: 'bib', id: 'lid', ig: 'pig', im: 'him', in: 'pin', ip: 'lip', it: 'sit',
  ob: 'job', od: 'nod', og: 'dog', om: 'mom', on: 'on', op: 'top', ot: 'hot',
  ub: 'tub', ud: 'mud', ug: 'bug', um: 'gum', un: 'sun', up: 'cup', ut: 'nut',
  eb: 'web', ed: 'bed', eg: 'leg', em: 'hem', en: 'hen', ep: 'step', et: 'net',
};

function spellingProblem(onset, vowel, coda) {
  if (!ENDINGS.includes(coda)) return 'ending';
  if (onset === 'c' && !'aou'.includes(vowel)) return 'c only before a, o, u';
  if (onset === 'k' && !'ei'.includes(vowel)) return 'k only before e, i';
  if (onset === 'g' && 'ei'.includes(vowel)) return 'no g before e or i';
  if (onset === 'w' && vowel === 'a') return 'no a after w';
  if (onset === 'x') return 'x never starts a word';
  return null;
}

function parseExcluded() {
  const reasons = {};
  for (const [reason, list] of Object.entries(EXCLUDED)) {
    for (const [, word, note] of list.matchAll(/([a-z]+)(?:\(([^)]*)\))?/g)) {
      if (reasons[word]) throw new Error(`${word} is excluded twice`);
      reasons[word] = { reason, note };
    }
  }
  return reasons;
}

// Greedy pick: spec examples first, clean before flagged, then spread first and last letters.
// Level 2 steps get a nudge toward their new consonants. Ties go alphabetically, so runs repeat.
function choose(pool, n, picked, level) {
  const chosen = [];
  const remaining = [...pool].sort();
  while (chosen.length < n && remaining.length) {
    const all = [...picked, ...chosen];
    const score = w =>
      (SPEC_EXAMPLES.includes(w) ? 100 : 0) - (FLAGGED[w] ? 50 : 0)
      - 20 * all.filter(p => p[0] === w[0]).length - 5 * all.filter(p => p[2] === w[2]).length
      + (level === 2 && LEVEL2_CONSONANTS.includes(w[0]) ? 3 : 0);
    let best = remaining[0];
    for (const w of remaining) if (score(w) > score(best)) best = w;
    chosen.push(best);
    remaining.splice(remaining.indexOf(best), 1);
  }
  return chosen;
}

const c = loadContent();
const force = process.argv.includes('--force');
try {
  if (readJson('nonsense.json').reviewed && !force) {
    console.error('content/nonsense.json is marked reviewed. Rerun with --force to replace it.');
    process.exit(1);
  }
} catch (e) {
  if (e.code !== 'ENOENT') throw e;
}

const excluded = parseExcluded();
const bank = new Set(c.words.map(w => w.word.toLowerCase()));
const cvcSteps = c.steps.filter(s => s.vowel); // levels 1 and 2: one short vowel per step
const later = c.nonsense.filter(w => !cvcSteps.some(s => s.step === w.step)); // hand-picked, kept as is
const seen = new Set();
const perStep = [];
for (const step of cvcSteps) {
  const level = step.level;
  const consonants = Object.keys(c.letterStep).filter(l => !isVowel(l) && c.stepIndex[c.letterStep[l]] <= c.stepIndex[step.step]);
  const out = { step: step.step, vowel: step.vowel, level, clean: [], flagged: [], excluded: {} };
  for (const onset of consonants) {
    for (const coda of consonants) {
      if (spellingProblem(onset, step.vowel, coda)) continue;
      const w = onset + step.vowel + coda;
      seen.add(w);
      const why = bank.has(w) ? { reason: 'in the word bank' } : excluded[w];
      if (why) (out.excluded[why.reason] ??= []).push(why.note ? `${w} (${why.note})` : w);
      else (FLAGGED[w] ? out.flagged : out.clean).push(w);
    }
  }
  perStep.push(out);
}
for (const w of [...Object.keys(excluded), ...Object.keys(FLAGGED)]) {
  if (!seen.has(w)) console.warn(`warning: ${w} is listed but is not a candidate`);
}

// Play words for every step first, then the held-back level-check words, spread across each level.
const checkPicked = {};
for (const s of perStep) {
  s.play = choose([...s.clean, ...s.flagged], PLAY_PER_STEP, [], s.level);
}
for (const s of perStep) {
  const rest = [...s.clean, ...s.flagged].filter(w => !s.play.includes(w));
  s.check = choose(rest, CHECK_PER_STEP[s.step] ?? 0, checkPicked[s.level] ??= [], s.level);
  checkPicked[s.level].push(...s.check);
  const left = rest.filter(w => !s.check.includes(w));
  s.checkup = choose(left, CHECKUP_PER_STEP, [], s.level);
  s.spares = left.filter(w => !s.checkup.includes(w)).sort();
}

const entry = (w, step, held) => {
  const e = { word: w, letters: [...w], sounds: [...w].map(l => c.sounds.letters[l]), real: false, step, rhyme: RHYMES[w.slice(1)] };
  if (held) e[held] = true;
  return e;
};
const entries = [...perStep.flatMap(s => [
  ...[...s.play].sort().map(w => entry(w, s.step, null)),
  ...[...s.check].sort().map(w => entry(w, s.step, 'levelCheck')),
  ...[...s.checkup].sort().map(w => entry(w, s.step, 'checkup')),
]), ...later];
const line = e => '    ' + JSON.stringify(e).replace(/":/g, '": ').replace(/,"/g, ', "').replace(/^\{/, '{ ').replace(/\}$/, ' }');
const about = 'Nonsense words, made by tools/nonsense.mjs and reviewed once by a parent. Each step\'s play words are its ten squad players. levelCheck words are held back from normal play for the parent\'s level check, and checkup words for the check-ups\' one-minute read. rhyme is the hint shown on the recording page.';
writeFileSync(new URL('nonsense.json', contentDir),
  '{\n  "about": ' + JSON.stringify(about) + ',\n  "reviewed": false,\n  "words": [\n' + entries.map(line).join(',\n') + '\n  ]\n}\n');

// The review sheet.
const row = w => `| ${w} | ${RHYMES[w.slice(1)]} | ${FLAGGED[w] ?? ''} |`;
const table = words => ['| Word | Rhymes with | Note |', '| --- | --- | --- |', ...[...words].sort().map(row)].join('\n');
const md = [
  '# Nonsense words: parent review',
  '',
  'Made by `node tools/nonsense.mjs`. The game reads `content/nonsense.json`.',
  '',
  'Please check each word once. It should be something he cannot already know: not a real word, a name, an abbreviation, slang, a sound-alike of a real word, or anything rude. Read it aloud using its rhyme. Strike any you don\'t want and a spare takes its place.',
  '',
  'Each step\'s ten play words become its ten squad players. The level-check words are never used in normal play; they are saved for the 10-word read-aloud check that unlocks the next level. The check-up words are saved for the one-minute nonsense-word read in the check-ups.',
  '',
];
for (const s of perStep) {
  md.push(`## ${s.step}: short ${s.vowel}`, '');
  if (s.play.length < PLAY_PER_STEP || !s.spares.length && !s.check.length) {
    const noted = s.flagged.length ? ` Of these, ${s.flagged.length} have a faint association, noted below.` : '';
    md.push(`Only ${s.clean.length + s.flagged.length} short-${s.vowel} words get through the rules, so all are used and none are left to hold back for the level check.${noted}`, '');
  }
  md.push(table(s.play), '');
  if (s.check.length) md.push(`**Held back for the level ${s.level} check:**`, '', table(s.check), '');
  if (s.checkup.length) md.push('**Held back for the check-ups:**', '', table(s.checkup), '');
  md.push(`**Spares:** ${s.spares.length ? s.spares.map(w => FLAGGED[w] ? `${w} (${FLAGGED[w]})` : w).join(', ') : 'none'}`, '');
}
// The hand-picked words of levels 3 and up, by step.
for (const st of c.steps.filter(s => !s.vowel)) {
  const words = later.filter(w => w.step === st.step);
  if (!words.length) continue;
  const list = kind => words.filter(kind).map(w => w.word).sort().join(', ');
  md.push(`## ${st.step}: ${st.name}`, '', `Play: ${list(w => !w.levelCheck && !w.checkup)}`, '', `Held back for the check-ups: ${list(w => w.checkup)}`, '');
  if (words.some(w => w.levelCheck)) md.push(`Held back for the level ${st.level} check: ${list(w => w.levelCheck)}`, '');
}
md.push('## Candidates left out', '', 'Every candidate the rules allowed, and why it was dropped.', '');
for (const s of perStep) {
  md.push(`**${s.step}**`, '');
  for (const reason of ['in the word bank', ...Object.keys(EXCLUDED)]) {
    if (s.excluded[reason]) md.push(`- ${reason[0].toUpperCase() + reason.slice(1)}: ${s.excluded[reason].sort().join(', ')}`);
  }
  md.push('');
}
writeFileSync(new URL('../nonsense-review.md', contentDir), md.join('\n'));

for (const s of perStep) {
  console.log(`${s.step}: ${s.clean.length} clean + ${s.flagged.length} flagged | play ${s.play.join(' ')} | check ${s.check.join(' ') || '-'} | checkup ${s.checkup.length} | spares ${s.spares.length}`);
}
console.log(`${entries.length} words written to content/nonsense.json; review sheet at nonsense-review.md`);
