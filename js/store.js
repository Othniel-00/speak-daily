// Local-first storage. Progress lives in localStorage (small JSON);
// voice recordings live in IndexedDB (audio blobs). Everything works offline.
import { START_DATE_DEFAULT } from './content.js';

const KEY = 'speakdaily.state.v1';
const listeners = new Set();

export function todayKey(d = new Date()) {
  return d.toLocaleDateString('en-CA'); // YYYY-MM-DD in the phone's own time zone
}

function fresh() {
  return {
    version: 1,
    updatedAt: Date.now(),
    profile: { name: 'Othniel', startDate: START_DATE_DEFAULT },
    settings: { morningTime: '04:55', eveningTime: '20:55', passcode: '', speakReplies: true, readGoal: 3 },
    days: {},
    chat: [],
    reports: [],
    drive: { folderId: null, fileId: null, lastSync: null, connected: false },
  };
}

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const s = JSON.parse(raw);
    const base = fresh();
    return { ...base, ...s, profile: { ...base.profile, ...s.profile }, settings: { ...base.settings, ...s.settings }, drive: { ...base.drive, ...s.drive } };
  } catch {
    return fresh();
  }
}

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.warn('Save failed', e); }
}

export function get() { return state; }

export function update(fn, { silent = false } = {}) {
  fn(state);
  state.updatedAt = Date.now();
  persist();
  if (!silent) listeners.forEach((l) => l(state));
}

export function replace(next, { silent = false } = {}) {
  state = next;
  persist();
  if (!silent) listeners.forEach((l) => l(state));
}

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function day(key = todayKey()) {
  if (!state.days[key]) {
    state.days[key] = {
      updatedAt: Date.now(),
      morning: { done: [false, false, false, false] },
      evening: { done: [false, false, false, false] },
      journal: '', quiz: null, fix: '', reads: [], minutes: 0,
    };
  }
  return state.days[key];
}

export function dayIndex(key = todayKey()) {
  const start = new Date(state.profile.startDate + 'T00:00:00');
  const now = new Date(key + 'T00:00:00');
  return Math.max(0, Math.round((now - start) / 86400000));
}

export function sessionDone(d, which) {
  return d && d[which] && d[which].done.every(Boolean);
}

export function streak() {
  let n = 0;
  const d = new Date();
  // Today counts if at least one session is done; otherwise start from yesterday.
  const t = state.days[todayKey(d)];
  if (!(t && (sessionDone(t, 'morning') || sessionDone(t, 'evening')))) d.setDate(d.getDate() - 1);
  for (;;) {
    const x = state.days[todayKey(d)];
    if (x && (sessionDone(x, 'morning') || sessionDone(x, 'evening'))) { n++; d.setDate(d.getDate() - 1); } else break;
  }
  return n;
}

// Merge two states (local + Google Drive copy). Newer day wins, chat keeps the longer history.
export function merge(local, remote) {
  if (!remote || !remote.days) return local;
  const out = structuredClone(local);
  for (const [k, rd] of Object.entries(remote.days)) {
    const ld = out.days[k];
    if (!ld || (rd.updatedAt || 0) > (ld.updatedAt || 0)) out.days[k] = rd;
  }
  if ((remote.updatedAt || 0) > (local.updatedAt || 0)) {
    out.settings = { ...out.settings, ...remote.settings, passcode: local.settings.passcode || remote.settings?.passcode || '' };
    out.profile = { ...out.profile, ...remote.profile };
  }
  if ((remote.chat?.length || 0) > (out.chat?.length || 0)) out.chat = remote.chat;
  if ((remote.reports?.length || 0) > (out.reports?.length || 0)) out.reports = remote.reports;
  out.updatedAt = Math.max(local.updatedAt || 0, remote.updatedAt || 0);
  return out;
}

/* ---------- Recordings (IndexedDB) ---------- */
const DB = 'speakdaily';
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('recordings', { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function tx(mode, fn) {
  const db = await idb();
  return new Promise((res, rej) => {
    const t = db.transaction('recordings', mode);
    const s = t.objectStore('recordings');
    const out = fn(s);
    t.oncomplete = () => res(out && 'result' in out ? out.result : out);
    t.onerror = () => rej(t.error);
  });
}
export const recordings = {
  put: (rec) => tx('readwrite', (s) => s.put(rec)),
  all: () => tx('readonly', (s) => s.getAll()),
  get: (id) => tx('readonly', (s) => s.get(id)),
  remove: (id) => tx('readwrite', (s) => s.delete(id)),
};
