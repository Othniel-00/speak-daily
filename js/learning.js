// The learning engine: the mistakes notebook, spaced review, word bank and mastery.
// Everything is stored in store.get().srs / .grammar / .practice and works offline.
import * as store from './store.js';
import * as C from './content.js';
import { LEVELS, MASTERY, SOUNDS, COMMUNICATION } from './content-learn.js';

/* ---------- dates ---------- */
const DAY = 86400000;
export function addDays(key, n) { const d = new Date(key + 'T12:00:00'); d.setTime(d.getTime() + n * DAY); return store.todayKey(d); }

/* ---------- spaced review ----------
   Each card sits in a box from 0 to 6. A right answer moves it up one box and it comes back
   after the box's interval; a wrong answer sends it back to box 0 (due again today).
   Box 4 or higher (two weeks or more) counts as "mastered". */
export const INTERVALS = [0, 1, 3, 7, 14, 30, 60];
export const MASTERED_BOX = 4;
export const TYPES = {
  fix: 'Grammar fix',
  quiz: 'Grammar question',
  word: 'Word',
  sound: 'Pronunciation',
};

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
function cardId(type, data) {
  const key = type === 'word' ? data.w : type === 'sound' ? data.word : type === 'quiz' ? data.q : data.wrong;
  return `${type}:${norm(key).slice(0, 80)}`;
}

// Add (or refresh) a card. A repeated mistake goes back to box 0. Returns true if the card is new.
export function addCard(s, type, data, src = '') {
  const id = cardId(type, data);
  if (!id.split(':')[1]) return false;
  const today = store.todayKey();
  const c = s.srs[id];
  if (c) {
    if (type !== 'word') { c.box = 0; c.due = today; c.count = (c.count || 1) + 1; c.data = { ...c.data, ...data }; c.updatedAt = Date.now(); }
    return false;
  }
  s.srs[id] = { id, type, data, src, box: 0, due: today, added: today, count: 1, right: 0, wrong: 0, updatedAt: Date.now() };
  return true;
}

export function grade(s, id, ok) {
  const c = s.srs[id]; if (!c) return;
  const today = store.todayKey();
  if (ok) { c.box = Math.min(INTERVALS.length - 1, c.box + 1); c.right++; c.due = addDays(today, INTERVALS[c.box]); }
  else { c.box = 0; c.wrong++; c.due = today; }
  c.last = today; c.updatedAt = Date.now();
}

export function cards(type) { return Object.values(store.get().srs || {}).filter((c) => !type || c.type === type); }
export function due(type, limit = 20) {
  const today = store.todayKey();
  return cards(type).filter((c) => c.due <= today).sort((a, b) => a.box - b.box || a.due.localeCompare(b.due)).slice(0, limit);
}
export function counts(type) {
  const all = cards(type); const today = store.todayKey();
  return {
    total: all.length,
    due: all.filter((c) => c.due <= today).length,
    mastered: all.filter((c) => c.box >= MASTERED_BOX).length,
    learning: all.filter((c) => c.box < MASTERED_BOX).length,
  };
}

/* ---------- collecting mistakes from feedback ---------- */
export function fromTalk(s, fb) {
  let n = 0;
  for (const g of (fb.grammar_fixes || []).slice(0, 5)) {
    if (g?.said && g?.better && norm(g.said) !== norm(g.better)) n += addCard(s, 'fix', { wrong: g.said, right: g.better, why: g.why || '' }, 'talk') ? 1 : 0;
  }
  return n;
}
export function fromPronounce(s, fb) {
  let n = 0;
  for (const w of (fb.problem_words || []).slice(0, 8)) {
    if (w?.word) n += addCard(s, 'sound', { word: w.word, tip: w.tip || '', issue: w.issue || '' }, 'pronounce') ? 1 : 0;
  }
  return n;
}
export function fromFixes(s, fixes, src) {
  let n = 0;
  for (const f of (fixes || []).slice(0, 8)) {
    const wrong = f.wrong || f.said; const right = f.right || f.better;
    if (wrong && right && norm(wrong) !== norm(right)) n += addCard(s, 'fix', { wrong, right, why: f.why || '' }, src) ? 1 : 0;
  }
  return n;
}
export function fromQuiz(s, unit, q) {
  return addCard(s, 'quiz', { q: q.q, o: q.o, a: q.a, unit }, 'grammar');
}
export function addWord(s, w) { return addCard(s, 'word', { w: w.w, m: w.m, e: w.e }, 'word'); }

// Add the next n words from the course list that are not yet in the word bank.
export function addNextWords(s, n = 5) {
  let added = 0;
  for (const w of C.WORDS) {
    if (added >= n) break;
    if (addWord(s, w)) added++;
  }
  return added;
}

/* ---------- Grammar Academy ---------- */
export function unitState(u) { return store.get().grammar?.[u] || null; }
export function isMastered(u) { return !!unitState(u)?.mastered; }
export function recordUnit(s, u, score, total) {
  const g = (s.grammar[u] ||= { best: 0, attempts: 0, mastered: false });
  g.attempts++; g.last = score / total; g.best = Math.max(g.best, score / total); g.at = Date.now();
  if (score / total >= MASTERY) g.mastered = true;
  return g;
}
// The first unit, in level order, that is not mastered yet.
export function nextUnit() {
  for (const L of LEVELS) for (const u of L.units) if (!isMastered(u)) return u;
  return LEVELS[LEVELS.length - 1].units.at(-1);
}
export function levelOf(u) { return LEVELS.find((L) => L.units.includes(u)) || LEVELS[0]; }
export function levelProgress(L) { return L.units.filter(isMastered).length / L.units.length; }
export function currentLevel() { return LEVELS.find((L) => levelProgress(L) < 1) || LEVELS[LEVELS.length - 1]; }

/* ---------- practice log (communication lessons, sound drills, talks) ---------- */
export function logPractice(s, key) {
  const p = (s.practice[key] ||= { count: 0, at: 0 });
  p.count++; p.at = Date.now();
}
export function practised(key) { return store.get().practice?.[key]?.count || 0; }

/* ---------- measurements from AI feedback (stored per day) ---------- */
export function history() {
  const out = [];
  for (const [k, d] of Object.entries(store.get().days).sort((a, b) => a[0].localeCompare(b[0]))) {
    for (const f of Object.values(d.feedback || {})) out.push({ date: k, ...f });
  }
  return out;
}
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

/* ---------- progress per pillar (0..1) ---------- */
export function pillars() {
  const h = history();
  const talks = h.filter((f) => f.mode === 'talk' && f.scores?.clarity).slice(-5);
  const prons = h.filter((f) => f.mode === 'pronounce' && f.accuracy != null).slice(-5);
  const words = counts('word');
  const commDone = COMMUNICATION.filter((c) => practised(`comm:${c.id}`)).length;
  const soundsDone = SOUNDS.filter((x) => practised(`sound:${x.id}`)).length;
  const units = LEVELS.flatMap((L) => L.units);
  return {
    grammar: { p: units.filter(isMastered).length / units.length, label: `${units.filter(isMastered).length} of ${units.length} units mastered` },
    speaking: { p: talks.length ? mean(talks.map((f) => +f.scores.clarity)) / 5 : 0, label: talks.length ? `Clarity ${mean(talks.map((f) => +f.scores.clarity)).toFixed(1)}/5 (last ${talks.length} talks)` : 'No AI-checked talks yet' },
    pronunciation: { p: prons.length ? (mean(prons.map((f) => +f.accuracy)) / 100) * 0.8 + (soundsDone / SOUNDS.length) * 0.2 : soundsDone / SOUNDS.length * 0.2, label: prons.length ? `${Math.round(mean(prons.map((f) => +f.accuracy)))}% clear (last ${prons.length} checks)` : `${soundsDone} of ${SOUNDS.length} sound drills tried` },
    vocabulary: { p: words.mastered / C.WORDS.length, label: `${words.mastered} mastered, ${words.learning} learning` },
    communication: { p: commDone / COMMUNICATION.length, label: `${commDone} of ${COMMUNICATION.length} skills practised` },
  };
}
export const LEVELS_LIST = LEVELS;
