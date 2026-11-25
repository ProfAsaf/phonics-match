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
};
