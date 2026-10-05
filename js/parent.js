// The parent area: one screen behind a three-second press on the corner icon, holding the
// dashboard, settings, and backup (SPEC.md, "Parent view"). No percentiles, grade equivalents, or
// comparisons appear here or anywhere else.
import { CONFIG as cfg } from './config.js';
import { clip, tokenize, stepLE, levelOf, spelling } from './content.js';
import { FAMILIES, recId } from './mastery.js';
import { familyCounts, topConfusions, realVsNonsense, history, nextStep, roadmap, FAMILY_NAMES } from './stats.js';
import { levelCheckWords, applyLevelCheck } from './session.js';
import { letterState } from './choose.js';
import { saveProgress, loadProgress, exportProgress, parseImport, clearProgress, activePlayer, switchPlayer, startTestPlayer } from './storage.js';
import { openRecorder } from './recorder.js';
import { whereHeIs } from './journey.js';
import { checkupDue, checkupSeries } from './checkup.js';
import { h, sleep } from './ui.js';

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const ACTIVITY_NAMES = {
  soundMatch: 'Sound match', blendIt: 'Blend it', findSound: 'Find the sound',
  buildIt: 'Build it', readFind: 'Read and find', readAloud: 'Read aloud',
};

export function openParent(state, { onClose, runPlacement, startCheckup }) {
  const { C } = state;
  state.audio.stop();
  const overlay = h('div', { class: 'parent' });
  document.body.append(overlay);
  const save = () => saveProgress(state.P);
  const close = () => {
    overlay.remove();
    onClose?.();
  };
  render();

  function render() {
    const P = state.P;
    const testing = activePlayer() === 'test';
    overlay.replaceChildren(
      h('header', { class: 'phead' },
        h('div', {}, h('h1', {}, testing ? 'Test player' : P.settings.childName ? `${P.settings.childName}'s phonics` : 'Phonics'),
          h('div', { class: 'muted' }, `Step ${P.step} · ${plural(P.sessionCount, 'match', 'matches')} played`)),
        h('button', { class: 'pclose', onclick: close }, 'Close')),
      section("Who's playing", players()),
      section('Where he is', whereHeIs(C, P).map(line => h('p', { class: 'where' }, line))),
      section('Next step', h('p', { class: 'next' }, nextStep(C, P, state.day)),
        levelCheckButton()),
      section('Check-ups', checkups()),
      section('The road through first grade', road()),
      section('Skills', skillRows()),
      section('Letter sounds', letterGrid()),
      section('Top confusions, last two weeks', confusions()),
      section(`Real versus nonsense words, step ${P.step}`, realNonsense()),
      section('Practice history', practice()),
      section('Settings', settings()),
      section('Your headlines', customSentences()),
      section('Recordings', recordings()),
      section('Backup', backup()),
    );
  }

  // The child and a test player share the device: a grown-up can try anything as the test player
  // without changing the child's progress, then switch back.
  function players() {
    const child = loadProgress(C, state.day, 'main').settings.childName || 'your child';
    const go = fn => {
      fn();
      location.reload();
    };
    const testFrom = copy => () => go(() => startTestPlayer(C, state.day, { copy }));
    if (activePlayer() === 'test') {
      return [
        h('p', { class: 'testing' }, `You're playing as the test player. Nothing you do here changes ${child}'s progress.`),
        h('div', { class: 'pbtns left' },
          h('button', { class: 'pbig due', onclick: () => go(() => switchPlayer('main')) }, `Back to ${child}`),
          h('button', { class: 'pbig', onclick: testFrom(true) }, `Start the test over from ${child}'s place`),
          h('button', { class: 'pbig', onclick: testFrom(false) }, 'Start the test over from the beginning')),
      ];
    }
    return [
      h('p', {}, `Playing as ${child}.`),
      h('div', { class: 'pbtns left' },
        h('button', { class: 'pbig', onclick: testFrom(true) }, `Test from ${child}'s place`),
        h('button', { class: 'pbig', onclick: testFrom(false) }, 'Test from the beginning')),
      h('p', { class: 'muted' }, `A test player lets you try anything without changing ${child}'s progress. Come back here and tap "Back to ${child}" when you're done.`),
    ];
  }

  function section(title, ...kids) {
    return h('section', { class: 'psec' }, h('h2', {}, title), kids);
  }

  function skillRows() {
    const counts = familyCounts(state.P);
    return h('table', { class: 'skills' },
      h('tr', {}, h('th', {}, ''), h('th', {}, 'Mastered'), h('th', {}, 'Learning'), h('th', {}, 'New')),
      FAMILIES.map(f => h('tr', {}, h('td', {}, FAMILY_NAMES[f]),
        h('td', {}, counts[f].mastered), h('td', {}, counts[f].learning), h('td', {}, counts[f].new))));
  }

  function letterGrid() {
    const detail = h('div', { class: 'ldetail muted' }, 'Tap a letter to see its recent tries.');
    const tiles = C.letters.map(l => {
      const rec = state.P.records[recId.letter(l)];
      return h('button', {
        class: `ltile ${rec.state}`,
        onclick: () => {
          const tries = rec.attempts.slice(-10).map(a => `${a.hit ? '✓' : '✗'}${a.picked ? ` (said ${a.picked})` : ''} ${a.day.slice(5)}`);
          const conf = Object.entries(rec.confusions).sort((a, b) => b[1] - a[1]).map(([x, n]) => `${x} ×${n}`);
          detail.replaceChildren(
            h('b', {}, `${l}: ${rec.state}`),
            h('div', {}, tries.length ? `Recent: ${tries.join(', ')}` : 'No tries yet.'),
            conf.length ? h('div', {}, `Mixed up with: ${conf.join(', ')}`) : null,
            rec.reviewDue ? h('div', {}, `Review due ${rec.reviewDue}`) : null);
        },
      }, l);
    });
    return [h('div', { class: 'lgrid' }, tiles), h('div', { class: 'legend muted' },
      h('span', { class: 'ltile new' }, ''), ' new ', h('span', { class: 'ltile learning' }, ''), ' learning ',
      h('span', { class: 'ltile mastered' }, ''), ' mastered'), detail];
  }

  function confusions() {
    const top = topConfusions(state.P, state.day);
    if (!top.length) return h('p', { class: 'muted' }, 'None yet.');
    return h('ol', {}, top.map(c => h('li', {}, `${c.pair} (${c.count})`)));
  }

  function realNonsense() {
    const { real, nonsense } = realVsNonsense(state.P);
    const fmt = t => (t.n ? `${t.hits} of ${t.n} first tries (${Math.round((100 * t.hits) / t.n)}%)` : 'no tries yet');
    const gap = real.n >= 5 && nonsense.n >= 5 && real.hits / real.n - nonsense.hits / nonsense.n > 0.2;
    return [h('p', {}, `Real: ${fmt(real)}`), h('p', {}, `Nonsense: ${fmt(nonsense)}`),
      gap && h('p', { class: 'warn' }, 'A wide gap can mean recognizing familiar words instead of decoding them.')];
  }

  function practice() {
    const hist = history(state.P);
    const points = hist.sessions.filter(s => s.accuracy != null).slice(-30);
    return [h('p', {}, `${plural(hist.days, 'day', 'days')} practiced. First-try accuracy per match:`),
      spark(points.map(p => p.accuracy), { top: 1, ref: 0.6 }),
      h('div', { class: 'muted' }, 'The dashed line is 60%.')];
  }

  // A small line of values; top is the value at the top edge, ref an optional dashed line.
  function spark(values, { top = Math.max(1, ...values) * 1.15, ref = null } = {}) {
    const w = 300;
    const hgt = 60;
    const xy = values.map((v, i) => [values.length > 1 ? (i * w) / (values.length - 1) : w / 2, hgt - (v / top) * hgt]);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `-6 -6 ${w + 12} ${hgt + 12}`);
    svg.setAttribute('class', 'spark');
    svg.innerHTML = (ref != null ? `<line x1="0" x2="${w}" y1="${hgt - (ref / top) * hgt}" y2="${hgt - (ref / top) * hgt}" class="ref"/>` : '')
      + (values.length > 1 ? `<polyline points="${xy.map(p => p.join(',')).join(' ')}"/>` : '')
      + xy.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.5"/>`).join('');
    return svg;
  }

  // The seven levels, which cover the phonics of first grade, and where he is on them. The finish
  // estimate is his own pace carried forward, not a comparison with anyone.
  function road() {
    const r = roadmap(C, state.P, state.day);
    const mark = { done: '✓', here: '▶', ahead: '·' };
    const month = d => new Date(`${d}T12:00`).toLocaleDateString(undefined, { month: 'long' });
    const pace = r.perStep
      ? `So far a step has taken him about ${Math.round(r.perStep)} matches, and he plays about ${Math.round(r.perWeek)} a week.${r.finish ? ` At that pace, the last step would come around ${month(r.finish)}.` : ''}`
      : 'After a few steps, his own pace shows here.';
    return [
      h('p', { class: 'muted' }, 'Levels 1 to 7 cover the phonics of first grade: short vowels, letter pairs like sh and ck, blends, silent e, vowel teams and vowels with r, and endings and two-syllable words, with about 75 sight words along the way.'),
      h('ol', { class: 'road' }, r.levels.map(l => h('li', { class: l.steps.some(s => s.state === 'here') ? 'here' : '' },
        h('b', {}, `Level ${l.level}: `), l.summary,
        h('div', { class: 'road-steps' }, l.steps.map(s => h('span', { class: `rs ${s.state}`, title: s.name }, `${mark[s.state]} ${s.step}`)))))),
      h('p', {}, `${r.left} ${r.left === 1 ? 'step' : 'steps'} to go, counting this one. ${pace}`),
    ];
  }

  // The check-ups: when the next one is due, the button to start it, and his own trend lines.
  function checkups() {
    const P = state.P;
    const due = checkupDue(C, P, state.day);
    const day = d => new Date(`${d}T12:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const status = !due.due
      ? (due.next ? `The next one is due ${day(due.next)}.` : `The first one comes due after ${plural(cfg.checkup.afterMatches, 'match', 'matches')}.`)
      : due.why === 'level' ? `Due now: the level ${due.level + 1} check is waiting, and it runs at the end of the check-up.`
        : due.why === 'first' ? 'Due now: the first one, a starting point for the trend lines.'
          : 'Due now: two weeks since the last one.';
    const start = state.screen === 'home'
      ? h('button', { class: `pbig${due.due ? ' due' : ''}`, onclick: () => { overlay.remove(); startCheckup(); } }, due.due ? 'Start the check-up' : 'Run a check-up now')
      : h('p', { class: 'muted' }, 'Check-ups start from the home screen.');
    const kids = [h('p', { class: 'next' }, status), start,
      h('p', { class: 'muted' }, 'About five minutes, with you beside him: four one-minute parts (letter sounds, the sounds in a spoken word, made-up words, and a short story). You score on the gray strip at the bottom; he sees a cup match with no score and no clock. These lines show only his own results over time.')];
    const s = checkupSeries(P);
    if (!s.letters.length && !s.story.length && !s.nonsense.length && !s.segmenting.length) return kids;
    // The newest number first; the line once there are two check-ups to join.
    const trend = (label, series, unit, extra = null) => {
      if (!series.length) return null;
      const last = series.at(-1);
      const earlier = series.slice(-5, -1).map(p => `${day(p.day)}: ${p.value}`).join(' · ');
      return h('div', { class: 'trend' },
        h('div', { class: 'trend-head' }, h('b', {}, label), h('span', { class: 'trend-now' }, last.value), h('span', { class: 'muted' }, `${unit}, ${day(last.day)}`)),
        series.length > 1 && spark(series.map(p => p.value)),
        earlier && h('div', { class: 'muted' }, `Before: ${earlier}`), extra);
    };
    const whole = s.whole.length ? h('div', { class: 'muted' }, `Whole words read right: ${s.whole.at(-1).value} a minute`) : null;
    kids.push(
      trend('Letter sounds', s.letters, 'right a minute'),
      trend('Sounds in a word', s.segmenting, 'sounds a minute'),
      trend('Made-up words', s.nonsense, 'letter sounds a minute', whole),
      trend('Reading a story', s.story, 'words right a minute'),
      checkupTable());
    return kids;
  }

  function checkupTable() {
    const rows = (state.P.checkups ?? []).slice(-8).reverse();
    const cell = v => h('td', {}, v ?? '–');
    return h('div', { class: 'table-scroll' }, h('table', { class: 'acts cups' },
      h('tr', {}, ['Date', 'Step', 'Letters', 'Sounds', 'Made-up', 'Story', 'Level'].map(t => h('th', {}, t))),
      rows.map(c => h('tr', {},
        cell(c.day.slice(5)), cell(c.step),
        cell(c.parts.letters ? `${c.parts.letters.perMinute}` : null),
        cell(c.parts.segmenting ? `${c.parts.segmenting.perMinute}` : null),
        cell(c.parts.nonsense ? `${c.parts.nonsense.perMinute} (${c.parts.nonsense.wholePerMinute} whole)` : null),
        cell(c.parts.story ? `${c.parts.story.wcpm} (${c.parts.story.accuracy}%)` : null),
        cell(c.levelCheck?.of ? `${c.levelCheck.score}/${c.levelCheck.of}${c.levelCheck.pass ? ' ✓' : ''}` : c.partial ? 'stopped' : null)))),
      h('p', { class: 'muted' }, 'Per minute. Made-up: letter sounds, with whole words in brackets. Story: words read right, with the share read right.'));
  }

  function levelCheckButton() {
    const P = state.P;
    const level = levelOf(C, P.step);
    const hasNext = C.steps.some(s => s.level === level + 1);
    if (!hasNext) return null;
    return h('button', { class: `pbig${P.levelCheckDue ? ' due' : ''}`, onclick: () => levelCheck(level) }, `Run the level ${level + 1} check`);
  }

  // The level check: ten words read aloud, five real and five held-back nonsense. Eight unlocks.
  async function levelCheck(level) {
    const words = levelCheckWords(C, level, `${state.day}:check:${state.P.levelChecks.length}`);
    const results = [];
    await state.audio.prepare([clip.prompt('level-check')]);
    state.audio.prompt('level-check');
    for (const [i, key] of words.entries()) {
      const w = C.byWord.get(key);
      const answer = await new Promise(resolve => {
        overlay.replaceChildren(h('div', { class: 'check' },
          h('div', { class: 'muted' }, `Level ${level + 1} check · word ${i + 1} of ${words.length}. Did the word come out right?`),
          h('div', { class: 'check-word' }, spelling(w)),
          h('div', { class: 'pbtns' },
            h('button', { class: 'pbtn', onclick: () => resolve(true) }, 'Read it'),
            h('button', { class: 'pbtn', onclick: () => resolve(false) }, 'Missed it'))));
      });
      results.push(answer);
    }
    const { P, score, pass } = applyLevelCheck(C, state.P, level, results, state.day);
    state.P = P;
    save();
    overlay.replaceChildren(h('div', { class: 'check' },
      h('div', { class: 'check-score' }, `${score} of ${results.length}`),
      h('p', {}, pass
        ? `Level ${level + 1} is unlocked. When the current step is finished, the queen comes out, and signing her moves up.`
        : `Not yet. ${cfg.levelCheck.pass} are needed. Keep practicing and try again in a few days.`),
      h('button', { class: 'pbig', onclick: render }, 'Back')));
  }

  function settings() {
    const P = state.P;
    const field = (label, input) => h('label', { class: 'field' }, h('span', {}, label), input);
    const name = h('input', { type: 'text', value: P.settings.childName, placeholder: 'Shown on parent screens' });
    name.addEventListener('change', () => {
      P.settings.childName = name.value.trim();
      save();
    });
    const step = h('select', {}, C.steps.map(s => h('option', { value: s.step, selected: s.step === P.step }, `${s.step}: ${s.name}`)));
    step.addEventListener('change', () => {
      P.step = step.value;
      save();
      render();
    });
    const tempo = h('input', { type: 'range', min: 50, max: 110, step: 5, value: P.settings.tempo });
    const tempoValue = h('span', { class: 'muted' }, `${P.settings.tempo} beats a minute`);
    tempo.addEventListener('input', () => {
      P.settings.tempo = Number(tempo.value);
      tempoValue.textContent = `${tempo.value} beats a minute`;
      save();
    });
    const rows = cfg.activities.map(a => {
      const on = h('input', { type: 'checkbox', checked: P.settings.enabled[a] !== false });
      const count = h('input', { type: 'number', min: 1, max: 12, value: P.settings.items[a] });
      on.addEventListener('change', () => {
        P.settings.enabled[a] = on.checked;
        save();
      });
      count.addEventListener('change', () => {
        P.settings.items[a] = Math.max(1, Math.min(12, Number(count.value) || cfg.items[a]));
        save();
      });
      return h('tr', {}, h('td', {}, on), h('td', {}, ACTIVITY_NAMES[a]), h('td', {}, count));
    });
    return [
      field("Child's name", name),
      field('Current step', step),
      h('p', { class: 'muted' }, 'Steps move up on their own. Nothing moves down unless you change it here.'),
      h('table', { class: 'acts' }, h('tr', {}, h('th', {}, 'On'), h('th', {}, 'Activity'), h('th', {}, 'Items')), rows),
      field('Chant tempo', h('span', {}, tempo, ' ', tempoValue)),
      state.screen === 'home'
        ? h('button', { class: 'pbig', onclick: () => { overlay.remove(); runPlacement(); } }, 'Run the placement sweep again')
        : h('p', { class: 'muted' }, 'The placement sweep can be run again from the home screen.'),
    ];
  }

  // Custom headlines: every word is checked against his current step, and any he cannot decode
  // yet is flagged. Only sentences he can read are used.
  function customSentences() {
    const P = state.P;
    if (!C.custom.length) return h('p', { class: 'muted' }, 'Add your own silly headlines to content/custom-sentences.json.');
    return [h('ul', { class: 'custom' }, C.custom.map(s => {
      const blocked = tokenize(C, s.text).filter(t => !t.sight && !(t.entry?.real && !t.entry.oralOnly && stepLE(C, t.entry.step, P.step)
        && t.entry.letters.every(l => letterState(P, l) !== 'new')));
      return h('li', {}, `${s.emoji ?? ''} ${s.text} `, blocked.length
        ? h('span', { class: 'warn' }, `not yet: ${blocked.map(t => t.bare).join(', ')}`)
        : h('span', { class: 'ok' }, 'readable now'));
    })), h('p', { class: 'muted' }, 'Edit content/custom-sentences.json to add more. Each one needs a recording.')];
  }

  function recordings() {
    const P = state.P;
    const recorded = C.clips.filter(c => state.audio.isRecorded(c.id)).length;
    const box = h('input', { type: 'checkbox', checked: P.settings.placeholders });
    box.addEventListener('change', () => {
      P.settings.placeholders = box.checked;
      save();
    });
    return [
      h('p', {}, `${recorded} of ${C.clips.length} clips have audio.`),
      h('button', { class: 'pbig due', onclick: () => openRecorder(state, overlay, { onBack: render }) }, 'Record and make voices'),
      h('label', { class: 'field inline' }, box, h('span', {}, 'Play a placeholder tone, with a caption, for each clip that has no audio yet. Turn this off once everything is recorded: then anything without audio is left out of play.')),
    ];
  }

  function backup() {
    const file = h('input', { type: 'file', accept: 'application/json,.json', class: 'hidden' });
    file.addEventListener('change', async () => {
      try {
        const P = parseImport(C, await file.files[0].text());
        saveProgress(P);
        location.reload();
      } catch (e) {
        alert(e.message);
      }
    });
    return h('div', { class: 'pbtns left' },
      h('button', { class: 'pbig', onclick: () => exportProgress(state.P, state.day) }, 'Export progress'),
      h('button', { class: 'pbig', onclick: () => file.click() }, 'Import progress'), file,
      h('button', {
        class: 'pbig danger',
        onclick: async () => {
          const question = activePlayer() === 'test'
            ? "Erase the test player's progress? Your child's progress stays as it is."
            : 'Erase all progress, players, and words? This cannot be undone. Export first if you might want it back.';
          if (!confirm(question)) return;
          clearProgress();
          await sleep(50);
          location.reload();
        },
      }, 'Reset everything'));
  }
}
