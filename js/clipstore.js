// Clips made on this device, by the microphone or the AI voice, kept in IndexedDB. They take
// priority over any file in audio/. The parent area can export and import them, since Safari
// can clear a site's storage.
const DB_NAME = 'phonics-audio';
const META = 'meta'; // { id, source: 'mic' | 'voice', voice, created, seconds }
const AUDIO = 'audio'; // id -> WAV ArrayBuffer

let opening = null;
function db() {
  opening ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(META, { keyPath: 'id' });
      req.result.createObjectStore(AUDIO);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return opening;
}

function run(stores, mode, fn) {
  return db().then(d => new Promise((resolve, reject) => {
    const tx = d.transaction(stores, mode);
    let result;
    Promise.resolve(fn(tx)).then(r => { result = r; });
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }));
}

const request = req => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

export async function listIds() {
  try {
    return await run([META], 'readonly', tx => request(tx.objectStore(META).getAllKeys()));
  } catch (e) {
    console.warn('Saved clips are unavailable', e);
    return [];
  }
}

export function listMeta() {
  return run([META], 'readonly', tx => request(tx.objectStore(META).getAll()))
    .then(rows => new Map(rows.map(r => [r.id, r])));
}

export function getAudio(id) {
  return run([AUDIO], 'readonly', tx => request(tx.objectStore(AUDIO).get(id)));
}

export function putClip(meta, wav) {
  return run([META, AUDIO], 'readwrite', tx => {
    tx.objectStore(META).put(meta);
    tx.objectStore(AUDIO).put(wav, meta.id);
  });
}

export function deleteClip(id) {
  return run([META, AUDIO], 'readwrite', tx => {
    tx.objectStore(META).delete(id);
    tx.objectStore(AUDIO).delete(id);
  });
}

// ---- Backup: one JSON file with every clip, base64-encoded.
const toBase64 = buffer => {
  const bytes = new Uint8Array(buffer);
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text);
};
const fromBase64 = text => Uint8Array.from(atob(text), c => c.charCodeAt(0)).buffer;

export async function exportAll() {
  const meta = await listMeta();
  const clips = [];
  for (const m of meta.values()) {
    const wav = await getAudio(m.id);
    if (wav) clips.push({ ...m, wav: toBase64(wav) });
  }
  return { kind: 'phonics-recordings', version: 1, clips };
}

export async function importAll(data) {
  if (data?.kind !== 'phonics-recordings' || !Array.isArray(data.clips)) throw new Error('That file is not a recordings export from this game.');
  for (const { wav, ...meta } of data.clips) await putClip(meta, fromBase64(wav));
  return data.clips.length;
}
