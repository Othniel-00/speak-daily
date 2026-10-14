// Link with the Daily Brief news app. With your private link code (from Daily Brief › Settings),
// Speak Daily reads your Daily Brief word bank and the stories you read recently, and uses them
// for the word of the day, the 1-minute talk topic and the coach. Read-only; nothing is sent back.
const KEY = 'speakdaily.dailybrief';
const URL_BASE = 'https://daily-brief-flame.vercel.app/api/speakdaily';

let state = load();
function load() { try { return JSON.parse(localStorage.getItem(KEY) || 'null') || { code: '', data: null, fetchedAt: 0, error: '' }; } catch { return { code: '', data: null, fetchedAt: 0, error: '' }; } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* full */ } }

export const get = () => state;
export const linked = () => !!state.code;
export const words = () => state.data?.words || [];
// Stories read in the last two days, newest first.
export const stories = () => (state.data?.stories || []).filter((s) => !s.read || Date.now() - s.read < 2 * 864e5);

export async function refresh(force = false) {
  if (!state.code || !navigator.onLine) return false;
  if (!force && Date.now() - state.fetchedAt < 20 * 60000) return false;
  try {
    const r = await fetch(`${URL_BASE}?code=${encodeURIComponent(state.code)}`);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `Daily Brief answered ${r.status}`);
    state = { ...state, data: { words: j.words || [], stories: j.stories || [], updatedAt: j.updatedAt || 0 }, fetchedAt: Date.now(), error: '' };
  } catch (e) {
    state = { ...state, error: e.message, fetchedAt: Date.now() };
  }
  save();
  return true;
}

export async function setCode(code) {
  state = { code: String(code || '').trim(), data: null, fetchedAt: 0, error: '' };
  save();
  if (state.code) await refresh(true);
}
export function disconnect() { state = { code: '', data: null, fetchedAt: 0, error: '' }; save(); }
