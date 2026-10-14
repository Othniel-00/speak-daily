// Google Drive backup. Uses the "drive.file" permission, so the app can only
// see files it created itself: a "Speak Daily" folder with progress.json and recordings.
import * as store from './store.js';

const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const TOKEN_KEY = 'speakdaily.gtoken';

let clientId = null;
let tokenClient = null;
let pending = null;
let syncTimer = null;
const statusListeners = new Set();
let status = { state: 'idle', message: '' };

export function onStatus(fn) { statusListeners.add(fn); fn(status); return () => statusListeners.delete(fn); }
function setStatus(state, message = '') { status = { state, message }; statusListeners.forEach((f) => f(status)); }

export function configure(id) { clientId = id || null; prepare(); }
export function available() { return !!clientId; }
export function isConnected() { return store.get().drive.connected; }

function savedToken() {
  try {
    const t = JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null');
    return t && t.exp > Date.now() + 60000 ? t.token : null;
  } catch { return null; }
}

function loadGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = res;
    s.onerror = () => rej(new Error('Could not load Google sign-in. Check your internet connection.'));
    document.head.appendChild(s);
  });
}

function makeClient() {
  if (tokenClient || !window.google?.accounts?.oauth2 || !clientId) return tokenClient;
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPE,
    callback: (r) => {
      if (r.error) { pending?.rej(new Error(r.error_description || r.error)); }
      else {
        localStorage.setItem(TOKEN_KEY, JSON.stringify({ token: r.access_token, exp: Date.now() + (r.expires_in || 3600) * 1000 }));
        pending?.res(r.access_token);
      }
      pending = null;
    },
    error_callback: (e) => { pending?.rej(new Error(e.message || 'Sign-in was closed.')); pending = null; },
  });
  return tokenClient;
}

// Load Google sign-in in the background so a later tap can renew access instantly.
export function prepare() {
  if (!clientId || !isConnected()) return;
  loadGis().then(makeClient).catch(() => {});
}

export function hasAccess() { return !!savedToken(); }

// True when there are changes on this phone that are not in Drive yet.
export function needsSave() {
  const s = store.get();
  return isConnected() && (s.updatedAt || 0) > (s.drive.lastSync || 0) + 2000;
}

// Renew Drive access from inside a tap, without awaiting first (iPhone only allows
// sign-in windows that open directly from a tap). Google closes the window by itself
// because you already said yes once. Then saves.
export function renewFromTap() {
  if (!isConnected() || savedToken() || pending || !navigator.onLine) return false;
  const c = makeClient();
  if (!c) return false;
  const p = new Promise((res, rej) => { pending = { res, rej }; });
  c.requestAccessToken({ prompt: '' });
  p.then(() => sync({ interactive: false })).catch(() => setStatus('needs-tap', 'Tap "Save to Drive now" to keep saving.'));
  return true;
}

// Must be called from a tap (iPhone blocks sign-in pop-ups otherwise).
export async function requestToken(interactive = true) {
  const t = savedToken();
  if (t) return t;
  if (!clientId) throw new Error('Google Drive is not set up yet. Add GOOGLE_CLIENT_ID in Vercel.');
  if (!interactive) throw new Error('needs-tap');
  if (!makeClient()) { await loadGis(); makeClient(); }
  return new Promise((res, rej) => {
    pending = { res, rej };
    tokenClient.requestAccessToken({ prompt: store.get().drive.connected ? '' : 'consent' });
  });
}

async function gfetch(url, opts = {}, token) {
  const r = await fetch(url, { ...opts, headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) } });
  if (r.status === 401) { localStorage.removeItem(TOKEN_KEY); throw new Error('needs-tap'); }
  if (!r.ok) throw new Error(`Google Drive error ${r.status}`);
  return r;
}

async function ensureFolder(token) {
  const d = store.get().drive;
  if (d.folderId) return d.folderId;
  const q = encodeURIComponent("name='Speak Daily' and mimeType='application/vnd.google-apps.folder' and trashed=false");
  const found = await (await gfetch(`${API}/files?q=${q}&fields=files(id)`, {}, token)).json();
  let id = found.files?.[0]?.id;
  if (!id) {
    const r = await gfetch(`${API}/files?fields=id`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Speak Daily', mimeType: 'application/vnd.google-apps.folder' }),
    }, token);
    id = (await r.json()).id;
  }
  store.update((s) => { s.drive.folderId = id; }, { silent: true });
  return id;
}

async function findProgress(token, folderId) {
  const d = store.get().drive;
  if (d.fileId) return d.fileId;
  const q = encodeURIComponent(`name='progress.json' and '${folderId}' in parents and trashed=false`);
  const found = await (await gfetch(`${API}/files?q=${q}&fields=files(id)`, {}, token)).json();
  return found.files?.[0]?.id || null;
}

function multipart(meta, blob) {
  const fd = new FormData();
  fd.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
  fd.append('file', blob);
  return fd;
}

// Pull the Drive copy, merge with this phone, push the result back.
export async function sync({ interactive = false } = {}) {
  if (!navigator.onLine) { setStatus('offline', 'Offline. Your progress is saved on this phone and will go to Drive when you are back online.'); return; }
  let token;
  try { token = await requestToken(interactive); }
  catch (e) {
    if (e.message === 'needs-tap') { setStatus('needs-tap', 'Tap "Save to Drive now" to continue saving.'); return; }
    setStatus('error', e.message); return;
  }
  try {
    setStatus('syncing', 'Saving to Google Drive…');
    const folderId = await ensureFolder(token);
    let fileId = await findProgress(token, folderId);
    if (fileId) {
      const remote = await (await gfetch(`${API}/files/${fileId}?alt=media`, {}, token)).json().catch(() => null);
      const merged = store.merge(store.get(), remote);
      store.replace(merged, { silent: true });
      window.dispatchEvent(new CustomEvent('speakdaily:merged'));
    }
    const s = store.get();
    const toSave = { ...s, settings: { ...s.settings, passcode: '' } };
    const blob = new Blob([JSON.stringify(toSave, null, 1)], { type: 'application/json' });
    if (fileId) {
      await gfetch(`${UPLOAD}/files/${fileId}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: blob }, token);
    } else {
      const r = await gfetch(`${UPLOAD}/files?uploadType=multipart&fields=id`, { method: 'POST', body: multipart({ name: 'progress.json', parents: [folderId] }, blob) }, token);
      fileId = (await r.json()).id;
    }
    store.update((st) => { st.drive.fileId = fileId; st.drive.connected = true; st.drive.lastSync = Date.now(); }, { silent: true });
    setStatus('ok', 'Saved to Google Drive.');
    window.dispatchEvent(new CustomEvent('speakdaily:saved'));
    uploadPending(token);
  } catch (e) {
    if (e.message === 'needs-tap') setStatus('needs-tap', 'Tap "Save to Drive now" to continue saving.');
    else setStatus('error', e.message);
  }
}

async function uploadOne(rec, token) {
  const folderId = await ensureFolder(token);
  const ext = rec.type.includes('mp4') ? 'm4a' : rec.type.includes('webm') ? 'webm' : 'audio';
  const r = await gfetch(`${UPLOAD}/files?uploadType=multipart&fields=id`, { method: 'POST', body: multipart({ name: `${rec.title}.${ext}`, parents: [folderId] }, rec.blob) }, token);
  rec.driveId = (await r.json()).id;
  await store.recordings.put(rec);
}

// Upload any recordings that are only on this phone (for example, made while offline).
async function uploadPending(token) {
  const all = await store.recordings.all();
  for (const rec of all.filter((r) => !r.driveId)) {
    try { await uploadOne(rec, token); } catch { break; }
  }
}

export async function uploadRecording(rec) {
  if (!isConnected() || !navigator.onLine) return false;
  const token = savedToken();
  if (!token) return false;
  try { await uploadOne(rec, token); return true; } catch { return false; }
}

export function disconnect() {
  const t = savedToken();
  if (t && window.google?.accounts?.oauth2) google.accounts.oauth2.revoke(t, () => {});
  localStorage.removeItem(TOKEN_KEY);
  store.update((s) => { s.drive = { folderId: null, fileId: null, lastSync: null, connected: false }; });
  setStatus('idle', '');
}

// Auto-save a few seconds after any change, when signed in.
export function scheduleSync() {
  if (!isConnected()) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => sync({ interactive: false }), 4000);
}

window.addEventListener('online', () => scheduleSync());
