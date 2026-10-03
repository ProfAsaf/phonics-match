// Progress lives in localStorage under one versioned key and is written after every item
// (SPEC.md, "Technical requirements"). Export and import move it as one JSON file.
import { CONFIG } from './config.js';
import { newProgress, upgradeProgress } from './session.js';

export function loadProgress(C, day) {
  try {
    const raw = localStorage.getItem(CONFIG.storageKey);
    if (raw) return upgradeProgress(C, JSON.parse(raw));
  } catch (e) {
    console.warn('Could not read saved progress', e);
  }
  return newProgress(C, day);
}

export function saveProgress(P) {
  try {
    localStorage.setItem(CONFIG.storageKey, JSON.stringify(P));
    return true;
  } catch (e) {
    console.warn('Could not save progress', e);
    return false;
  }
}

export function clearProgress() {
  localStorage.removeItem(CONFIG.storageKey);
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
