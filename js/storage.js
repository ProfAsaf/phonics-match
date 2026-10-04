// Progress lives in localStorage under one versioned key and is written after every item
// (SPEC.md, "Technical requirements"). Export and import move it as one JSON file.
//
// Two players share the device: the child, under the original key, and a test player a grown-up can
// switch to from the parent area, so trying things out never changes the child's progress. The
// active player is remembered; switching reloads the game.
import { CONFIG } from './config.js';
import { newProgress, upgradeProgress } from './session.js';

const PLAYER_KEY = 'phonics.player';
export const PLAYERS = { main: CONFIG.storageKey, test: `${CONFIG.storageKey}.test` };
const keyOf = id => PLAYERS[id] ?? PLAYERS.main;

export function activePlayer() {
  try {
    return localStorage.getItem(PLAYER_KEY) === 'test' && localStorage.getItem(PLAYERS.test) ? 'test' : 'main';
  } catch {
    return 'main';
  }
}

export function switchPlayer(id) {
  localStorage.setItem(PLAYER_KEY, id === 'test' ? 'test' : 'main');
}

export function loadProgress(C, day, id = activePlayer()) {
  try {
    const raw = localStorage.getItem(keyOf(id));
    if (raw) return upgradeProgress(C, JSON.parse(raw));
  } catch (e) {
    console.warn('Could not read saved progress', e);
  }
  return newProgress(C, day);
}

export function saveProgress(P, id = activePlayer()) {
  try {
    localStorage.setItem(keyOf(id), JSON.stringify(P));
    return true;
  } catch (e) {
    console.warn('Could not save progress', e);
    return false;
  }
}

export function clearProgress(id = activePlayer()) {
  localStorage.removeItem(keyOf(id));
}

// Starts the test player: a copy of the child's progress, to try things from where the child is, or a
// fresh start, to see the first launch. The child's own progress is not touched.
export function startTestPlayer(C, day, { copy = true } = {}) {
  const P = copy ? loadProgress(C, day, 'main') : newProgress(C, day);
  saveProgress(P, 'test');
  switchPlayer('test');
}

export function exportProgress(P, day) {
  const blob = new Blob([JSON.stringify(P, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `phonics-progress-${day}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// Throws with a plain message if the file is not a progress export.
export function parseImport(C, text) {
  const data = JSON.parse(text);
  if (!data || typeof data !== 'object' || !data.records || !data.step) throw new Error('That file is not a progress export from this game.');
  return upgradeProgress(C, data);
}
