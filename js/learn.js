// The Learn tab: five pillars (Grammar, Speaking, Pronunciation, Vocabulary, Communication),
// the grammar quiz and the daily review of your own mistakes.
import * as store from './store.js';
import * as C from './content.js';
import * as L from './learning.js';
import { LEVELS, MASTERY, SOUNDS, COMMUNICATION, SCENARIOS } from './content-learn.js';
import { esc, icon, toast, ring, parseJson, md } from './ui.js';

let ctx = null; // { render, recorderBlock, recList, askCoach, openScenario, today, speak, sync }
export function init(c) { ctx = c; }

let page = null;   // what the Learn tab shows: null = hub, or { p: 'grammar' | 'unit' | ... }
let sheet = null;  // full-screen quiz or review: { kind: 'quiz' | 'review', ... }
let busy = false;
let topicShift = 0; let passageShift = 0;

export const PILLARS = [
  { id: 'grammar', title: 'Grammar Academy', icon: 'abc', blurb: 'Rules, examples and quizzes, level by level.' },
  { id: 'speaking', title: 'Speaking & Fluency', icon: 'wave', blurb: 'Talk, get AI feedback, practise conversations.' },
  { id: 'pronunciation', title: 'Pronunciation', icon: 'speaker', blurb: 'Clear sounds, word stress and your problem words.' },
  { id: 'vocabulary', title: 'Vocabulary', icon: 'cards', blurb: 'Learn words and keep them with spaced review.' },
  { id: 'communication', title: 'Communication', icon: 'people', blurb: 'Clear answers, stories, polite English, emails.' },
];

export const isOpen = () => !!sheet;
export function openPillar(id) { page = { p: id }; sheet = null; }
export function reset() { page = null; }

/* ================= hub ================= */
export function view() {
  if (page) return pageView();
  const pr = L.pillars();
  const due = L.counts().due;
  return `
  <section class="learn">
    <header class="page-head">
      <p class="eyebrow">Learn → Practise → Feedback → Fix → Again</p>
      <h1>Learn</h1>
    </header>
    ${reviewCard(due)}
    <div class="pillars">
      ${PILLARS.map((x) => `
      <button class="pillar" data-action="l-open" data-p="${x.id}">
        <span class="pillar-top"><span class="bubble">${icon(x.icon)}</span>${ring(pr[x.id].p, 46, 5)}</span>
        <b>${esc(x.title)}</b>
        <small>${esc(pr[x.id].label)}</small>
      </button>`).join('')}
    </div>
  </section>`;
}

export function reviewCard(due) {
  const c = L.counts();
  return c.total ? `
  <button class="hero-card" data-action="l-review" data-type="">
    <span class="hero-tag">${due ? `${due} due today` : 'All caught up'}</span>
    <b>Fix my mistakes</b>
    <small>${due ? 'Your own grammar slips, problem words and new words, back at the right time.' : `${c.mastered} of ${c.total} cards mastered. New mistakes from your feedback appear here.`}</small>
    <span class="go">${icon('arrow')}</span>
  </button>` : `
  <div class="hero-card soft">
    <b>Your mistakes notebook</b>
    <small>Every mistake the coach finds in your talks, writing and quizzes is saved here, and comes back for review until you get it right.</small>
  </div>`;
}

const back = (to = '') => `<button class="back" data-action="l-back" data-to="${to}">${icon('back')} ${to ? 'Back' : 'Learn'}</button>`;

/* ================= pillar pages ================= */
function pageView() {
  switch (page.p) {
    case 'grammar': return grammarPage();
    case 'unit': return unitPage(page.u);
    case 'speaking': return speakingPage();
    case 'pronunciation': return pronPage();
    case 'sound': return soundPage(page.id);
    case 'vocabulary': return vocabPage();
    case 'communication': return commPage();
    case 'comm': return commLesson(page.id);
    default: page = null; return view();
  }
}

function grammarPage() {
  const next = L.nextUnit(); const lvl = L.currentLevel();
  return `
  <section class="learn">
    ${back()}
    <h1>Grammar Academy</h1>
    <p class="muted">Get ${Math.round(MASTERY * 8)} of 8 right to master a unit. Wrong answers go to your mistakes notebook.</p>
    <button class="hero-card" data-action="l-unit" data-u="${next}">
      <span class="hero-tag">Level ${lvl.id}: ${esc(lvl.name)}</span>
      <b>Next: ${esc(C.GRAMMAR[next].title)}</b>
      <small>${esc(lvl.goal)}</small>
      <span class="go">${icon('arrow')}</span>
    </button>
    ${LEVELS.map((Lv) => `
    <section class="level">
      <header><h2>Level ${Lv.id}: ${esc(Lv.name)}</h2><span class="pill">${Math.round(L.levelProgress(Lv) * 100)}%</span></header>
      <ul class="units">
        ${Lv.units.map((u) => { const st = L.unitState(u); return `
        <li><button class="unit ${st?.mastered ? 'done' : ''}" data-action="l-unit" data-u="${u}">
          <span class="u-ic">${icon(st?.mastered ? 'check' : u === next ? 'play' : 'abc')}</span>
          <span><b>${esc(C.GRAMMAR[u].title)}</b><small>${st ? `Best ${Math.round(st.best * 100)}%${st.mastered ? ', mastered' : ''}` : u === next ? 'Up next' : 'Not started'}</small></span>
          ${icon('chev')}
        </button></li>`; }).join('')}
      </ul>
    </section>`).join('')}
  </section>`;
}

function unitPage(u) {
  const g = C.GRAMMAR[u]; const st = L.unitState(u); const lv = L.levelOf(u);
  return `
  <section class="learn">
    ${back('grammar')}
    <p class="eyebrow">Level ${lv.id}: ${esc(lv.name)}</p>
    <h1>${esc(g.title)}</h1>
    <article class="card">
      <h3>The rule</h3>
      <p>${esc(g.rule)}</p>
      <button class="btn ghost small" data-action="speak" data-text="${esc(g.rule)}">${icon('speaker')} Read it to me</button>
    </article>
    <article class="card">
      <h3>Wrong → right</h3>
      <ul class="fixes">${g.examples.map(([a, b]) => `<li><s>${esc(a)}</s><span>${esc(b)} <button class="say tiny" data-action="speak" data-text="${esc(b)}" aria-label="Hear it">${icon('speaker')}</button></span></li>`).join('')}</ul>
      <p class="hint">Say each correct sentence out loud twice.</p>
    </article>
    ${st ? `<p class="status ${st.mastered ? 'ok' : ''}">${st.mastered ? 'Mastered.' : 'Not mastered yet.'} Best score ${Math.round(st.best * 100)}%, ${st.attempts} ${st.attempts === 1 ? 'try' : 'tries'}.</p>` : ''}
    <button class="btn primary block" data-action="l-quiz" data-u="${u}">${icon('play')} ${st ? 'Take the quiz again' : 'Start the quiz'} (8 questions)</button>
    ${st ? `<button class="btn block" data-action="l-drill" data-u="${u}" ${busy ? 'disabled' : ''}>${icon('spark')} ${busy ? 'Writing new questions…' : '6 new questions from the coach'}</button>
    <p class="hint">The coach writes fresh questions aimed at the answers you got wrong. Needs the internet.</p>` : ''}
  </section>`;
}

function speakingPage() {
  const t = ctx.today();
  const topic = C.pick(C.TALK_TOPICS, t.di + 37 + topicShift);
  const lines = [0, 1, 2, 3].map((k) => C.pick(C.SHADOW_LINES, t.di * 3 + 11 + k + topicShift));
  return `
  <section class="learn">
    ${back()}
    <h1>Speaking & Fluency</h1>
    <article class="card">
      <h3>One-minute talk</h3>
      <p class="topic">${esc(topic)}</p>
      <button class="link" data-action="l-shift" data-what="topic">Another topic</button>
      <p class="hint">Speak for one minute without stopping. Pause instead of saying "um". Then tap <b>Get AI feedback</b>: your grammar slips go to your mistakes notebook.</p>
      ${ctx.recorderBlock('talk-free', 'Free talk', 60, { kind: 'talk', topic })}
      ${ctx.recList(t.key, 'talk-free')}
    </article>
    <article class="card">
      <h3>Conversation practice</h3>
      <p class="hint">A real back-and-forth with the coach. Talk with the mic, and at the end ask for a review of your English.</p>
      <div class="scen">${SCENARIOS.map((x) => `<button class="chip" data-action="l-scenario" data-id="${x.id}">${esc(x.title)}</button>`).join('')}</div>
    </article>
    <article class="card">
      <h3>Shadowing</h3>
      <p class="hint">Play a line, pause, and say it back with the same speed and music.</p>
      <ul class="shadow">${lines.map((l) => `<li><button class="say" data-action="speak" data-text="${esc(l)}" aria-label="Play">${icon('play')}</button><span>${esc(l)}</span></li>`).join('')}</ul>
      <button class="link" data-action="l-shift" data-what="topic">New lines</button>
    </article>
  </section>`;
}

function pronPage() {
  const t = ctx.today();
  const passage = C.pick(C.READ_PASSAGES, t.di + 13 + passageShift);
  const words = L.cards('sound').sort((a, b) => a.box - b.box).slice(0, 12);
  const c = L.counts('sound');
  return `
  <section class="learn">
    ${back()}
    <h1>Pronunciation</h1>
    <p class="muted">Any accent is fine. The goal is that every word is clear.</p>
    <article class="card">
      <header class="row"><h3>My problem words</h3>${c.due ? `<button class="btn small primary" data-action="l-review" data-type="sound">Practise ${c.due}</button>` : ''}</header>
      ${words.length ? `<ul class="pw">${words.map((w) => `
        <li><button class="say tiny" data-action="speak" data-text="${esc(w.data.word)}" aria-label="Hear ${esc(w.data.word)}">${icon('speaker')}</button>
        <span><b>${esc(w.data.word)}</b> ${dots(w.box)}<br><small>${esc(w.data.tip || '')}</small></span></li>`).join('')}</ul>`
        : '<p class="hint">Words the coach could not hear clearly in your pronunciation checks will appear here.</p>'}
    </article>
    <h2>Sound drills</h2>
    <ul class="units">
      ${SOUNDS.map((x) => `<li><button class="unit ${L.practised('sound:' + x.id) ? 'done' : ''}" data-action="l-page" data-p="sound" data-id="${x.id}">
        <span class="u-ic">${icon(L.practised('sound:' + x.id) ? 'check' : 'speaker')}</span><span><b>${esc(x.title)}</b><small>${L.practised('sound:' + x.id) ? `Practised ${L.practised('sound:' + x.id)}×` : 'Not tried yet'}</small></span>${icon('chev')}</button></li>`).join('')}
    </ul>
    <article class="card">
      <h3>Read aloud and check</h3>
      <article class="passage"><h4>${esc(passage.t)}</h4><p>${esc(passage.p)}</p></article>
      <div class="btns"><button class="btn ghost small" data-action="speak" data-text="${esc(passage.p)}">${icon('speaker')} Hear it first</button><button class="link" data-action="l-shift" data-what="passage">Another passage</button></div>
      ${ctx.recorderBlock('read-free', `Reading: ${passage.t}`, 120, { kind: 'pronounce', expected: passage.p })}
      ${ctx.recList(t.key, 'read-free')}
    </article>
  </section>`;
}

function soundPage(id) {
  const x = SOUNDS.find((s) => s.id === id); if (!x) { page = { p: 'pronunciation' }; return pageView(); }
  const t = ctx.today();
  return `
  <section class="learn">
    ${back('pronunciation')}
    <h1>${esc(x.title)}</h1>
    <article class="card tipcard"><p>${esc(x.tip)}</p></article>
    <h3>Say each word three times</h3>
    <div class="wordgrid">${x.words.map((w) => `<button class="wchip" data-action="speak" data-text="${esc(w.replace(/[A-Z]{2,}/g, (m) => m.toLowerCase()))}">${icon('speaker')} ${esc(w)}</button>`).join('')}</div>
    ${x.pairs.length ? `<h3>Hear the difference</h3><ul class="pairs">${x.pairs.map(([a, b]) => `<li><button class="wchip" data-action="speak" data-text="${esc(a)}">${esc(a)}</button><span>vs</span><button class="wchip" data-action="speak" data-text="${esc(b)}">${esc(b)}</button></li>`).join('')}</ul>` : ''}
    <article class="card">
      <h3>Now say the sentence</h3>
      <p class="topic">${esc(x.sentence)}</p>
      <button class="btn ghost small" data-action="speak" data-text="${esc(x.sentence)}">${icon('speaker')} Hear it</button>
      ${ctx.recorderBlock('sound-' + x.id, x.title, 30, { kind: 'pronounce', expected: x.sentence })}
      ${ctx.recList(t.key, 'sound-' + x.id)}
    </article>
    <button class="btn primary block" data-action="l-done" data-key="sound:${x.id}">${icon('check')} I practised this</button>
  </section>`;
}

function vocabPage() {
  const t = ctx.today(); const c = L.counts('word');
  const bank = L.cards('word').sort((a, b) => (b.added || '').localeCompare(a.added || '') || a.box - b.box);
  const inBank = !!store.get().srs['word:' + t.word.w.toLowerCase()];
  return `
  <section class="learn">
    ${back()}
    <h1>Vocabulary</h1>
    <div class="word-card">
      <p class="eyebrow">Word of the day</p>
      <p class="word">${esc(t.word.w)} <button class="say" data-action="speak" data-text="${esc(t.word.w)}. ${esc(t.word.e)}" aria-label="Hear it">${icon('speaker')}</button></p>
      <p>${esc(t.word.m)}</p>
      <p class="ex">"${esc(t.word.e)}"</p>
      ${inBank ? '<p class="small-ok">In your word bank.</p>' : `<button class="btn small light" data-action="l-addword">${icon('plus')} Add to my word bank</button>`}
    </div>
    <div class="tiles">
      <div class="tile"><b>${c.total}</b><small>in your bank</small></div>
      <div class="tile"><b>${c.mastered}</b><small>mastered</small></div>
      <div class="tile accent"><b>${c.due}</b><small>due today</small></div>
    </div>
    <div class="btns">
      <button class="btn primary" data-action="l-review" data-type="word" ${c.due ? '' : 'disabled'}>${icon('refresh')} Review words</button>
      <button class="btn" data-action="l-morewords">${icon('plus')} Learn 5 new words</button>
    </div>
    <p class="hint">In a review, say what the word means and use it in a sentence out loud before you check. Words you know come back less often; words you miss come back sooner.</p>
    <h2>Your word bank</h2>
    ${bank.length ? `<ul class="bank">${bank.slice(0, 60).map((w) => `
      <li><button class="say tiny" data-action="speak" data-text="${esc(w.data.w)}. ${esc(w.data.e || '')}" aria-label="Hear ${esc(w.data.w)}">${icon('speaker')}</button>
      <span><b>${esc(w.data.w)}</b> ${dots(w.box)}<br><small>${esc(w.data.m)}</small></span></li>`).join('')}</ul>`
      : '<p class="hint">Words from your morning practice are added here automatically.</p>'}
  </section>`;
}

function commPage() {
  return `
  <section class="learn">
    ${back()}
    <h1>Communication</h1>
    <p class="muted">Simple patterns that make you clear and confident in class, at work and in messages.</p>
    <ul class="units">
      ${COMMUNICATION.map((x) => `<li><button class="unit ${L.practised('comm:' + x.id) ? 'done' : ''}" data-action="l-page" data-p="comm" data-id="${x.id}">
        <span class="u-ic">${icon(L.practised('comm:' + x.id) ? 'check' : x.mode === 'write' ? 'pen' : 'people')}</span>
        <span><b>${esc(x.title)}</b><small>${esc(x.pattern)}</small></span>${icon('chev')}</button></li>`).join('')}
    </ul>
    <h2>Practise in a conversation</h2>
    <div class="scen">${SCENARIOS.map((x) => `<button class="chip" data-action="l-scenario" data-id="${x.id}">${esc(x.title)}</button>`).join('')}</div>
  </section>`;
}

function commLesson(id) {
  const x = COMMUNICATION.find((c) => c.id === id); if (!x) { page = { p: 'communication' }; return pageView(); }
  const t = ctx.today(); const d = store.day(); const w = d.comm?.[id] || {};
  return `
  <section class="learn">
    ${back('communication')}
    <h1>${esc(x.title)}</h1>
    <p class="pill big">${esc(x.pattern)}</p>
    <p>${esc(x.explain)}</p>
    <article class="card model">
      <h3>Example</h3>
      ${md(x.model)}
      <button class="btn ghost small" data-action="speak" data-text="${esc(x.model)}">${icon('speaker')} Hear it</button>
    </article>
    <h3>Useful phrases</h3>
    <div class="wordgrid">${x.phrases.map((p) => `<button class="wchip" data-action="speak" data-text="${esc(p.replace(/…/g, ''))}">${icon('speaker')} ${esc(p)}</button>`).join('')}</div>
    <article class="card">
      <h3>Your turn</h3>
      <p class="topic">${esc(x.task)}</p>
      ${x.mode === 'write' ? `
        <textarea class="field journal" rows="7" data-lbind="comm" data-id="${x.id}" placeholder="Write it here…">${esc(w.text || '')}</textarea>
        <button class="btn" data-action="l-checkwrite" data-id="${x.id}" ${busy ? 'disabled' : ''}>${icon('spark')} ${busy ? 'Checking…' : 'Check my writing'}</button>
        ${w.fb ? writingFeedback(w.fb) : ''}`
      : `${ctx.recorderBlock('comm-' + x.id, x.title, 60, { kind: 'talk', topic: x.task })}
        ${ctx.recList(t.key, 'comm-' + x.id)}`}
    </article>
    <button class="btn primary block" data-action="l-done" data-key="comm:${x.id}">${icon('check')} I practised this</button>
  </section>`;
}

export function writingFeedback(fb) {
  if (!fb) return '';
  if (typeof fb === 'string') return `<div class="feedback">${md(fb)}</div>`;
  return `<div class="feedback">
    <h4>Corrected</h4>
    <p class="corrected">${esc(fb.corrected || '').replace(/\n/g, '<br>')}</p>
    ${(fb.fixes || []).length ? `<ul class="fixes">${fb.fixes.map((f) => `<li><s>${esc(f.wrong)}</s><span>${esc(f.right)}</span>${f.why ? `<small>${esc(f.why)}</small>` : ''}</li>`).join('')}</ul>` : '<p>No mistakes found. Well done.</p>'}
    ${fb.good ? `<p><b>Good:</b> ${esc(fb.good)}</p>` : ''}
    ${fb.tip ? `<p class="fb-fix"><b>Next time:</b> ${esc(fb.tip)}</p>` : ''}
    <button class="btn ghost small" data-action="speak" data-text="${esc(fb.corrected || '')}">${icon('speaker')} Read the corrected version</button>
  </div>`;
}

const dots = (box) => `<span class="dots" title="Strength ${box} of 6">${[1, 2, 3, 4, 5, 6].map((i) => `<i class="${i <= box ? 'on' : ''}"></i>`).join('')}</span>`;

/* ================= full-screen: quiz and review ================= */
export function sheetView() {
  if (!sheet) return '';
  return sheet.kind === 'quiz' ? quizView() : reviewView();
}

function startQuiz(u, qs, drill = false) {
  sheet = { kind: 'quiz', u, qs, i: 0, picked: null, score: 0, wrong: [], drill, done: false };
}

function quizView() {
  const S = sheet; const g = C.GRAMMAR[S.u];
  if (S.done) {
    const pct = S.score / S.qs.length; const st = L.unitState(S.u);
    return `
    <div class="sheet quiz" role="dialog" aria-modal="true" aria-label="Quiz results">
      <header class="sheet-top"><span class="pill">${esc(g.title)}</span><button class="icon-btn" data-action="l-close" aria-label="Close">${icon('x')}</button></header>
      <div class="sheet-body center">
        <div class="result-ring">${ring(pct, 150, 12)}<span>${S.score}/${S.qs.length}</span></div>
        <h2>${pct >= MASTERY ? (S.drill ? 'Strong work.' : 'Unit mastered!') : 'Good practice.'}</h2>
        <p class="muted">${pct >= MASTERY ? 'You know this rule. Keep using it when you speak.' : `You need ${Math.ceil(MASTERY * S.qs.length)} right to master it. Read the rule again and try once more.`}${!S.drill && st ? ` Best: ${Math.round(st.best * 100)}%.` : ''}</p>
        ${S.wrong.length ? `<div class="card left"><h3>Added to your mistakes notebook</h3><ul class="fixes">${S.wrong.map((q) => `<li><span>${esc(q.q.replace('___', q.o[q.a]))}</span></li>`).join('')}</ul></div>` : ''}
      </div>
      <footer class="sheet-foot">
        <button class="btn ghost" data-action="l-close">Done</button>
        <button class="btn primary" data-action="l-quiz" data-u="${S.u}">Try again</button>
      </footer>
    </div>`;
  }
  const q = S.qs[S.i]; const answered = S.picked !== null;
  const parts = esc(q.q).split('___');
  return `
  <div class="sheet quiz" role="dialog" aria-modal="true" aria-label="Grammar quiz">
    <header class="sheet-top">
      <button class="icon-btn" data-action="l-close" aria-label="Close">${icon('x')}</button>
      <span class="pill">Question ${S.i + 1} of ${S.qs.length}</span>
      <span class="icon-btn" aria-hidden="true"></span>
    </header>
    <div class="qbar"><i style="width:${(S.i / S.qs.length) * 100}%"></i></div>
    <div class="sheet-body">
      <h2 class="q-title">Choose the correct answer</h2>
      <div class="q-badge">${icon('abc')}<span>${esc(g.title)}</span></div>
      <p class="q-text">${parts.join('<span class="gap">' + (answered ? esc(q.o[S.picked]) : '&nbsp;') + '</span>')}</p>
      <div class="options">
        ${q.o.map((o, oi) => {
          const cls = answered ? (oi === q.a ? 'right' : oi === S.picked ? 'wrong' : 'dim') : '';
          return `<button class="option ${cls}" data-action="l-pick" data-o="${oi}" ${answered ? 'disabled' : ''}>${esc(o)}</button>`;
        }).join('')}
      </div>
      ${answered ? `<div class="explain ${S.picked === q.a ? 'ok' : 'no'}">
        <b>${S.picked === q.a ? 'Correct.' : `Not quite. The answer is "${esc(q.o[q.a])}".`}</b>
        <p>${esc(q.why || g.rule)}</p>
        <button class="btn ghost small" data-action="speak" data-text="${esc(q.q.replace('___', q.o[q.a]))}">${icon('speaker')} Hear the sentence</button>
      </div>` : ''}
    </div>
    <footer class="sheet-foot"><button class="btn primary block" data-action="l-next" ${answered ? '' : 'disabled'}>${S.i === S.qs.length - 1 ? 'See my score' : 'Next'}</button></footer>
  </div>`;
}

function startReview(type) {
  const queue = L.due(type || undefined, 20);
  if (!queue.length) { toast('Nothing to review right now. Well done!'); return; }
  sheet = { kind: 'review', type, queue: queue.map((c) => c.id), i: 0, revealed: false, picked: null, right: 0, total: 0, again: new Set(), done: false };
}

function reviewView() {
  const S = sheet;
  if (S.done || S.i >= S.queue.length) {
    S.done = true;
    const c = L.counts();
    return `
    <div class="sheet quiz" role="dialog" aria-modal="true" aria-label="Review finished">
      <header class="sheet-top"><span class="pill">Review</span><button class="icon-btn" data-action="l-close" aria-label="Close">${icon('x')}</button></header>
      <div class="sheet-body center">
        <div class="result-ring">${ring(S.total ? S.right / S.total : 1, 150, 12)}<span>${S.right}/${S.total}</span></div>
        <h2>Review done.</h2>
        <p class="muted">Cards you knew come back later; the others come back sooner. ${c.mastered} of ${c.total} cards are mastered.</p>
      </div>
      <footer class="sheet-foot"><button class="btn primary block" data-action="l-close">Done</button></footer>
    </div>`;
  }
  const card = store.get().srs[S.queue[S.i]];
  if (!card) { S.i++; return reviewView(); }
  const d = card.data;
  let body = '';
  if (card.type === 'quiz') {
    const answered = S.picked !== null;
    body = `<h2 class="q-title">Choose the correct answer</h2>
      <p class="q-text">${esc(d.q).split('___').join(`<span class="gap">${answered ? esc(d.o[S.picked]) : '&nbsp;'}</span>`)}</p>
      <div class="options">${d.o.map((o, oi) => `<button class="option ${answered ? (oi === d.a ? 'right' : oi === S.picked ? 'wrong' : 'dim') : ''}" data-action="l-rpick" data-o="${oi}" ${answered ? 'disabled' : ''}>${esc(o)}</button>`).join('')}</div>
      ${answered ? `<div class="explain ${S.picked === d.a ? 'ok' : 'no'}"><b>${S.picked === d.a ? 'Correct.' : `The answer is "${esc(d.o[d.a])}".`}</b>${d.unit != null && C.GRAMMAR[d.unit] ? `<p>${esc(C.GRAMMAR[d.unit].rule)}</p>` : ''}</div>` : ''}`;
  } else if (card.type === 'fix') {
    body = `<h2 class="q-title">Fix this sentence</h2>
      <p class="hint center">You said this. Say the correct version out loud, then check.</p>
      <p class="q-text wrongline">${esc(d.wrong)}</p>
      ${S.revealed ? `<div class="explain ok"><b>${esc(d.right)}</b>${d.why ? `<p>${esc(d.why)}</p>` : ''}<button class="btn ghost small" data-action="speak" data-text="${esc(d.right)}">${icon('speaker')} Hear it</button></div>` : ''}`;
  } else if (card.type === 'word') {
    body = `<h2 class="q-title">What does it mean?</h2>
      <p class="hint center">Say the meaning and one sentence with the word out loud, then check.</p>
      <p class="q-text big">${esc(d.w)} <button class="say" data-action="speak" data-text="${esc(d.w)}" aria-label="Hear it">${icon('speaker')}</button></p>
      ${S.revealed ? `<div class="explain ok"><b>${esc(d.m)}</b><p>"${esc(d.e)}"</p></div>` : ''}`;
  } else {
    body = `<h2 class="q-title">Say it clearly</h2>
      <p class="hint center">Hear it, then say it three times, slowly and clearly.</p>
      <p class="q-text big">${esc(d.word)} <button class="say" data-action="speak" data-text="${esc(d.word)}" aria-label="Hear it">${icon('speaker')}</button></p>
      ${d.tip ? `<div class="explain"><p>${esc(d.tip)}</p></div>` : ''}`;
  }
  const isQuiz = card.type === 'quiz';
  const foot = isQuiz
    ? `<button class="btn primary block" data-action="l-rnext" ${S.picked === null ? 'disabled' : ''}>Next</button>`
    : card.type === 'sound' || S.revealed
      ? `<button class="btn" data-action="l-grade" data-ok="0">Not yet</button><button class="btn primary" data-action="l-grade" data-ok="1">${card.type === 'sound' ? 'It was clear' : 'I had it right'}</button>`
      : `<button class="btn primary block" data-action="l-reveal">Check</button>`;
  return `
  <div class="sheet quiz" role="dialog" aria-modal="true" aria-label="Review">
    <header class="sheet-top">
      <button class="icon-btn" data-action="l-close" aria-label="Close">${icon('x')}</button>
      <span class="pill">${S.i + 1} of ${S.queue.length} · ${L.TYPES[card.type]}</span>
      <span class="icon-btn" aria-hidden="true"></span>
    </header>
    <div class="qbar"><i style="width:${(S.i / S.queue.length) * 100}%"></i></div>
    <div class="sheet-body">${body}</div>
    <footer class="sheet-foot">${foot}</footer>
  </div>`;
}

function gradeCurrent(ok) {
  const S = sheet; const id = S.queue[S.i];
  store.update((s) => L.grade(s, id, ok), { silent: true });
  S.total++; if (ok) S.right++;
  if (!ok && !S.again.has(id)) { S.again.add(id); S.queue.push(id); } // one more try at the end
  S.i++; S.revealed = false; S.picked = null;
  ctx.sync();
}

/* ================= actions ================= */
export async function handle(a, el) {
  switch (a) {
    case 'l-open': page = { p: el.dataset.p }; break;
    case 'l-page': page = { p: el.dataset.p, id: el.dataset.id }; break;
    case 'l-back': page = el.dataset.to ? { p: el.dataset.to } : null; break;
    case 'l-unit': page = { p: 'unit', u: +el.dataset.u }; break;
    case 'l-quiz': startQuiz(+el.dataset.u, C.GRAMMAR[+el.dataset.u].quiz.map((q) => ({ ...q }))); break;
    case 'l-pick': if (sheet.picked === null) { sheet.picked = +el.dataset.o; const q = sheet.qs[sheet.i]; if (sheet.picked === q.a) sheet.score++; else sheet.wrong.push(q); } break;
    case 'l-next': {
      const S = sheet;
      if (S.i < S.qs.length - 1) { S.i++; S.picked = null; break; }
      S.done = true;
      store.update((s) => {
        if (!S.drill) L.recordUnit(s, S.u, S.score, S.qs.length);
        for (const q of S.wrong) L.fromQuiz(s, S.u, q);
        const d = store.day(); d.learn ||= {}; d.learn.quizzes = (d.learn.quizzes || 0) + 1; d.updatedAt = Date.now();
      }, { silent: true });
      ctx.sync();
      break;
    }
    case 'l-drill': {
      const u = +el.dataset.u; if (busy) return true;
      if (!navigator.onLine) { toast('You’re offline. New questions need the internet.'); return true; }
      busy = true; ctx.render();
      try {
        const missed = L.cards('quiz').filter((c) => c.data.unit === u).map((c) => c.data.q.replace('___', c.data.o[c.data.a])).slice(0, 6);
        const reply = await ctx.askCoach([{ role: 'user', content: `Grammar topic: ${C.GRAMMAR[u].title}. Rule: ${C.GRAMMAR[u].rule}\nQuestions I got wrong before: ${missed.join(' | ') || 'none yet'}` }], 'drill');
        const j = parseJson(reply);
        const qs = (j?.questions || []).filter((q) => q.q && Array.isArray(q.o) && q.o.length >= 2 && q.a >= 0 && q.a < q.o.length).slice(0, 6);
        if (!qs.length) throw new Error('The coach did not send usable questions. Try again.');
        startQuiz(u, qs.map((q) => ({ q: q.q.includes('___') ? q.q : q.q + ' ___', o: q.o.map(String), a: +q.a, why: q.why || '' })), true);
      } catch (e) { toast(e.message); }
      busy = false;
      break;
    }
    case 'l-review': startReview(el.dataset.type || ''); break;
    case 'l-reveal': sheet.revealed = true; break;
    case 'l-grade': gradeCurrent(el.dataset.ok === '1'); break;
    case 'l-rpick': { if (sheet.picked === null) sheet.picked = +el.dataset.o; break; }
    case 'l-rnext': { const card = store.get().srs[sheet.queue[sheet.i]]; const ok = sheet.picked === card.data.a; sheet.picked = null; gradeCurrent(ok); break; }
    case 'l-close': sheet = null; break;
    case 'l-shift': if (el.dataset.what === 'passage') passageShift++; else topicShift++; break;
    case 'l-addword': store.update((s) => L.addWord(s, ctx.today().word)); ctx.sync(); toast('Added to your word bank.'); break;
    case 'l-morewords': { let n = 0; store.update((s) => { n = L.addNextWords(s, 5); }); ctx.sync(); toast(n ? `${n} new words added. Review them now.` : 'You have every word in the course.'); break; }
    case 'l-done': store.update((s) => L.logPractice(s, el.dataset.key)); ctx.sync(); toast('Saved. Well done.'); break;
    case 'l-scenario': { const x = SCENARIOS.find((s) => s.id === el.dataset.id); if (x) ctx.openScenario(x); return true; }
    case 'l-checkwrite': {
      const id = el.dataset.id; const text = (store.day().comm?.[id]?.text || '').trim();
      if (text.split(/\s+/).length < 5) { toast('Write a few sentences first.'); return true; }
      if (!navigator.onLine) { toast('You’re offline. Your writing is saved; check it when you’re back online.'); return true; }
      busy = true; ctx.render();
      try {
        const fb = await checkWriting(text, COMMUNICATION.find((c) => c.id === id)?.task || '', `comm-${id}`);
        store.update((s) => { const d = store.day(); (d.comm ||= {})[id] = { ...(d.comm[id] || {}), fb }; d.updatedAt = Date.now(); L.logPractice(s, `comm:${id}`); });
      } catch (e) { toast(e.message); }
      busy = false;
      break;
    }
    default: return false;
  }
  ctx.render();
  if (a === 'l-open' || a === 'l-page' || a === 'l-back' || a === 'l-unit') window.scrollTo(0, 0);
  return true;
}

// Ask the coach to correct writing, save its fixes to the notebook, return the feedback object (or text).
export async function checkWriting(text, task, src) {
  const reply = await ctx.askCoach([{ role: 'user', content: `${task ? `Task: ${task}\n\n` : ''}My writing:\n${text}` }], 'journal');
  const fb = parseJson(reply);
  if (!fb) return reply;
  let n = 0;
  store.update((s) => { n = L.fromFixes(s, fb.fixes, src); }, { silent: true });
  if (n) toast(`${n} ${n === 1 ? 'mistake' : 'mistakes'} added to your notebook.`);
  return fb;
}

export function onInput(el) {
  if (el.dataset.lbind === 'comm') {
    store.update((s) => { const d = store.day(); (d.comm ||= {})[el.dataset.id] = { ...(d.comm[el.dataset.id] || {}), text: el.value }; d.updatedAt = Date.now(); }, { silent: true });
    return true;
  }
  return false;
}
