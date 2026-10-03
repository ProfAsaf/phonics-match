// The recording page's local server (SPEC.md, "Recording page"). It serves this folder on
// localhost only, so you can play the game and record on the same machine, and it saves the clips
// the studio sends into audio/, keeping audio/manifest.json current. No dependencies.
//
// Run: node tools/studio-server.mjs        then open http://localhost:8321/studio.html
import { createServer } from 'node:http';
import { readFile, writeFile, rename, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const AUDIO = join(ROOT, 'audio');
const PORT = Number(process.env.PORT) || 8321;
const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.md': 'text/plain; charset=utf-8',
  '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4',
};
const LOCAL_HOSTS = new Set([`localhost:${PORT}`, `127.0.0.1:${PORT}`, `[::1]:${PORT}`]);

const fail = (status, message) => Object.assign(new Error(message), { status });

// Saves run one at a time, so two quick saves can't clobber the manifest.
let chain = Promise.resolve();
const serial = fn => (chain = chain.then(fn, fn));

async function saveClip(id, body) {
  if (!ID.test(id)) throw fail(400, 'Bad clip id.');
  if (body.length < 44 || body.toString('ascii', 0, 4) !== 'RIFF' || body.toString('ascii', 8, 12) !== 'WAVE') throw fail(400, 'Not a WAV file.');
  const file = `${id}.wav`;
  await writeFile(join(AUDIO, file), body);
  const manifestPath = join(AUDIO, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const clips = { ...manifest.clips, [id]: file };
  manifest.clips = Object.fromEntries(Object.keys(clips).sort().map(k => [k, clips[k]]));
  if (manifest.voices) delete manifest.voices[id]; // a real recording now; voice remakes leave it alone
  await writeFile(`${manifestPath}.tmp`, `${JSON.stringify(manifest, null, 2)}\n`);
  await rename(`${manifestPath}.tmp`, manifestPath);
  return file;
}

function readBody(req, limit) {
  return new Promise((resolveBody, reject) => {
    const parts = [];
    let size = 0;
    req.on('data', part => {
      size += part.length;
      if (size > limit) {
        reject(fail(413, 'Clip too large.'));
        req.destroy();
      } else parts.push(part);
    });
    req.on('end', () => resolveBody(Buffer.concat(parts)));
    req.on('error', reject);
  });
}

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(body);
}

const server = createServer(async (req, res) => {
  try {
    // Only pages served from this machine may talk to it (guards against DNS rebinding and
    // cross-site requests from other tabs).
    if (!LOCAL_HOSTS.has(req.headers.host ?? '')) throw fail(403, 'Local requests only.');
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname.startsWith('/api/clip/')) {
      if (req.method !== 'POST') throw fail(405, 'Use POST.');
      const origin = req.headers.origin;
      if (req.headers['x-studio'] !== '1' || (origin && !LOCAL_HOSTS.has(origin.replace(/^https?:\/\//, '')))) throw fail(403, 'Studio only.');
      const id = decodeURIComponent(url.pathname.slice('/api/clip/'.length));
      const body = await readBody(req, 8 * 1024 * 1024);
      const file = await serial(() => saveClip(id, body));
      return send(res, 200, JSON.stringify({ ok: true, file }), 'application/json');
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') throw fail(405, 'Method not allowed.');
    let path = normalize(decodeURIComponent(url.pathname)).replace(/^[/\\]+/, '');
    let full = join(ROOT, path);
    if (full !== ROOT && !full.startsWith(ROOT + sep)) throw fail(403, 'Forbidden.');
    let info = await stat(full).catch(() => null);
    if (info?.isDirectory()) {
      full = join(full, 'index.html');
      info = await stat(full).catch(() => null);
    }
    if (!info) throw fail(404, 'Not found.');
    const data = await readFile(full);
    res.writeHead(200, { 'content-type': TYPES[extname(full).toLowerCase()] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch (e) {
    send(res, e.status ?? 500, e.message);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Recording studio: http://localhost:${PORT}/studio.html`);
  console.log(`The game:         http://localhost:${PORT}/`);
});
