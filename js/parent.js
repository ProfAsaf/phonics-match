// The parent area: one screen behind a three-second press on the corner icon, holding the
// dashboard, settings, and backup (SPEC.md, "Parent view"). No percentiles, grade equivalents, or
// comparisons appear here or anywhere else.
import { CONFIG as cfg } from './config.js';
import { clip, tokenize, stepLE, levelOf } from './content.js';
import { FAMILIES, recId } from './mastery.js';
import { familyCounts, topConfusions, realVsNonsense, history, nextStep, FAMILY_NAMES } from './stats.js';
import { levelCheckWords, applyLevelCheck } from './session.js';
import { letterState } from './choose.js';
import { saveProgress, exportProgress, parseImport, clearProgress } from './storage.js';
import { h, sleep } from './ui.js';

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const ACTIVITY_NAMES = {
  soundMatch: 'Sound match', blendIt: 'Blend it', findSound: 'Find the sound',
  buildIt: 'Build it', readFind: 'Read and find', readAloud: 'Read aloud',
};

export function openParent(state, { onClose, runPlacement }) {
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
    overlay.replaceChildren(
      h('header', { class: 'phead' },
        h('div', {}, h('h1', {}, P.settings.childName ? `${P.settings.childName}'s phonics` : 'Phonics'),
          h('div', { class: 'muted' }, `Step ${P.step} · ${plural(P.sessionCount, 'match', 'matches')} played`)),
        h('button', { class: 'pclose', onclick: close }, 'Close')),
      section('Next step', h('p', { class: 'next' }, nextStep(C, P, state.day)),
        levelCheckButton()),
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
    const w = 300;
    const hgt = 60;
    const xy = points.map((p, i) => `${points.length > 1 ? (i * w) / (points.length - 1) : w / 2},${hgt - p.accuracy * hgt}`).join(' ');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `-4 -4 ${w + 8} ${hgt + 8}`);
    svg.setAttribute('class', 'spark');
    svg.innerHTML = `<line x1="0" x2="${w}" y1="${hgt * 0.4}" y2="${hgt * 0.4}" class="ref"/>`
      + (points.length ? `<polyline points="${xy}"/>` : '');
    return [h('p', {}, `${plural(hist.days, 'day', 'days')} practiced. First-try accuracy per match:`), svg,
      h('div', { class: 'muted' }, 'The dashed line is 60%.')];
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
          h('div', { class: 'check-word' }, w.letters.join('')),
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
    const step = h('select', {}, C.steps.map(s => h('option', { value: s.step, selected: s.step === P.step }, `${s.step}: short ${s.vowel}`)));
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
      h('p', {}, `${recorded} of ${C.clips.length} clips recorded.`),
      h('label', { class: 'field inline' }, box, h('span', {}, 'Play a placeholder tone, with a caption, for each clip not recorded yet. Turn this off once recording is done: then anything without a recording is left out of play.')),
      h('p', { class: 'muted' }, 'Record on a computer: run "node tools/studio-server.mjs" and open the address it prints, then add /studio.html.'),
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
          if (!confirm('Erase all progress, players, and words? This cannot be undone. Export first if you might want it back.')) return;
          clearProgress();
          await sleep(50);
          location.reload();
        },
      }, 'Reset everything'));
  }
}
