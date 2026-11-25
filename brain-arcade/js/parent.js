// The grown-up area: players, reports (grade levels by strand, skills, history, activity),
// school scores, settings, backups, and a one-minute read-aloud fluency check.
import { store } from './store.js';
import * as E from './engine.js';
import { SUBJECTS, STRANDS, DIBELS_MEASURES, IXL_STRANDS } from './curriculum.js';
import { gradeLabel, levelNumber, expectedNow, status, GRADE_CHOICES, gradeName, schoolYearFraction } from './scale.js';
import { englishVoices, configureSpeech, speak, currentVoiceName, stopSpeech } from './speech.js';
import { setSfx, sfx } from './sfx.js';
import { $, $$, esc, toast, confirmBox, wait } from './ui.js';
import { loadFluency, fluencyNorm, fluencyGE } from './fluency.js';

const AVATARS = ['🦊', '🐼', '🐯', '🦁', '🐸', '🐵', '🐨', '🐧', '🦄', '🐙', '🦖', '🐶', '🐱', '🐰', '🐻', '🐲'];
const COLORS = ['#ff6b6b', '#ffa94d', '#f7c531', '#51cf66', '#4dabf7', '#9775fa', '#f783ac', '#20c997'];
const SCALE = [-1, 5.5];
let root, onClose;

export function openParent(r, opts = {}) {
  root = r;
  onClose = opts.onClose;
  stopSpeech();
  if (opts.startWith === 'add') return editPlayer(null);
  if (opts.startWith === 'setup') return setupCodeScreen(() => { store.save(); onClose?.(); });
  parentHome();
}

function frame(title, body, { back = parentHome, cls = '' } = {}) {
  root.innerHTML = `<div class="screen parent ${cls}"><header class="p-top"><button class="p-back">‹</button><h2>${title}</h2><button class="p-close">Done</button></header><div class="p-body">${body}</div></div>`;
  $('.p-back', root).addEventListener('click', () => back());
  $('.p-close', root).addEventListener('click', () => { store.save(); onClose?.(); });
  return $('.p-body', root);
}

const levelText = (g) => (g < 0 ? gradeLabel(g) : `${gradeLabel(g)} · ${levelNumber(g)}`);

function parentHome() {
  const ps = store.players;
  const body = frame('Grown-ups', `
    <div class="p-cards">${ps.map((p) => {
      const ex = expectedNow(p.grade);
      const sub = (s) => {
        if (!p.subjects?.[s]?.strands || !Object.values(p.subjects[s].strands).some((x) => x.n > 0)) return `<span class="muted">${SUBJECTS[s].name}: not played yet</span>`;
        const o = E.overallLevel(p, s), st = status(o.mean, ex);
        return `<span><i class="dot" style="background:${st.color}"></i>${SUBJECTS[s].name}: <b>${levelText(o.mean)}</b></span>`;
      };
      return `<button class="p-kid" data-id="${p.id}" style="--c:${p.color}"><span class="av">${p.avatar}</span><span class="info"><b>${esc(p.name)}</b><small>${gradeName(p.grade)} · typical level now: ${gradeLabel(ex)}</small>${sub('math')}${sub('reading')}</span><span class="chev">›</span></button>`;
    }).join('')}</div>
    <div class="p-actions">
      <button class="btn primary add">+ Add a player</button>
      <button class="btn setupcode">📋 Paste a setup code</button>
      <button class="btn fluency">📖 Read-aloud check</button>
      <button class="btn settings">⚙️ Settings</button>
      <button class="btn backup">💾 Backup</button>
    </div>
    <p class="fine">Levels use a grade scale like IXL's diagnostic: 270 means "ready for late-2nd-grade skills". They are estimates from the questions answered here, not a standardized test; the band on each bar shows how sure the estimate is.</p>`, { back: () => { store.save(); onClose?.(); } });
  $$('.p-kid', body).forEach((b) => b.addEventListener('click', () => report(store.player(b.dataset.id))));
  $('.add', body).addEventListener('click', () => editPlayer(null));
  $('.setupcode', body).addEventListener('click', () => setupCodeScreen(parentHome));
  $('.fluency', body).addEventListener('click', () => fluencyStart());
  $('.settings', body).addEventListener('click', settingsScreen);
  $('.backup', body).addEventListener('click', backupScreen);
}

// ---------------------------------------------------------------- report
const X = (g) => 8 + ((Math.max(SCALE[0], Math.min(SCALE[1], g)) - SCALE[0]) / (SCALE[1] - SCALE[0])) * 284;
function barSVG(info, st, ex, base) {
  let s = `<svg viewBox="0 0 300 34" class="lvlbar">`;
  s += `<rect x="8" y="12" width="284" height="10" rx="5" fill="#eef1f6"/>`;
  s += `<rect x="${X(st.lo)}" y="12" width="${X(st.hi) - X(st.lo)}" height="10" rx="5" fill="#dfe5ef"/>`;
  for (let g = -1; g <= 5; g++) s += `<line x1="${X(g)}" y1="10" x2="${X(g)}" y2="24" stroke="#c3cad8" stroke-width="1"/><text x="${X(g) + 2}" y="33" font-size="7.5" fill="#8a93a6">${g < 0 ? 'PK' : g === 0 ? 'K' : g}</text>`;
  s += `<line x1="${X(ex)}" y1="4" x2="${X(ex)}" y2="28" stroke="#36405a" stroke-width="1.6" stroke-dasharray="2 2"/>`;
  if (base != null) s += `<rect x="${X(base) - 4}" y="13" width="8" height="8" transform="rotate(45 ${X(base)} 17)" fill="#fff" stroke="#6c757d" stroke-width="1.6"/>`;
  if (info.state === 'mastered') s += `<rect x="${X(st.lo)}" y="12" width="${X(st.hi) - X(st.lo)}" height="10" rx="5" fill="#3aa757" opacity=".85"/>`;
  else if (info.state !== 'notyet') {
    const c = status(info.mean, ex).color;
    s += `<rect x="${X(info.q10)}" y="13" width="${Math.max(3, X(info.q90) - X(info.q10))}" height="8" rx="4" fill="${c}" opacity=".35"/>`;
    s += `<circle cx="${X(info.mean)}" cy="17" r="6.5" fill="${c}" stroke="#fff" stroke-width="2"/>`;
  }
  return s + '</svg>';
}
function baselineFor(player, strandId) {
  const p = E.schoolPrior(player, strandId);
  return p ? p.mean : null;
}

function report(player, tab = 'math') {
  const ex = expectedNow(player.grade);
  const tabs = ['math', 'reading', 'activity'];
  const body = frame(`${player.avatar} ${esc(player.name)}`, `
    <div class="p-sub">${gradeName(player.grade)} · a typical ${gradeName(player.grade)} student is at <b>${gradeLabel(ex)}</b> right now <button class="link edit">Edit player & school scores</button></div>
    <div class="tabs">${tabs.map((t) => `<button class="tab ${t === tab ? 'on' : ''}" data-t="${t}">${t === 'math' ? '🔢 Math' : t === 'reading' ? '📖 Reading' : '📅 Activity'}</button>`).join('')}</div>
    <div class="tab-body"></div>`);
  $('.edit', body).addEventListener('click', () => editPlayer(player));
  $$('.tab', body).forEach((b) => b.addEventListener('click', () => report(player, b.dataset.t)));
  const tb = $('.tab-body', body);
  if (tab === 'activity') return activityTab(player, tb);
  const subject = tab;
  E.ensureSubject(player, subject);
  const o = E.overallLevel(player, subject);
  const stO = status(o.mean, ex);
  const pp = E.placementProgress(player, subject);
  const placed = E.placementDone(player, subject);
  const answered = SUBJECTS[subject].strands.reduce((a, id) => a + player.subjects[subject].strands[id].n, 0);
  const ixlOverall = subject === 'math' && Number.isFinite(player.school?.ixl?.overall) ? player.school.ixl.overall : null;
  tb.innerHTML = `
    <div class="overall" style="--sc:${stO.color}">
      <div><small>Overall ${subject} level</small><b>${answered ? levelText(o.mean) : 'Not measured yet'}</b>
      ${answered ? `<span class="chip" style="background:${stO.color}">${stO.label}</span>` : ''}</div>
      <div class="ov-meta">${placed ? `Level check done${player.subjects[subject].placedAt ? ' ' + new Date(player.subjects[subject].placedAt).toLocaleDateString() : ''}` : `Level check: ${pp.n} of about ${pp.max} questions`}
      · ${answered} answers${ixlOverall ? ` · school IXL (Sept): ${ixlOverall}` : ''}</div>
    </div>
    <div class="legend"><span><i class="lg-dot"></i> estimate (band = likely range)</span><span><i class="lg-exp"></i> typical for grade now</span><span><i class="lg-base"></i> from school scores</span></div>
    <div class="strands">${SUBJECTS[subject].strands.map((id) => {
      const st = STRANDS[id], info = E.strandInfo(player, id);
      const txt = info.state === 'mastered' ? '<span class="ok">Mastered ✓</span>' : info.state === 'notyet' ? '<span class="muted">Not started yet</span>' : info.n === 0 ? `<span class="muted">${info.generic ? 'Not measured yet' : 'Starting guess: ' + levelText(info.mean)}</span>` : `<b>${levelText(info.mean)}</b>${info.sd > 0.45 ? ' <span class="muted">(still measuring)</span>' : ''}`;
      return `<button class="strand" data-id="${id}"><div class="s-head"><span>${st.name}</span><span>${txt}</span></div>${barSVG(info, st, ex, info.state === 'level' || info.state === 'measuring' ? baselineFor(player, id) : null)}</button>`;
    }).join('')}</div>
    <div class="p-actions"><button class="btn redo">Redo the ${subject} level check</button></div>
    ${subject === 'reading' ? fluencySummary(player) : ''}`;
  $$('.strand', tb).forEach((b) => b.addEventListener('click', () => strandSheet(player, b.dataset.id)));
  $('.redo', tb).addEventListener('click', async () => {
    if (await confirmBox(`Start a new ${subject} level check for ${player.name}? Their history stays; the next ${subject} game starts with the check.`, { ok: 'Start new check' })) {
      E.restartPlacement(player, subject); store.save(); report(player, subject);
    }
  });
}

function sparkSVG(hist) {
  if (!hist || hist.length < 2) return '<p class="muted">The history line appears after a few days of play.</p>';
  const pts = hist.slice(-60);
  const xs = pts.map((p) => p[0]), x0 = Math.min(...xs), x1 = Math.max(...xs) || x0 + 1;
  const ys = pts.flatMap((p) => [(p[1] - p[2]) / 100, (p[1] + p[2]) / 100]);
  let y0 = Math.floor(Math.min(...ys) * 2) / 2, y1 = Math.ceil(Math.max(...ys) * 2) / 2;
  if (y1 - y0 < 1) { y0 -= 0.5; y1 += 0.5; }
  const X2 = (x) => 30 + ((x - x0) / Math.max(1, x1 - x0)) * 260, Y = (y) => 90 - ((y - y0) / (y1 - y0)) * 80;
  const band = pts.map((p) => `${X2(p[0])},${Y((p[1] + p[2]) / 100)}`).join(' ') + ' ' + [...pts].reverse().map((p) => `${X2(p[0])},${Y((p[1] - p[2]) / 100)}`).join(' ');
  let s = `<svg viewBox="0 0 300 104" class="spark">`;
  for (let g = Math.ceil(y0); g <= y1; g += 0.5) s += `<line x1="30" y1="${Y(g)}" x2="290" y2="${Y(g)}" stroke="#e3e7ef"/><text x="2" y="${Y(g) + 3}" font-size="8" fill="#8a93a6">${g < 0 ? 'PK' : g.toFixed(1)}</text>`;
  s += `<polygon points="${band}" fill="#4dabf7" opacity=".2"/><polyline points="${pts.map((p) => `${X2(p[0])},${Y(p[1] / 100)}`).join(' ')}" fill="none" stroke="#1c7ed6" stroke-width="2.5"/>`;
  const d = (n) => new Date(n * 86400000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  s += `<text x="30" y="102" font-size="8" fill="#8a93a6">${d(x0)}</text><text x="290" y="102" font-size="8" fill="#8a93a6" text-anchor="end">${d(x1)}</text>`;
  return s + '</svg>';
}

function strandSheet(player, id) {
  const st = STRANDS[id], info = E.strandInfo(player, id);
  const sk = E.skillStatus(player, id);
  const label = { mastered: '✓ Mastered', working: '▶ Working on', next: '○ Coming next', later: '· Later' };
  const row = (s) => `<li class="${s.status}"><b>${esc(s.name)}</b><small>${gradeLabel(s.lo)} to ${gradeLabel(s.hi)}${s.n ? ` · ${s.n} tries${s.acc != null ? `, ${Math.round(s.acc * 100)}% right recently` : ''}` : ''}</small></li>`;
  const el = document.createElement('div');
  el.className = 'sheet-wrap';
  el.innerHTML = `<div class="sheet strand-sheet"><button class="x">✕</button><h3>${st.name}</h3><p class="muted">${st.about}</p>
    <p>${info.state === 'mastered' ? 'Everything in this area is mastered.' : info.state === 'notyet' ? 'Not started yet (this area begins later).' : `Level: <b>${levelText(info.mean)}</b> · likely between ${gradeLabel(info.q10)} and ${gradeLabel(info.q90)} · ${info.n} answers`}</p>
    ${sparkSVG(player.history?.[id])}
    ${['working', 'next'].map((g) => sk.some((s) => s.status === g) ? `<h4>${label[g]}</h4><ul class="skills">${sk.filter((s) => s.status === g).map(row).join('')}</ul>` : '').join('')}
    ${sk.some((s) => s.status === 'mastered') ? `<h4>${label.mastered} (${sk.filter((s) => s.status === 'mastered').length})</h4><p class="muted small">${sk.filter((s) => s.status === 'mastered').map((s) => esc(s.name)).join(' · ')}</p>` : ''}
    ${sk.some((s) => s.status === 'later') ? `<h4>${label.later} (${sk.filter((s) => s.status === 'later').length})</h4><p class="muted small">${sk.filter((s) => s.status === 'later').map((s) => esc(s.name)).join(' · ')}</p>` : ''}</div>`;
  root.appendChild(el);
  el.addEventListener('click', (e) => { if (e.target === el || e.target.closest('.x')) el.remove(); });
}

function activityTab(player, tb) {
  const days = player.days || {};
  const today = new Date();
  const list = [];
  for (let k = 13; k >= 0; k--) { const d = new Date(today); d.setDate(d.getDate() - k); const key = E.dayKey(d.getTime()); list.push({ d, ...(days[key] || { q: 0, ok: 0, ms: 0 }) }); }
  const maxQ = Math.max(10, ...list.map((x) => x.q));
  const week = list.slice(-7);
  const wq = week.reduce((a, x) => a + x.q, 0), wok = week.reduce((a, x) => a + x.ok, 0), wms = week.reduce((a, x) => a + x.ms, 0);
  let streak = 0;
  for (let k = list.length - 1; k >= 0 && list[k].q > 0; k--) streak++;
  const skillName = (id) => E.SKILL[id]?.name || id;
  tb.innerHTML = `
    <div class="stats"><div><b>${wq}</b><small>questions this week</small></div><div><b>${wq ? Math.round((wok / wq) * 100) : 0}%</b><small>right on the first try</small></div><div><b>${Math.round(wms / 60000)}</b><small>minutes answering</small></div><div><b>${streak}</b><small>day streak</small></div></div>
    <svg viewBox="0 0 300 110" class="daybars">${list.map((x, i) => `<rect x="${8 + i * 20.5}" y="${92 - (x.q / maxQ) * 80}" width="15" height="${(x.q / maxQ) * 80}" rx="3" fill="#4dabf7"/><rect x="${8 + i * 20.5}" y="${92 - (x.ok / maxQ) * 80}" width="15" height="${(x.ok / maxQ) * 80}" rx="3" fill="#1c7ed6"/><text x="${15.5 + i * 20.5}" y="104" font-size="7.5" text-anchor="middle" fill="#8a93a6">${x.d.getDate()}</text>`).join('')}</svg>
    <p class="muted small">Light bars: questions per day. Dark: right on the first try.</p>
    <h4>Recent answers</h4>
    <ul class="recent">${(player.log || []).slice(-25).reverse().map((l) => `<li class="${l.ok ? 'ok' : 'miss'}"><span>${l.ok ? '✓' : l.dk ? '🤔' : '✗'}</span><b>${esc(skillName(l.s))}</b><small>${gradeLabel(l.b)} · ${Math.round(l.ms / 100) / 10}s</small></li>`).join('') || '<li class="muted">No answers yet.</li>'}</ul>`;
}

function fluencySummary(player) {
  const f = player.fluency || [];
  if (!f.length) return '<div class="flu-sum"><h4>Read-aloud fluency</h4><p class="muted">No read-aloud checks yet. Use “📖 Read-aloud check” on the Grown-ups page (1 minute, with you listening).</p></div>';
  return `<div class="flu-sum"><h4>Read-aloud fluency (words correct per minute)</h4><ul>${f.slice(-8).reverse().map((x) => `<li><b>${x.wcpm} wcpm</b> · ${x.acc}% accurate · ${esc(x.title)} (${gradeLabel(x.g)} passage) · ${new Date(x.t).toLocaleDateString()}${x.ge != null ? ` · reads like <b>${gradeLabel(x.ge)}</b>` : ''}</li>`).join('')}</ul></div>`;
}

// ---------------------------------------------------------------- edit player + school scores
function editPlayer(player) {
  const isNew = !player;
  const p = player || { name: '', grade: 1, avatar: AVATARS[store.players.length % AVATARS.length], color: COLORS[store.players.length % COLORS.length], settings: { subjectMode: 'choice', readAloud: 'auto', focus: {} } };
  const sc = p.school || {};
  const ixl = sc.ixl || {}, dib = sc.dibels || {};
  const chip = (m, v) => ['wellbelow', 'below', 'at', 'above'].map((k) => `<button type="button" class="st-chip st-${k} ${dib[m] === k ? 'on' : ''}" data-m="${m}" data-v="${k}">${{ wellbelow: 'Well below', below: 'Below', at: 'At', above: 'Above' }[k]}</button>`).join('');
  const body = frame(isNew ? 'New player' : `Edit ${esc(p.name)}`, `
    <form class="pform">
      <label>Name <input name="name" value="${esc(p.name)}" maxlength="20" autocomplete="off" required></label>
      <label>Grade <select name="grade">${GRADE_CHOICES.map((g) => `<option value="${g.grade}" ${g.grade === p.grade ? 'selected' : ''}>${g.label}</option>`).join('')}</select></label>
      <div class="lbl">Picture</div><div class="avs">${AVATARS.map((a) => `<button type="button" class="av-pick ${a === p.avatar ? 'on' : ''}" data-a="${a}">${a}</button>`).join('')}</div>
      <div class="lbl">Color</div><div class="cols">${COLORS.map((c) => `<button type="button" class="col-pick ${c === p.color ? 'on' : ''}" data-c="${c}" style="background:${c}"></button>`).join('')}</div>
      <label>Math or reading <select name="subjectMode">
        <option value="choice" ${p.settings.subjectMode === 'choice' ? 'selected' : ''}>Child picks each time</option>
        <option value="alternate" ${p.settings.subjectMode === 'alternate' ? 'selected' : ''}>Take turns (math, then reading…)</option>
        <option value="math" ${p.settings.subjectMode === 'math' ? 'selected' : ''}>Math only</option>
        <option value="reading" ${p.settings.subjectMode === 'reading' ? 'selected' : ''}>Reading only</option></select></label>
      <label>Read questions aloud <select name="readAloud">
        <option value="auto" ${p.settings.readAloud === 'auto' ? 'selected' : ''}>Automatic (until they read well)</option>
        <option value="always" ${p.settings.readAloud === 'always' ? 'selected' : ''}>Always</option>
        <option value="tap" ${p.settings.readAloud === 'tap' ? 'selected' : ''}>Only when they tap 🔊</option></select></label>
      <details ${isNew ? 'open' : ''}><summary>School scores (optional, makes the first level check faster and more accurate)</summary>
        <p class="muted small">From the IXL LevelUp Diagnostic and mCLASS DIBELS reports. Leave blank what you don't have.</p>
        <h4>IXL math levels</h4>
        <label>Date of the IXL report <input type="date" name="ixlDate" value="${esc(ixl.date || '')}"></label>
        <div class="ixl-grid">${IXL_STRANDS.map((s) => `<label>${s.name}<input type="number" inputmode="numeric" min="0" max="1300" step="10" name="ixl_${s.id}" value="${Number.isFinite(ixl[s.id]) ? ixl[s.id] : ''}"></label>`).join('')}</div>
        <h4>DIBELS reading</h4>
        <div class="row2"><label>Date of the DIBELS report <input type="date" name="dibDate" value="${esc(dib.date || '')}"></label>
        <label>Grade when tested <select name="dibGrade">${GRADE_CHOICES.map((g) => `<option value="${g.grade}" ${g.grade === (dib.grade ?? p.grade) ? 'selected' : ''}>${g.label}</option>`).join('')}</select></label></div>
        <p class="muted small">For each measure, tap the color band the report shows (red = well below, yellow = below, green = at, blue = above benchmark). Tap again to clear.</p>
        <div class="dib">${DIBELS_MEASURES.map((m) => `<div class="dib-row"><span>${m.name}</span><div class="chips">${chip(m.id)}</div></div>`).join('')}</div>
      </details>
      ${isNew ? '' : `<details><summary>Focus areas (asked more often)</summary><div class="focus">${Object.entries(STRANDS).map(([id, st]) => `<label class="chk"><input type="checkbox" name="focus_${id}" ${p.settings.focus?.[id] ? 'checked' : ''}> ${st.name} <small>(${SUBJECTS[st.subject].name})</small></label>`).join('')}</div></details>`}
      <div class="p-actions"><button class="btn primary save" type="submit">${isNew ? 'Add player' : 'Save'}</button>${isNew ? '' : '<button type="button" class="btn restart">↺ Start over</button><button type="button" class="btn danger del">Delete player</button>'}</div>
    </form>`, { back: () => (player ? report(player) : parentHome()) });
  const f = $('form', body);
  $$('.av-pick', f).forEach((b) => b.addEventListener('click', () => { $$('.av-pick', f).forEach((x) => x.classList.remove('on')); b.classList.add('on'); }));
  $$('.col-pick', f).forEach((b) => b.addEventListener('click', () => { $$('.col-pick', f).forEach((x) => x.classList.remove('on')); b.classList.add('on'); }));
  $$('.st-chip', f).forEach((b) => b.addEventListener('click', () => { const on = b.classList.contains('on'); $$(`.st-chip[data-m="${b.dataset.m}"]`, f).forEach((x) => x.classList.remove('on')); if (!on) b.classList.add('on'); }));
  $('.restart', f)?.addEventListener('click', async () => {
    if (!(await confirmBox(`Start ${p.name} over? This erases their answers, levels, history, stars and stickers. School scores and settings stay.`, { ok: 'Start over', danger: true }))) return;
    for (const k of ['subjects', 'skills', 'history', 'log', 'days', 'seen', 'fluency', 'lastSubject', 'greeted']) delete player[k];
    player.stars = 0;
    player.stickers = [];
    E.reseed(player);
    store.save();
    toast(`${p.name} starts fresh`);
    report(player);
  });
  $('.del', f)?.addEventListener('click', async () => {
    if (await confirmBox(`Delete ${p.name} and all of their progress? This cannot be undone.`, { ok: 'Delete', danger: true })) { store.removePlayer(p.id); parentHome(); }
  });
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(f);
    const name = String(fd.get('name') || '').trim();
    if (!name) return toast('Please enter a name');
    const ixlNew = { date: fd.get('ixlDate') || '' };
    let anyIxl = false;
    for (const s of IXL_STRANDS) { const v = parseFloat(fd.get('ixl_' + s.id)); if (Number.isFinite(v)) { ixlNew[s.id] = v; anyIxl = true; } }
    const dibNew = { date: fd.get('dibDate') || '', grade: +fd.get('dibGrade') };
    let anyDib = false;
    for (const m of DIBELS_MEASURES) { const on = $(`.st-chip.on[data-m="${m.id}"]`, f); if (on) { dibNew[m.id] = on.dataset.v; anyDib = true; } }
    const fields = {
      name, grade: +fd.get('grade'), avatar: $('.av-pick.on', f)?.dataset.a || p.avatar, color: $('.col-pick.on', f)?.dataset.c || p.color,
      school: { ...(anyIxl ? { ixl: ixlNew } : {}), ...(anyDib ? { dibels: dibNew } : {}) },
    };
    const settings = { ...p.settings, subjectMode: fd.get('subjectMode'), readAloud: fd.get('readAloud') };
    if (!isNew) { settings.focus = {}; for (const id of Object.keys(STRANDS)) if (fd.get('focus_' + id)) settings.focus[id] = true; }
    let target;
    if (isNew) target = store.addPlayer({ ...fields, settings });
    else { Object.assign(player, fields, { settings }); target = player; }
    E.reseed(target);
    store.save();
    toast(isNew ? `${name} added` : 'Saved');
    isNew ? parentHome() : report(target);
  });
}

// ---------------------------------------------------------------- setup code
function setupCodeScreen(back = parentHome) {
  const body = frame('Paste a setup code', `
    <p>A setup code adds players with their grade and school scores already filled in. Paste the whole code (it starts with { and ends with }). Players already here with the same name get their scores updated and keep their progress.</p>
    <textarea class="setup-text" rows="9" placeholder='{"players": [ ... ]}' autocapitalize="off" autocorrect="off" spellcheck="false"></textarea>
    <div class="p-actions"><button class="btn primary go">Add players</button></div>`, { back });
  $('.go', body).addEventListener('click', () => {
    try {
      const { added, updated } = store.mergeSetup($('.setup-text', body).value);
      for (const p of [...added, ...updated]) E.reseed(p);
      store.save();
      const names = (list) => list.map((p) => p.name).join(', ');
      toast([added.length ? `Added ${names(added)}` : '', updated.length ? `Updated ${names(updated)}` : ''].filter(Boolean).join(' · ') || 'Nothing to add', 3200);
      parentHome();
    } catch (err) { toast(err.message, 4200); }
  });
}

// ---------------------------------------------------------------- settings & backup
function settingsScreen() {
  const s = store.settings;
  const vs = englishVoices();
  const body = frame('Settings', `
    <form class="pform">
      <label>Voice <select name="voice"><option value="">Automatic (${esc(currentVoiceName() || 'device default')})</option>${vs.map((v) => `<option value="${esc(v.name)}" ${s.voice === v.name ? 'selected' : ''}>${esc(v.name)} (${esc(v.lang)})</option>`).join('')}</select></label>
      <p class="muted small">On an iPad, nicer voices can be downloaded in Settings → Accessibility → Spoken Content → Voices → English (look for “Enhanced” or “Premium”), then picked here.</p>
      <label>Speaking speed <input type="range" name="rate" min="0.7" max="1.2" step="0.05" value="${s.rate}"></label>
      <button type="button" class="btn test">🔊 Test the voice</button>
      <label class="chk"><input type="checkbox" name="sfx" ${s.sfx ? 'checked' : ''}> Sound effects</label>
      <label class="chk"><input type="checkbox" name="showDontKnow" ${s.showDontKnow ? 'checked' : ''}> Show the “🤔 Not sure” button</label>
      <label>Questions per game <select name="roundLength">${[0, 6, 8, 10, 12, 15].map((n) => `<option value="${n}" ${+s.roundLength === n ? 'selected' : ''}>${n ? n : 'Automatic (8 for Pre-K/K, 10 for older)'}</option>`).join('')}</select></label>
      <div class="p-actions"><button class="btn primary" type="submit">Save</button></div>
    </form>`);
  const f = $('form', body);
  const apply = () => { const fd = new FormData(f); configureSpeech({ voice: fd.get('voice'), rate: +fd.get('rate') }); };
  $('.test', f).addEventListener('click', () => { apply(); speak('Hi! Which one rhymes with cat: dog, hat, or sun?'); });
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(f);
    Object.assign(s, { voice: fd.get('voice'), rate: +fd.get('rate'), sfx: !!fd.get('sfx'), showDontKnow: !!fd.get('showDontKnow'), roundLength: +fd.get('roundLength') });
    configureSpeech(s);
    setSfx(s.sfx);
    store.save();
    toast('Saved');
    parentHome();
  });
}

function backupScreen() {
  const body = frame('Backup', `
    <p>Progress is saved on this device only. Safari can clear a website's storage if it isn't used for a while, so add the game to the Home Screen (Share → Add to Home Screen) and keep a backup now and then.</p>
    <div class="p-actions"><button class="btn primary exp">⬇️ Save a backup file</button>
    <label class="btn imp">⬆️ Load a backup file<input type="file" accept="application/json,.json" hidden></label>
    <button class="btn danger reset">Erase everything</button></div>`);
  $('.exp', body).addEventListener('click', () => {
    const blob = new Blob([store.exportText()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `brain-arcade-backup-${E.dayKey()}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  });
  $('.imp input', body).addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      if (!(await confirmBox('Replace everything on this device with this backup?', { ok: 'Replace', danger: true }))) return;
      store.importText(text);
      toast('Backup loaded');
      parentHome();
    } catch (err) { toast(err.message || 'That file could not be read'); }
  });
  $('.reset', body).addEventListener('click', async () => {
    if (await confirmBox('Erase all players and progress on this device?', { ok: 'Erase', danger: true })) { store.resetAll(); toast('Erased'); parentHome(); }
  });
}

// ---------------------------------------------------------------- read-aloud fluency check
async function fluencyStart(player) {
  if (!player) {
    const ps = store.players.filter((p) => p.grade >= 1);
    const body = frame('Read-aloud check', `<p>A one-minute check like the DIBELS “oral reading fluency” part. You listen while your child reads a story out loud, and tap any word they misread or skip.</p>
      <p class="muted small">Best for readers in 1st grade and up.</p>
      <div class="who small">${ps.map((p) => `<button class="who-btn" data-id="${p.id}" style="--c:${p.color}"><span class="av">${p.avatar}</span><b>${esc(p.name)}</b></button>`).join('') || '<p class="muted">Add a player in 1st grade or above first.</p>'}</div>`);
    $$('.who-btn', body).forEach((b) => b.addEventListener('click', () => fluencyStart(store.player(b.dataset.id))));
    return;
  }
  const passages = await loadFluency();
  const ex = expectedNow(player.grade);
  const target = Math.min(ex, Math.max(1, E.strandInfo(player, 'phonics').mean + 0.3));
  const def = [...passages].sort((a, b) => Math.abs(a.g - Math.floor(ex)) - Math.abs(b.g - Math.floor(ex)) || a.g - b.g)[0];
  const done = new Set((player.fluency || []).map((x) => x.id));
  const body = frame(`Read-aloud check · ${esc(player.name)}`, `
    <p>Pick a story. Grade-level stories (★) match the school check; an easier one is fine for a newer reader.</p>
    <div class="flu-list">${passages.map((p) => `<button class="flu-p ${p.id === def.id ? 'on' : ''}" data-id="${p.id}"><b>${p.id === def.id ? '★ ' : ''}${esc(p.title)}</b><small>${gradeLabel(p.g)} · ${p.text.split(/\s+/).length} words${done.has(p.id) ? ' · read before' : ''}</small></button>`).join('')}</div>
    <p class="muted small">Your child's reading level here suggests about ${gradeLabel(target)}.</p>`);
  $$('.flu-p', body).forEach((b) => b.addEventListener('click', () => fluencyRun(player, passages.find((p) => p.id === b.dataset.id))));
}

function fluencyRun(player, passage) {
  const words = passage.text.split(/\s+/);
  const body = frame(`${esc(passage.title)}`, `
    <div class="flu-bar"><div class="timer">1:00</div><button class="btn primary start">Start the minute</button><span class="flu-tip">Tap a word they misread or skip. Tap again to undo.</span></div>
    <div class="flu-text">${words.map((w, i) => `<span class="fw" data-i="${i}">${esc(w)}</span>`).join(' ')}</div>`, { back: () => fluencyStart(player), cls: 'flu' });
  const timerEl = $('.timer', body), tip = $('.flu-tip', body);
  const errs = new Set();
  let phase = 'ready', left = 60, tick = null;
  $$('.fw', body).forEach((w) => w.addEventListener('click', () => {
    const i = +w.dataset.i;
    if (phase === 'running' || phase === 'ready') { if (errs.has(i)) { errs.delete(i); w.classList.remove('err'); } else { errs.add(i); w.classList.add('err'); } }
    else if (phase === 'last') finish(i);
  }));
  $('.start', body).addEventListener('click', (e) => {
    if (phase !== 'ready') return;
    phase = 'running';
    e.target.disabled = true;
    tick = setInterval(() => {
      left--;
      timerEl.textContent = `0:${String(left).padStart(2, '0')}`;
      if (left <= 0) {
        clearInterval(tick);
        phase = 'last';
        sfx.win();
        timerEl.textContent = 'Time!';
        tip.textContent = 'Now tap the last word they read.';
        body.classList.add('pick-last');
      }
    }, 1000);
  });
  function finish(last) {
    phase = 'done';
    const read = last + 1, e = [...errs].filter((i) => i <= last).length;
    const wcpm = Math.max(0, read - e), acc = Math.round(((read - e) / read) * 100);
    const ge = fluencyGE(wcpm, passage.g);
    const now = new Date();
    const norm = fluencyNorm(player.grade, now);
    const rec = { t: Date.now(), id: passage.id, title: passage.title, g: passage.g, wcpm, acc, words: read, errors: e, ge };
    (player.fluency ||= []).push(rec);
    store.save();
    const vs = norm ? (wcpm >= norm.median * 1.25 ? 'above typical' : wcpm >= norm.median * 0.9 ? 'about typical' : wcpm >= norm.median * 0.7 ? 'a little below typical' : 'well below typical') : null;
    frame('Read-aloud result', `
      <div class="flu-res"><div><b>${wcpm}</b><small>words correct per minute</small></div><div><b>${acc}%</b><small>accuracy</small></div><div><b>${ge != null ? gradeLabel(ge) : '–'}</b><small>reads this ${gradeLabel(passage.g)} story like a typical…</small></div></div>
      ${norm ? `<p>A typical (50th percentile) ${gradeName(player.grade)} reader in the ${norm.season} reads about <b>${norm.median}</b> words correct per minute on grade-level text, so ${esc(player.name)} is <b>${vs}</b>${passage.g < player.grade ? ' (this story was below grade level, which makes it easier)' : ''}.</p>` : ''}
      ${acc < 95 ? '<p class="muted">Accuracy under 95% usually means the text is still hard; practice accuracy before speed.</p>' : ''}
      <h4>Now ask (optional)</h4><ul>${[passage.retell, ...passage.questions.map((q) => `${q.q} <span class="muted">(${esc(q.answer)})</span>`)].map((q) => `<li>${q}</li>`).join('')}</ul>
      <p class="fine">Norms: Hasbrouck & Tindal (2017) oral reading fluency, 50th percentile.</p>
      <div class="p-actions"><button class="btn primary to-report">See ${esc(player.name)}'s report</button></div>`, { back: () => fluencyStart(player) });
    $('.to-report', root).addEventListener('click', () => report(player, 'reading'));
  }
}
