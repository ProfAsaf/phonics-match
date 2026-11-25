// Everything is saved on this device (localStorage). The parent area can export a backup file
// and import it on this or another device.
const KEY = 'brainArcade.v1';

export const DEFAULT_SETTINGS = {
  voice: '', rate: 0.95, sfx: true, roundLength: 0, showDontKnow: true,
};
export const DEFAULT_PLAYER_SETTINGS = { subjectMode: 'choice', readAloud: 'auto', focus: {} };

export const store = {
  data: null,
  load() {
    try { this.data = JSON.parse(localStorage.getItem(KEY)); } catch { this.data = null; }
    if (!this.data || !Array.isArray(this.data.players)) this.data = { version: 1, players: [], settings: {} };
    this.data.settings = { ...DEFAULT_SETTINGS, ...this.data.settings };
    for (const p of this.data.players) p.settings = { ...DEFAULT_PLAYER_SETTINGS, ...p.settings };
    try { navigator.storage?.persist?.(); } catch { /* not supported */ }
    return this.data;
  },
  save() {
    clearTimeout(this._t);
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { console.warn('save failed', e); }
  },
  saveSoon() { clearTimeout(this._t); this._t = setTimeout(() => this.save(), 400); },
  get settings() { return this.data.settings; },
  get players() { return this.data.players; },
  player(id) { return this.data.players.find((p) => p.id === id); },
  addPlayer(fields) {
    const p = { id: 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), created: Date.now(), stars: 0, stickers: [], settings: { ...DEFAULT_PLAYER_SETTINGS }, ...fields };
    this.data.players.push(p);
    this.save();
    return p;
  },
  removePlayer(id) { this.data.players = this.data.players.filter((p) => p.id !== id); this.save(); },
  exportText() { return JSON.stringify({ app: 'brain-arcade', exported: new Date().toISOString(), ...this.data }); },
  importText(text) {
    const d = JSON.parse(text);
    if (!d || !Array.isArray(d.players)) throw new Error('This file is not a Brain Arcade backup.');
    delete d.app; delete d.exported;
    this.data = d;
    this.save();
    this.load();
  },
  resetAll() { localStorage.removeItem(KEY); this.load(); },
  // A setup code: {"players":[{name, grade, avatar, color, school:{ixl, dibels}}]}. Adds new players and
  // updates the grade and school scores of ones with the same name (their progress is kept).
  mergeSetup(text) {
    const clean = String(text).replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/```(json)?/g, '').trim();
    const start = clean.search(/[[{]/);
    let d;
    try { d = JSON.parse(clean.slice(start)); } catch { throw new Error('That setup code could not be read. Copy all of it, including the first { and the last }.'); }
    const list = Array.isArray(d) ? d : d?.players;
    if (!Array.isArray(list) || !list.length) throw new Error('No players found in that setup code.');
    const added = [], updated = [];
    for (const raw of list.slice(0, 12)) {
      const name = String(raw?.name || '').trim().slice(0, 20);
      const grade = Math.round(Number(raw?.grade));
      if (!name || !Number.isFinite(grade)) continue;
      const fields = { name, grade: Math.max(-1, Math.min(5, grade)), school: cleanSchool(raw.school) };
      const existing = this.data.players.find((p) => p.name.toLowerCase() === name.toLowerCase());
      if (existing) { Object.assign(existing, fields); updated.push(existing); }
      else added.push(this.addPlayer({ ...fields, avatar: String(raw.avatar || '🙂').slice(0, 8), color: /^#[0-9a-f]{6}$/i.test(raw.color) ? raw.color : '#4dabf7' }));
    }
    this.save();
    return { added, updated };
  },
};

const IXL_KEYS = ['overall', 'nbt', 'nf', 'oa', 'md', 'geo'];
const DIBELS_KEYS = ['lnf', 'psf', 'nwf', 'wrf', 'orf', 'maze', 'vocab', 'spell'];
const STATUSES = ['wellbelow', 'below', 'at', 'above'];
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
function cleanSchool(s) {
  const out = {};
  if (s?.ixl) {
    const ixl = { date: isDate(s.ixl.date) ? s.ixl.date : '' };
    let any = false;
    for (const k of IXL_KEYS) if (Number.isFinite(+s.ixl[k]) && s.ixl[k] !== '' && s.ixl[k] != null) { ixl[k] = +s.ixl[k]; any = true; }
    if (any) out.ixl = ixl;
  }
  if (s?.dibels) {
    const dib = { date: isDate(s.dibels.date) ? s.dibels.date : '', grade: Number.isFinite(+s.dibels.grade) ? +s.dibels.grade : undefined };
    let any = false;
    for (const k of DIBELS_KEYS) if (STATUSES.includes(s.dibels[k])) { dib[k] = s.dibels[k]; any = true; }
    if (any) out.dibels = dib;
  }
  return out;
}
