import * as store from './store.js';
import * as C from './content.js';
import * as drive from './drive.js';
import * as voice from './voice.js';
import * as L from './learning.js';
import * as learn from './learn.js';
import { toWavBase64 } from './audio.js';
import { $, esc, fmtTime, icon, ago, toast, md, parseJson, ring } from './ui.js';

/* ---------------- helpers ---------------- */
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

let config = { googleClientId: null, ai: null, passcodeRequired: false };
let tab = 'today';
let session = null; // { which: 'morning'|'evening', step: 0..3 }
let chatMode = 'chat';
let chatBusy = false;

/* ---------------- daily picks ---------------- */
function today() {
  const key = store.todayKey();
  const di = store.dayIndex(key);
  // The daily grammar unit is the next unit of the Grammar Academy, fixed for the day once used.
  const week = store.get().days[key]?.unit ?? L.nextUnit();
  return {
    key, di, dayNo: di + 1, week, grammar: C.GRAMMAR[week],
    twisters: [C.pick(C.TWISTERS, di * 2), C.pick(C.TWISTERS, di * 2 + 1)],
    topic: C.pick(C.TALK_TOPICS, di),
    word: C.pick(C.WORDS, di),
    passage: C.pick(C.READ_PASSAGES, di),
    prompt: C.pick(C.JOURNAL_PROMPTS, di),
    shadow: [0, 1, 2].map((k) => C.pick(C.SHADOW_LINES, di * 3 + k)),
    quiz: [0, 1, 2].map((k) => C.pick(C.GRAMMAR[week].quiz, (di % 7) * 3 + k)),
    mind: C.pick(C.GREAT_MINDS, di),
    verse: C.pick(C.VERSES, di),
  };
}
function phase() {
  const h = new Date().getHours();
  return h >= 4 && h < 16 ? 'morning' : 'evening';
}
function applyPhase() {
  const p = phase();
  document.documentElement.dataset.phase = p;
  $('meta[name="theme-color"]').setAttribute('content', '#EEF1F8');
}

/* ---------------- steps ---------------- */
const STEPS = {
  morning: [
    { id: 'warm', title: 'Warm up your mouth', mins: 3 },
    { id: 'read', title: 'Read out loud', mins: 7 },
    { id: 'talk', title: 'Talk for one minute', mins: 5 },
    { id: 'word', title: 'Learn a new word', mins: 5 },
  ],
  evening: [
    { id: 'listen', title: 'Listen to your morning talk', mins: 5 },
    { id: 'journal', title: 'Write about your day', mins: 7 },
    { id: 'grammar', title: 'Grammar check', mins: 5 },
    { id: 'shadow', title: 'Copy a clear speaker', mins: 3 },
  ],
};

/* ---------------- timer ---------------- */
const timer = { remaining: 0, total: 0, running: false, id: null, key: null };
function setupTimer(key, mins) {
  if (timer.key === key) return;
  stopTimer();
  Object.assign(timer, { key, total: mins * 60, remaining: mins * 60, running: false });
}
function stopTimer() { clearInterval(timer.id); timer.running = false; }
function toggleTimer() {
  if (timer.running) { stopTimer(); paintTimer(); return; }
  if (timer.remaining <= 0) timer.remaining = timer.total;
  timer.running = true;
  timer.id = setInterval(() => {
    timer.remaining -= 1;
    if (timer.remaining <= 0) { stopTimer(); beep(); toast('Time is up. Nice work.'); }
    paintTimer();
  }, 1000);
  paintTimer();
}
function paintTimer() {
  const el = $('#timer');
  if (!el) return;
  el.querySelector('.t').textContent = fmtTime(timer.remaining);
  el.querySelector('.lbl').textContent = timer.running ? 'Pause' : timer.remaining < timer.total ? 'Resume' : 'Start timer';
  el.style.setProperty('--p', 1 - timer.remaining / timer.total);
}
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25, 0.5].forEach((t) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.frequency.value = 880; g.gain.setValueAtTime(0.2, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
      o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.22);
    });
  } catch { /* sound is optional */ }
}

/* ---------------- recording ---------------- */
const rec = { ctl: null, started: 0, raf: null, limit: 60, onDone: null };
async function toggleRecord({ limit = 60, title, sessionName, kind = 'talk', topic = '', expected = '' }) {
  if (rec.ctl) return finishRecord();
  if (!voice.canRecord()) { toast('Recording is not supported in this browser.'); return; }
  try {
    rec.ctl = await voice.startRecording();
  } catch {
    toast('Allow the microphone: Settings › Safari › Microphone, or tap Allow when asked.');
    return;
  }
  rec.started = Date.now(); rec.limit = limit; rec.meta = { title, sessionName, kind, topic, expected };
  document.body.classList.add('recording');
  const loop = () => {
    const ring = $('#voice-ring');
    const secs = (Date.now() - rec.started) / 1000;
    if (ring) {
      ring.style.setProperty('--lvl', rec.ctl.level().toFixed(3));
      ring.style.setProperty('--p', Math.min(1, secs / rec.limit));
      const l = ring.querySelector('.ring-label');
      if (l) l.textContent = `${fmtTime(Math.ceil(rec.limit - secs))} left. Tap to stop`;
    }
    if (secs >= rec.limit) { finishRecord(); return; }
    rec.raf = requestAnimationFrame(loop);
  };
  loop();
}
async function finishRecord() {
  if (!rec.ctl) return;
  cancelAnimationFrame(rec.raf);
  const blob = await rec.ctl.stop();
  const duration = Math.round((Date.now() - rec.started) / 1000);
  rec.ctl = null;
  document.body.classList.remove('recording');
  const t = today();
  const item = {
    id: `${t.key}-${rec.meta.sessionName}-${Date.now()}`,
    date: t.key, session: rec.meta.sessionName, title: rec.meta.title,
    kind: rec.meta.kind, topic: rec.meta.topic, expected: rec.meta.expected,
    type: blob.type, blob, duration, created: Date.now(),
  };
  await store.recordings.put(item);
  store.update((s) => { const d = store.day(); d.updatedAt = Date.now(); (d.recordings ||= []).push(item.id); });
  toast(`Saved a ${duration}-second recording. Tap ${rec.meta.kind === 'pronounce' ? '"Check my pronunciation"' : '"Get AI feedback"'} below.`);
  drive.uploadRecording(item).then((ok) => ok && toast('Recording also saved to Google Drive.'));
  render();
}

/* ---------------- views ---------------- */
function ringSVG(p, size = 220) {
  const r = size / 2 - 10; const c = 2 * Math.PI * r;
  return `<svg class="ring-svg" viewBox="0 0 ${size} ${size}" aria-hidden="true">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-track"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-fill" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p)}"/>
  </svg>`;
}

function viewToday() {
  const s = store.get(); const t = today(); const d = s.days[t.key];
  const p = phase();
  const main = p; const other = p === 'morning' ? 'evening' : 'morning';
  const doneCount = (w) => (d?.[w]?.done || []).filter(Boolean).length;
  const streak = store.streak();
  const hello = p === 'morning' ? 'Good morning' : 'Good evening';
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const mainDone = doneCount(main);
  const install = isIOS() && !isStandalone() ? `
    <div class="note install">
      <strong>Put Speak Daily on your home screen</strong>
      <p>In Safari, tap the Share button ${icon('share')}, then choose <b>Add to Home Screen</b>. It then opens like a normal app and works offline.</p>
    </div>` : '';
  const yFix = (() => { const y = new Date(); y.setDate(y.getDate() - 1); const yd = s.days[store.todayKey(y)]; return yd?.fix || yd?.aiFix; })();
  const rc = L.counts(); const next = L.nextUnit(); const lvl = L.currentLevel();
  const weekMin = weekStats().minutes;
  const sessionCard = (w, big) => {
    const n = doneCount(w);
    return `<button class="${big ? 'session-card' : 'session-card soft'}" data-action="open-session" data-which="${w}">
      <span class="sc-top"><span class="pill ${big ? 'light' : ''}">${n === 4 ? 'Done' : n ? 'In progress' : `${w === 'morning' ? 'Morning' : 'Evening'} · 20 min`}</span>${icon(w === 'morning' ? 'sun' : 'moon')}</span>
      <b>${w === 'morning' ? 'Warm up, read and talk' : 'Listen, write and fix'}</b>
      <small>${w === 'morning' ? 'Morning' : 'Evening'} practice · ${n} of 4 steps</small>
      <span class="sc-bar"><i style="width:${n * 25}%"></i></span>
      <span class="go">${icon('arrow')}</span>
    </button>`;
  };
  return `
  <section class="today">
    <header class="hello">
      <p class="date">${esc(dateStr)}</p>
      <div class="hello-row"><h1>${hello}, ${esc(s.profile.name)}.</h1></div>
      <p class="sub"><span class="pill">Day ${t.dayNo}</span> ${streak ? `${icon('flame')} ${streak}-day streak` : 'Let’s begin.'}</p>
    </header>
    ${install}
    ${drive.needsSave() && !drive.hasAccess() ? `
    <button class="row-card save-row" data-action="drive-sync">
      ${icon('cloud')}
      <span><b>Save today's progress to Drive</b><small>Your latest practice is only on this phone. Tap to save it.</small></span>
      ${icon('chev')}
    </button>` : ''}
    <div class="tiles two">
      <div class="tile blue">${icon('clock')}<b>${d?.minutes || 0}<small> min</small></b><span>Practised today<br><small>${weekMin} min this week</small></span></div>
      <div class="tile">${icon('check')}<b>${rc.mastered}<small> / ${rc.total}</small></b><span>Mistakes fixed<br><small>${rc.due} to review today</small></span></div>
    </div>
    ${sessionCard(main, true)}
    ${yFix && main === 'morning' ? `<p class="focus">${icon('target')} Today, fix this: <b>${esc(yFix)}</b></p>` : ''}
    ${learn.reviewCard(rc.due)}
    ${sessionCard(other, false)}
    ${weeklyDue() ? `
    <button class="row-card" data-action="tab" data-tab="progress">
      ${icon('chart')}
      <span><b>Your weekly report is ready</b><small>See how your week went and get next week's focus.</small></span>
      ${icon('chev')}
    </button>` : ''}
    <h2 class="sec">Keep learning</h2>
    <div class="pair">
      <button class="mini" data-action="go-unit" data-u="${next}">
        <span class="eyebrow">Grammar · Level ${lvl.id}</span>
        <b>${esc(C.GRAMMAR[next].title)}</b>
        <span class="ex"><s>${esc(C.GRAMMAR[next].examples[0][0])}</s><br>${esc(C.GRAMMAR[next].examples[0][1])}</span>
      </button>
      <button class="mini" data-action="go-pillar" data-p="vocabulary">
        <span class="eyebrow">Word of the day</span>
        <b>${esc(t.word.w)}</b>
        <span>${esc(t.word.m)}</span>
      </button>
    </div>
    <h2 class="sec">Say it aloud</h2>
    <article class="say-card verse">
      <p>${esc(t.verse.t)}</p>
      <footer><span>${esc(t.verse.ref)} (KJV)</span><button class="btn small light" data-action="speak" data-text="${esc(t.verse.t)}">${icon('speaker')} Hear it, then say it</button></footer>
    </article>
    <article class="say-card mind">
      <p class="q">"${esc(t.mind.q)}"</p>
      <footer><span><b>${esc(t.mind.n)}</b><br><small>${esc(t.mind.r)}</small></span><button class="btn small light" data-action="speak" data-text="${esc(t.mind.q)} ${esc(t.mind.n)}.">${icon('speaker')} Hear it, then say it</button></footer>
    </article>
  </section>`;
}

function stepBody(which, idx) {
  const t = today(); const d = store.day(); const s = store.get();
  const id = STEPS[which][idx].id;
  switch (id) {
    case 'warm': return `
      <ol class="howto">
        <li>Hum for 30 seconds with your lips closed.</li>
        <li>Buzz your lips like a motorbike, "brrrr", for 30 seconds.</li>
        <li>Say each line slowly, then faster. Keep every sound clear.</li>
      </ol>
      <ul class="twisters">
        ${[...t.twisters, 'Red lorry, yellow lorry.'].filter((v, i, a) => a.indexOf(v) === i).map((tw) => `
        <li><button class="say" data-action="speak" data-text="${esc(tw)}" aria-label="Hear it">${icon('speaker')}</button><span>${esc(tw)}</span></li>`).join('')}
      </ul>`;
    case 'read': return `
      <p class="hint">Read slowly and loudly, like someone at the back of the room must hear you. Say the end of every word: walk<b>ed</b>, ask<b>ed</b>, fir<b>st</b>. Breathe at every full stop.</p>
      <article class="passage"><h3>${esc(t.passage.t)}</h3><p>${esc(t.passage.p)}</p></article>
      <div class="btns">
        <button class="btn ghost" data-action="speak" data-text="${esc(t.passage.p)}">${icon('speaker')} Hear it first</button>
      </div>
      <h4>Check your pronunciation</h4>
      <p class="hint">Record yourself reading the passage, then tap <b>Check my pronunciation</b>. The coach shows which words were not clear and how to say them.</p>
      ${recorderBlock('read', `Day ${t.dayNo} reading`, 120, { kind: 'pronounce', expected: t.passage.p })}
      ${recList(t.key, 'read')}`;
    case 'talk': return `
      <p class="hint">Talk for one minute without stopping. If you get stuck, pause quietly. Don't say "um" or "like".</p>
      <p class="topic">${esc(t.topic)}</p>
      ${recorderBlock('morning', `Day ${t.dayNo} morning talk`, 60, { kind: 'talk', topic: t.topic })}
      ${recList(t.key, 'morning')}
      <p class="hint">After recording, tap <b>Get AI feedback</b>. The coach listens and tells you about your clarity, speed and filler words.</p>`;
    case 'word': {
      const sentences = d.wordSentences || ['', '', ''];
      return `
      <div class="word-card">
        <p class="word">${esc(t.word.w)} <button class="say" data-action="speak" data-text="${esc(t.word.w)}. ${esc(t.word.e)}" aria-label="Hear it">${icon('speaker')}</button></p>
        <p>${esc(t.word.m)}</p>
        <p class="ex">"${esc(t.word.e)}"</p>
      </div>
      <p class="hint">Say three sentences with <b>${esc(t.word.w)}</b> out loud. Type them here if you like. Then use the word once today in a real conversation.</p>
      ${[0, 1, 2].map((i) => `<input class="field" data-bind="wordSentence" data-i="${i}" placeholder="Sentence ${i + 1}" value="${esc(sentences[i] || '')}">`).join('')}`;
    }
    case 'listen': {
      return `
      <p class="hint">Play your morning talk. Where did you mumble? Where did you go too fast? Pick <b>one</b> thing to fix tomorrow.</p>
      ${recList(t.key, 'morning', true)}
      <div class="chips" role="radiogroup" aria-label="One thing to fix">
        ${C.FIX_OPTIONS.map((f) => `<button class="chip ${d.fix === f ? 'on' : ''}" role="radio" aria-checked="${d.fix === f}" data-action="fix" data-v="${esc(f)}">${esc(f)}</button>`).join('')}
      </div>`;
    }
    case 'journal': {
      const words = (d.journal || '').trim().split(/\s+/).filter(Boolean).length;
      const sents = (d.journal || '').split(/[.!?]+/).filter((x) => x.trim().length > 3).length;
      return `
      <p class="topic">${esc(t.prompt)}</p>
      <p class="hint">Write 5 to 8 full sentences. No texting language. Then read it out loud, because mistakes are easier to hear than to see.</p>
      <textarea class="field journal" data-bind="journal" rows="8" placeholder="Today, I…">${esc(d.journal || '')}</textarea>
      <p class="count" id="jcount">${sents} sentences, ${words} words</p>
      <button class="btn" data-action="journal-check" ${chatBusy ? 'disabled' : ''}>${icon('spark')} Ask Coach to correct it</button>
      ${d.journalFeedback ? learn.writingFeedback(d.journalFeedback) : ''}`;
    }
    case 'grammar': {
      const g = t.grammar; const answers = d.quizAnswers || {};
      return `
      <p class="eyebrow">Grammar Academy · Level ${L.levelOf(t.week).id}</p>
      <h3 class="g-title">${esc(g.title)}</h3>
      <p>${esc(g.rule)}</p>
      <ul class="fixes">${g.examples.map(([a, b]) => `<li><s>${esc(a)}</s><span>${esc(b)}</span></li>`).join('')}</ul>
      <h4>Quick quiz</h4>
      ${t.quiz.map((q, qi) => `
        <fieldset class="q">
          <legend>${qi + 1}. ${esc(q.q)}</legend>
          ${q.o.map((o, oi) => {
            const picked = answers[qi] === oi; const answered = answers[qi] !== undefined;
            const cls = answered ? (oi === q.a ? 'right' : picked ? 'wrong' : '') : '';
            return `<button class="opt ${cls}" data-action="quiz" data-q="${qi}" data-o="${oi}" ${answered ? 'disabled' : ''}>${esc(o)}</button>`;
          }).join('')}
        </fieldset>`).join('')}
      ${d.quiz ? `<p class="score">You got ${d.quiz.score} of ${d.quiz.total} right.</p>` : ''}
      <button class="link" data-action="go-unit" data-u="${t.week}">Open the full lesson and 8-question quiz</button>`;
    }
    case 'shadow': return `
      <p class="hint">Play each sentence, pause, then say it back with the same speed and tone. This is called shadowing.</p>
      <ul class="shadow">
        ${t.shadow.map((l) => `<li><button class="say" data-action="speak" data-text="${esc(l)}" aria-label="Play">${icon('play')}</button><span>${esc(l)}</span></li>`).join('')}
      </ul>
      <p class="hint">Then record yourself saying all three sentences and tap <b>Check my pronunciation</b>.</p>
      ${recorderBlock('evening', `Day ${t.dayNo} evening shadowing`, 45, { kind: 'pronounce', expected: t.shadow.join(' ') })}
      ${recList(t.key, 'evening')}
      <p class="hint">For more, open <a href="https://www.youtube.com/@bbclearningenglish/videos" target="_blank" rel="noopener">BBC Learning English</a> and shadow a short clip.</p>`;
  }
  return '';
}

function recorderBlock(sessionName, title, limit = 60, { kind = 'talk', topic = '', expected = '' } = {}) {
  const recording = !!rec.ctl;
  return `
  <button id="voice-ring" class="voice-ring ${recording ? 'live' : ''}" data-action="record" data-session="${sessionName}" data-title="${esc(title)}" data-limit="${limit}" data-kind="${kind}" data-topic="${esc(topic)}" data-expected="${esc(expected)}" aria-label="${recording ? 'Stop recording' : 'Start recording'}">
    ${ringSVG(0, 180)}
    <span class="ring-core">${icon(recording ? 'stop' : 'mic')}</span>
    <span class="ring-label">${recording ? 'Tap to stop' : `Tap to record (${limit} s)`}</span>
  </button>`;
}

function recList(date, sessionName, big = false) {
  return `<div class="recs" data-recs="${date}|${sessionName}" data-big="${big ? 1 : 0}"><p class="muted">Loading recordings…</p></div>`;
}
/* ---------------- AI listening feedback ---------------- */
const analysing = new Set();
const bar = (n) => `<span class="meter" style="--v:${Math.max(0, Math.min(5, +n || 0)) / 5}" aria-hidden="true"><i></i></span>`;

function feedbackCard(fb) {
  if (!fb) return '';
  if (fb.mode === 'pronounce') {
    const words = (fb.problem_words || []).slice(0, 8);
    return `<div class="fb">
      <p class="fb-head"><b>${Math.round(+fb.accuracy || 0)}%</b> clear and correct</p>
      ${fb.went_well ? `<p><b>Good:</b> ${esc(fb.went_well)}</p>` : ''}
      ${words.length ? `<p class="fb-sub">Words to practise</p><ul class="pw">${words.map((w) => `
        <li><button class="say tiny" data-action="speak" data-text="${esc(w.word)}" aria-label="Hear ${esc(w.word)}">${icon('speaker')}</button>
        <span><b>${esc(w.word)}</b> <small>${esc(w.issue || '')}</small><br>${esc(w.tip || '')}</span></li>`).join('')}</ul>` : '<p>Every word was clear. Well done.</p>'}
      ${fb.overall_tip ? `<p><b>Next time:</b> ${esc(fb.overall_tip)}</p>` : ''}
      ${fb.transcript ? `<details><summary>What the coach heard</summary><p>${esc(fb.transcript)}</p></details>` : ''}
    </div>`;
  }
  const sc = fb.scores || {};
  const fill = fb.filler_words || {};
  return `<div class="fb">
    <dl class="scores">
      <div><dt>Clarity</dt><dd>${bar(sc.clarity)} ${sc.clarity ?? '-'}/5</dd></div>
      <div><dt>Pace</dt><dd>${bar(sc.pace)} ${sc.pace ?? '-'}/5</dd></div>
      <div><dt>Grammar</dt><dd>${bar(sc.grammar)} ${sc.grammar ?? '-'}/5</dd></div>
      <div><dt>Confidence</dt><dd>${bar(sc.confidence)} ${sc.confidence ?? '-'}/5</dd></div>
    </dl>
    <p>${fb.words_per_minute ? `About <b>${Math.round(fb.words_per_minute)} words a minute</b>. ` : ''}${esc(fb.pace_note || '')}</p>
    <p>Filler words: <b>${+fill.count || 0}</b>${(fill.examples || []).length ? ` (${esc(fill.examples.slice(0, 4).join(', '))})` : ''}</p>
    ${(fb.unclear_words || []).length ? `<p>Hard to hear: ${fb.unclear_words.slice(0, 5).map((w) => `<b>${esc(w)}</b>`).join(', ')}</p>` : ''}
    ${(fb.grammar_fixes || []).length ? `<ul class="fixes">${fb.grammar_fixes.slice(0, 4).map((g) => `<li><s>${esc(g.said)}</s><span>${esc(g.better)}</span></li>`).join('')}</ul>` : ''}
    ${fb.went_well ? `<p><b>Good:</b> ${esc(fb.went_well)}</p>` : ''}
    ${fb.fix_next ? `<p class="fb-fix"><b>Fix tomorrow:</b> ${esc(fb.fix_next)}</p>` : ''}
    ${fb.encouragement ? `<p class="muted">${esc(fb.encouragement)}</p>` : ''}
    ${fb.transcript ? `<details><summary>What the coach heard</summary><p>${esc(fb.transcript)}</p></details>` : ''}
  </div>`;
}

function recHTML(r, { canDelete = false, preload = 'metadata', fold = false } = {}) {
  const pron = r.kind === 'pronounce';
  const busy = analysing.has(r.id);
  const label = pron ? 'Check my pronunciation' : 'Get AI feedback';
  return `<div class="rec">
    <span>${esc(r.title)} <small>${r.duration}s</small></span>
    <audio controls preload="${preload}" data-rec="${r.id}"></audio>
    <div class="rec-actions">
      ${r.feedback ? '' : `<button class="btn small ${busy ? '' : 'primary'}" data-action="rec-feedback" data-id="${r.id}" ${busy ? 'disabled' : ''}>${icon('spark')} ${busy ? 'Listening…' : label}</button>`}
      ${canDelete ? `<button class="link danger" data-action="del-rec" data-id="${r.id}">Delete</button>` : ''}
    </div>
    ${r.feedback && fold ? `<details class="fb-fold"><summary>${r.feedback.mode === 'pronounce' ? `Pronunciation: ${Math.round(+r.feedback.accuracy || 0)}% clear` : `AI feedback: clarity ${r.feedback.scores?.clarity ?? '-'}/5`}</summary>${feedbackCard(r.feedback)}</details>` : feedbackCard(r.feedback)}
  </div>`;
}

async function analyse(id) {
  if (analysing.has(id)) return;
  if (!navigator.onLine) { toast('You’re offline. Your recording is saved; get feedback when you’re back online.'); return; }
  const r = await store.recordings.get(id);
  if (!r) return;
  analysing.add(id); fillRecLists(); fillAllRecs();
  try {
    const { base64 } = await toWavBase64(r.blob);
    const res = await fetch('/api/listen', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-app-passcode': store.get().settings.passcode || '' },
      body: JSON.stringify({ audio: base64, mode: r.kind === 'pronounce' ? 'pronounce' : 'talk', topic: r.topic || '', expected: r.expected || '' }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || `Error ${res.status}`);
    r.feedback = { ...j, at: Date.now() };
    await store.recordings.put(r);
    const compact = j.mode === 'pronounce'
      ? { mode: 'pronounce', accuracy: j.accuracy, words: (j.problem_words || []).map((w) => w.word).slice(0, 8), tip: j.overall_tip }
      : { mode: 'talk', scores: j.scores, wpm: j.words_per_minute, fillers: j.filler_words?.count, fix: j.fix_next };
    let added = 0;
    store.update((s) => {
      const d = s.days[r.date] || store.day(r.date);
      (d.feedback ||= {})[r.id] = compact;
      if (compact.mode === 'talk' && compact.fix) d.aiFix = compact.fix;
      d.updatedAt = Date.now();
      added = j.mode === 'pronounce' ? L.fromPronounce(s, j) : L.fromTalk(s, j);
    }, { silent: true });
    drive.scheduleSync();
    toast(added ? `Feedback ready. ${added} ${added === 1 ? 'item' : 'items'} added to your mistakes notebook.` : 'Feedback ready.');
  } catch (e) {
    toast(e.message.length > 140 ? e.message.slice(0, 140) + '…' : e.message);
  } finally {
    analysing.delete(id); fillRecLists(); fillAllRecs();
  }
}

async function fillRecLists() {
  const boxes = document.querySelectorAll('[data-recs]');
  if (!boxes.length) return;
  const all = await store.recordings.all();
  boxes.forEach((box) => {
    const [date, sess] = box.dataset.recs.split('|');
    const list = all.filter((r) => r.date === date && r.session === sess).sort((a, b) => a.created - b.created);
    if (!list.length) {
      box.innerHTML = `<p class="muted">${box.dataset.big === '1' ? 'No morning recording today. You can record one now in the morning practice, or skip this step.' : 'No recording yet.'}</p>`;
      return;
    }
    box.innerHTML = list.map((r) => recHTML(r)).join('');
    box.querySelectorAll('audio').forEach((a) => {
      const r = list.find((x) => x.id === a.dataset.rec);
      a.src = URL.createObjectURL(r.blob);
    });
  });
}

function viewSession() {
  const { which, step } = session;
  const steps = STEPS[which]; const st = steps[step];
  const d = store.day(); const done = d[which].done;
  setupTimer(`${which}-${step}`, st.mins);
  return `
  <div class="sheet session" role="dialog" aria-modal="true" aria-label="${which} practice">
    <header class="sheet-top">
      <button class="icon-btn" data-action="close-session" aria-label="Close">${icon('x')}</button>
      <div class="progress-dots" aria-label="Step ${step + 1} of 4">
        ${steps.map((s, i) => `<button class="dot ${done[i] ? 'done' : ''} ${i === step ? 'cur' : ''}" data-action="goto" data-step="${i}" aria-label="Step ${i + 1}: ${esc(s.title)}${done[i] ? ', done' : ''}"></button>`).join('')}
      </div>
      <span class="which">${which === 'morning' ? icon('sun') : icon('moon')}</span>
    </header>
    <div class="sheet-body">
      <p class="step-of">Step ${step + 1} of 4</p>
      <h2>${esc(st.title)}</h2>
      <button id="timer" class="timer" data-action="timer" style="--p:${1 - timer.remaining / timer.total}">
        <span class="t">${fmtTime(timer.remaining)}</span><span class="lbl">${timer.running ? 'Pause' : timer.remaining < timer.total ? 'Resume' : 'Start timer'}</span>
      </button>
      <div class="step-content">${stepBody(which, step)}</div>
    </div>
    <footer class="sheet-foot">
      <button class="btn ghost" data-action="goto" data-step="${step - 1}" ${step === 0 ? 'disabled' : ''}>Back</button>
      <button class="btn primary" data-action="complete-step">${done[step] ? (step === 3 ? 'Finish' : 'Next step') : step === 3 ? 'Mark done and finish' : 'Mark done'}</button>
    </footer>
  </div>`;
}

/* ---------------- Coach tab ---------------- */
const MODES = [
  { id: 'chat', label: 'Just talk' },
  { id: 'practice', label: 'Role-play' },
  { id: 'correct', label: 'Correct my writing' },
  { id: 'explain', label: 'Explain grammar' },
];
const STARTERS = {
  chat: ['Ask me about my day.', 'Give me a question to answer out loud.', 'Let’s talk about my plans for this week.'],
  correct: ['Yesterday I go to the market and buyed rice.', 'He don’t know where the class is.', 'Me and my friend was late to class.'],
  practice: ['Practise a job interview with me.', 'I am selling phones. Be my customer.', 'Help me present my midterm project.'],
  explain: ['When do I use "an"?', 'What is the difference between "since" and "for"?', 'How do I ask questions correctly?'],
};
let chatSince = 0; // only messages after this time belong to the current conversation

function viewCoach() {
  const s = store.get();
  const msgs = s.chat.filter((m) => (m.t || 0) >= chatSince);
  const off = !navigator.onLine;
  const notReady = config.ai === null;
  const mine = msgs.filter((m) => m.role === 'user').length;
  const bubble = listening ? 'I’m listening…' : chatBusy ? 'Thinking…' : msgs.length ? (chatMode === 'practice' ? 'Your turn. Tap the mic and answer.' : 'Tap the mic to answer by voice.') : `Hi ${s.profile.name}! Tap the mic and talk to me.`;
  return `
  <section class="coach">
    <header class="page-head row">
      <h1>Coach</h1>
      <button class="icon-btn round ${s.settings.speakReplies ? 'on' : ''}" data-action="toggle-speak" aria-pressed="${s.settings.speakReplies}" aria-label="Read replies aloud">${icon(s.settings.speakReplies ? 'speaker' : 'mute')}</button>
    </header>
    <div class="ai-hero ${msgs.length ? 'compact' : ''} ${listening ? 'live' : ''} ${chatBusy ? 'busy' : ''}">
      <div class="orb" aria-hidden="true"><i></i><i></i><i></i></div>
      <p class="a-bubble" aria-live="polite">${esc(bubble)}</p>
      <div class="a-row">
        <button class="a-side" data-action="new-chat" aria-label="New conversation">${icon('plus')}</button>
        <button class="a-mic ${listening ? 'live' : ''}" data-action="listen" aria-label="${listening ? 'Stop listening' : 'Talk to the coach'}">${icon(listening ? 'stop' : 'mic')}</button>
        <button class="a-side" data-action="review-chat" aria-label="Review my English" ${mine >= 2 && !chatBusy ? '' : 'disabled'}>${icon('spark')}</button>
      </div>
    </div>
    <div class="chips modes" role="tablist">
      ${MODES.map((m) => `<button class="chip ${chatMode === m.id ? 'on' : ''}" role="tab" aria-selected="${chatMode === m.id}" data-action="mode" data-mode="${m.id}">${m.label}</button>`).join('')}
    </div>
    ${off ? '<div class="note">You’re offline. The coach needs the internet. Your practice still works offline.</div>' : ''}
    ${notReady && !off ? '<div class="note">The AI coach is not switched on yet. Add an AI key in Vercel (see Settings › AI coach).</div>' : ''}
    <div class="thread" id="thread" aria-live="polite">
      ${msgs.length ? msgs.map((m) => `
        <div class="msg ${m.role} ${m.review ? 'review' : ''}">
          ${m.role === 'assistant' ? md(m.content) : `<p>${esc(m.content)}</p>`}
          ${m.role === 'assistant' && !m.error ? `<button class="say tiny" data-action="speak" data-text="${esc(m.content)}" aria-label="Read aloud">${icon('speaker')}</button>` : ''}
          ${m.error ? `<button class="link" data-action="retry">Try again</button>` : ''}
        </div>`).join('') : `
        <div class="empty">
          <p class="muted">Try one of these:</p>
          <div class="chips">${STARTERS[chatMode].map((x) => `<button class="chip starter" data-action="starter" data-text="${esc(x)}">${esc(x)}</button>`).join('')}</div>
          <p class="muted small">When you have talked for a while, tap ${icon('spark')} to get a review of your English. Your mistakes go to your notebook.</p>
        </div>`}
      ${chatBusy ? '<div class="msg assistant typing"><span></span><span></span><span></span></div>' : ''}
    </div>
    <form class="composer" data-action="send">
      <textarea id="chat-input" rows="1" placeholder="${listening ? 'Listening…' : 'Ask me anything…'}" aria-label="Message">${esc(draft)}</textarea>
      <button type="submit" class="send" aria-label="Send" ${chatBusy ? 'disabled' : ''}>${icon('send')}</button>
    </form>
  </section>`;
}
let draft = '';
let listening = false;
let recognizer = null;

async function askCoach(messages, mode, context = '') {
  const r = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-app-passcode': store.get().settings.passcode || '' },
    body: JSON.stringify({ messages, mode, context }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Error ${r.status}`);
  return j.reply;
}

async function sendChat(text, { spoken = false } = {}) {
  text = text.trim();
  if (!text || chatBusy) return;
  if (!navigator.onLine) { toast('You’re offline. The coach needs the internet.'); return; }
  draft = '';
  store.update((s) => { s.chat.push({ role: 'user', content: text, t: Date.now() }); s.chat = s.chat.slice(-80); });
  await runChat(spoken);
}
async function runChat(spoken) {
  chatBusy = true; render(); scrollThread();
  const t = today();
  try {
    const history = store.get().chat.filter((m) => !m.error && !m.review && (m.t || 0) >= chatSince).map(({ role, content }) => ({ role, content }));
    const reply = await askCoach(history, chatMode, `Day ${t.dayNo}. Grammar focus: ${t.grammar.title}. Word of the day: ${t.word.w}.`);
    store.update((s) => s.chat.push({ role: 'assistant', content: reply, t: Date.now() }));
    if (store.get().settings.speakReplies || spoken) voice.speak(reply);
  } catch (e) {
    store.update((s) => s.chat.push({ role: 'assistant', content: e.message, t: Date.now(), error: true }));
  }
  chatBusy = false; render(); scrollThread();
}
async function reviewChat() {
  const mine = store.get().chat.filter((m) => m.role === 'user' && (m.t || 0) >= chatSince).map((m) => m.content);
  if (mine.length < 2 || chatBusy) return;
  if (!navigator.onLine) { toast('You’re offline. The review needs the internet.'); return; }
  chatBusy = true; render(); scrollThread();
  try {
    const reply = await askCoach([{ role: 'user', content: `My side of the conversation (${MODES.find((m) => m.id === chatMode)?.label}):\n${mine.map((x) => `- ${x}`).join('\n')}` }], 'review');
    const j = parseJson(reply);
    let text = reply; let added = 0;
    if (j) {
      text = [`**Review of your English**`, j.summary || '',
        (j.fixes || []).length ? `**Better ways to say it**\n${j.fixes.map((f) => `- "${f.wrong}" → "${f.right}"${f.why ? ` (${f.why})` : ''}`).join('\n')}` : '**No mistakes found.** Well done.',
        (j.strengths || []).length ? `**Strengths**\n${j.strengths.map((x) => `- ${x}`).join('\n')}` : '',
        j.next ? `**Practise next:** ${j.next}` : ''].filter(Boolean).join('\n\n');
      store.update((s) => { added = L.fromFixes(s, j.fixes, 'chat'); }, { silent: true });
    }
    store.update((s) => s.chat.push({ role: 'assistant', content: text, t: Date.now(), review: true }));
    drive.scheduleSync();
    if (added) toast(`${added} ${added === 1 ? 'mistake' : 'mistakes'} added to your notebook.`);
  } catch (e) { toast(e.message); }
  chatBusy = false; render(); scrollThread();
}
function openScenario(x) {
  session = null; settingsOpen = false; tab = 'coach'; chatMode = 'practice'; chatSince = Date.now();
  render();
  sendChat(x.start);
}
function scrollThread() { requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })); }

/* ---------------- Weekly report ---------------- */
function weekStats() {
  const s = store.get();
  const out = { days: 0, sessions: 0, minutes: 0, quiz: [0, 0], words: [], fixes: [], clarity: [], pace: [], fillers: 0, talks: 0, accuracy: [], journals: 0 };
  for (let i = 6; i >= 0; i--) {
    const dt = new Date(); dt.setDate(dt.getDate() - i);
    const k = store.todayKey(dt); const d = s.days[k];
    if (!d) continue;
    const m = store.sessionDone(d, 'morning'); const e = store.sessionDone(d, 'evening');
    if (m || e) out.days++;
    out.sessions += (m ? 1 : 0) + (e ? 1 : 0);
    out.minutes += d.minutes || 0;
    if (d.quiz) { out.quiz[0] += d.quiz.score; out.quiz[1] += d.quiz.total; }
    if (d.morning?.done?.[3]) out.words.push(C.pick(C.WORDS, store.dayIndex(k)).w);
    if (d.fix) out.fixes.push(d.fix);
    if ((d.journal || '').trim().length > 20) out.journals++;
    for (const f of Object.values(d.feedback || {})) {
      if (f.mode === 'talk') {
        out.talks++;
        if (f.scores?.clarity) out.clarity.push(+f.scores.clarity);
        if (f.scores?.pace) out.pace.push(+f.scores.pace);
        out.fillers += +f.fillers || 0;
      } else if (f.accuracy != null) out.accuracy.push(+f.accuracy);
    }
  }
  return out;
}
const avg = (a) => (a.length ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10 : null);

function latestReport() {
  const r = store.get().reports || [];
  return r[r.length - 1] || null;
}
function weeklyDue() {
  const dow = new Date().getDay(); // 0 Sunday, 1 Monday
  if (dow !== 0 && dow !== 1) return false;
  const last = latestReport();
  if (last && Date.now() - last.at < 5 * 86400000) return false;
  return weekStats().days > 0;
}

function weekText(w) {
  return [
    `Days practised: ${w.days} of 7. Sessions finished: ${w.sessions} of 14. Minutes: ${w.minutes}.`,
    `Grammar quiz: ${w.quiz[1] ? `${w.quiz[0]} of ${w.quiz[1]} right` : 'not taken'}. Journal entries: ${w.journals}.`,
    `New words learned: ${w.words.join(', ') || 'none'}.`,
    `Things he chose to fix after listening: ${w.fixes.join('; ') || 'none'}.`,
    `AI-checked talks: ${w.talks}. Average clarity ${avg(w.clarity) ?? '-'} of 5, average pace ${avg(w.pace) ?? '-'} of 5, filler words in total ${w.fillers}.`,
    `Pronunciation checks: ${w.accuracy.length}, average ${avg(w.accuracy) ?? '-'}% clear.`,
    `This week's grammar topic: ${today().grammar.title}.`,
  ].join('\n');
}

let reportBusy = false;
async function makeReport() {
  if (reportBusy) return;
  if (!navigator.onLine) { toast('You’re offline. The weekly report needs the internet.'); return; }
  reportBusy = true; render();
  try {
    const text = await askCoach([{ role: 'user', content: `Here are my practice numbers for the last 7 days:\n${weekText(weekStats())}` }], 'weekly');
    store.update((s) => { (s.reports ||= []).push({ at: Date.now(), date: store.todayKey(), text }); s.reports = s.reports.slice(-12); });
    drive.scheduleSync();
  } catch (e) { toast(e.message); }
  reportBusy = false; render();
}

function viewWeek() {
  const w = weekStats();
  const last = latestReport();
  const fresh = last && Date.now() - last.at < 6 * 86400000;
  return `
  <section class="week">
    <h2>This week</h2>
    <dl class="stats">
      <div><dt>Days practised</dt><dd>${w.days}/7</dd></div>
      <div><dt>Minutes</dt><dd>${w.minutes}</dd></div>
      <div><dt>Clarity (AI)</dt><dd>${avg(w.clarity) != null ? `${avg(w.clarity)}/5` : '–'}</dd></div>
      <div><dt>Pronunciation</dt><dd>${avg(w.accuracy) != null ? `${Math.round(avg(w.accuracy))}%` : '–'}</dd></div>
    </dl>
    ${w.words.length ? `<p class="hint">Words learned: <b>${w.words.map(esc).join(', ')}</b></p>` : ''}
    ${fresh ? `<div class="feedback report"><h4>Weekly report, ${new Date(last.date + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</h4>${md(last.text)}
      <button class="btn ghost small" data-action="speak" data-text="${esc(last.text)}">${icon('speaker')} Read it to me</button></div>` : ''}
    <button class="btn ${fresh ? 'ghost' : 'primary'} block" data-action="weekly-report" ${reportBusy ? 'disabled' : ''}>${icon('spark')} ${reportBusy ? 'Writing your report…' : fresh ? 'Write a new report' : 'Write my weekly report'}</button>
  </section>`;
}

/* ---------------- Progress tab ---------------- */
// Line chart of AI scores over time: clarity (talks, scaled to %) and pronunciation (% clear). One axis: 0–100%.
function scoreChart() {
  const h = L.history().slice(-40);
  const talk = h.filter((f) => f.mode === 'talk' && f.scores?.clarity).map((f) => ({ date: f.date, v: (+f.scores.clarity / 5) * 100 }));
  const pron = h.filter((f) => f.mode === 'pronounce' && f.accuracy != null).map((f) => ({ date: f.date, v: +f.accuracy }));
  if (talk.length + pron.length < 2) return '<p class="hint">After a few AI-checked talks and pronunciation checks, your scores appear here as a line over time.</p>';
  const W = 340, H = 180, P = { l: 34, r: 12, t: 12, b: 26 };
  const dates = [...new Set(h.map((f) => f.date))];
  const xi = (d) => P.l + (dates.length < 2 ? (W - P.l - P.r) / 2 : (dates.indexOf(d) / (dates.length - 1)) * (W - P.l - P.r));
  const y = (v) => P.t + (1 - v / 100) * (H - P.t - P.b);
  const series = [
    { name: 'Clarity', cls: 's1', pts: talk },
    { name: 'Pronunciation', cls: 's2', pts: pron },
  ].filter((x) => x.pts.length);
  const fmt = (d) => new Date(d + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  // Direct labels on the latest point of each line; push them apart if they would overlap.
  const labels = series.map((x) => ({ x: xi(x.pts.at(-1).date) - 8, y: y(x.pts.at(-1).v) - 9, t: `${x.name} ${Math.round(x.pts.at(-1).v)}%` }));
  if (labels.length === 2 && Math.abs(labels[0].y - labels[1].y) < 14) { const [hi, lo] = labels[0].y <= labels[1].y ? labels : [labels[1], labels[0]]; lo.y = hi.y + 30; }
  return `
  <figure class="chart">
    <div class="legend-row">${series.map((x) => `<span><i class="sw ${x.cls}"></i>${x.name}</span>`).join('')}</div>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Scores over time">
      ${[0, 50, 100].map((v) => `<line class="grid" x1="${P.l}" x2="${W - P.r}" y1="${y(v)}" y2="${y(v)}"/><text class="tick" x="${P.l - 6}" y="${y(v) + 4}" text-anchor="end">${v}%</text>`).join('')}
      <text class="tick" x="${P.l}" y="${H - 6}">${fmt(dates[0])}</text>
      <text class="tick" x="${W - P.r}" y="${H - 6}" text-anchor="end">${fmt(dates.at(-1))}</text>
      ${series.map((x) => `
        <polyline class="line ${x.cls}" points="${x.pts.map((p) => `${xi(p.date).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')}"/>
        ${x.pts.map((p) => `<circle class="pt ${x.cls}" cx="${xi(p.date).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="4.5"><title>${x.name}, ${fmt(p.date)}: ${Math.round(p.v)}%</title></circle>`).join('')}
`).join('')}
      ${labels.map((l) => `<text class="dlabel" x="${l.x.toFixed(1)}" y="${l.y.toFixed(1)}" text-anchor="end">${l.t}</text>`).join('')}
    </svg>
    <details class="table-view"><summary>Show the numbers</summary>
      <table><thead><tr><th>Date</th><th>Check</th><th>Score</th></tr></thead><tbody>
      ${series.flatMap((x) => x.pts.map((p) => ({ ...p, n: x.name }))).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20).map((r) => `<tr><td>${fmt(r.date)}</td><td>${r.n}</td><td>${Math.round(r.v)}%</td></tr>`).join('')}
      </tbody></table>
    </details>
  </figure>`;
}

function viewProgress() {
  const s = store.get();
  const days = Object.entries(s.days);
  const practised = days.filter(([, d]) => store.sessionDone(d, 'morning') || store.sessionDone(d, 'evening')).length;
  const totalMin = days.reduce((n, [, d]) => n + (d.minutes || 0), 0);
  const journals = days.filter(([, d]) => (d.journal || '').trim()).sort((a, b) => b[0].localeCompare(a[0]));
  const rc = L.counts(); const pr = L.pillars();
  const h = L.history().filter((f) => f.mode === 'talk').slice(-5);
  const wpm = h.filter((f) => f.wpm).map((f) => +f.wpm); const fill = h.map((f) => +f.fillers || 0);
  const levels = roadmapHTML();
  const cells = [];
  for (let i = 34; i >= 0; i--) {
    const dt = new Date(); dt.setDate(dt.getDate() - i);
    const k = store.todayKey(dt); const d = s.days[k];
    cells.push({ k, m: store.sessionDone(d, 'morning'), e: store.sessionDone(d, 'evening'), today: i === 0 });
  }
  return `
  <section class="progress">
    <header class="page-head row"><h1>Progress</h1><span class="pill">${icon('flame')} ${store.streak()}-day streak</span></header>
    <div class="tiles two">
      <div class="tile blue">${icon('clock')}<b>${totalMin}<small> min</small></b><span>Total practice<br><small>${practised} days</small></span></div>
      <div class="tile">${icon('check')}<b>${rc.mastered}<small> / ${rc.total}</small></b><span>Mistakes fixed<br><small>in your notebook</small></span></div>
    </div>
    <section class="card">
      <h2>Your five skills</h2>
      <ul class="skills">
        ${learn.PILLARS.map((x) => `<li><button data-action="go-pillar" data-p="${x.id}">
          <span class="bubble sm">${icon(x.icon)}</span>
          <span class="sk"><b>${esc(x.title)}</b><span class="bar"><i style="width:${Math.round(pr[x.id].p * 100)}%"></i></span><small>${esc(pr[x.id].label)}</small></span>
          <span class="pct">${Math.round(pr[x.id].p * 100)}%</span></button></li>`).join('')}
      </ul>
    </section>
    <section class="card">
      <h2>Speaking over time</h2>
      ${scoreChart()}
      ${h.length ? `<div class="tiles two flat">
        <div class="tile"><b>${wpm.length ? Math.round(wpm.reduce((a, b) => a + b, 0) / wpm.length) : '–'}</b><span>words a minute<br><small>last ${h.length} talks (aim for 120–150)</small></span></div>
        <div class="tile"><b>${(fill.reduce((a, b) => a + b, 0) / h.length).toFixed(1)}</b><span>filler words per talk<br><small>"um", "like": aim for 0–2</small></span></div>
      </div>` : ''}
    </section>
    <section class="card">
      <h2>Your roadmap</h2>
      <ol class="roadmap">${levels}</ol>
    </section>
    ${viewWeek()}
    <section class="cal card">
      <h2>Last 5 weeks</h2>
      <div class="grid" role="img" aria-label="Calendar of finished sessions">
        ${cells.map((c) => `<span class="cell ${c.m ? 'm' : ''} ${c.e ? 'e' : ''} ${c.today ? 'today' : ''}" title="${c.k}"><i></i><i></i></span>`).join('')}
      </div>
      <p class="legend"><span class="cell m"><i></i><i></i></span> morning <span class="cell e"><i></i><i></i></span> evening</p>
    </section>
    <section class="rec-history">
      <h2>Your recordings</h2>
      <p class="hint">Keep them. In a month, play Day 1 and today side by side. You will hear the difference.</p>
      <div id="all-recs"><p class="muted">Loading…</p></div>
    </section>
    <section class="journals">
      <h2>Journal</h2>
      ${journals.length ? journals.slice(0, 14).map(([k, d]) => `
        <details><summary>${new Date(k + 'T12:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</summary><p>${esc(d.journal).replace(/\n/g, '<br>')}</p>${d.journalFeedback ? learn.writingFeedback(d.journalFeedback) : ''}</details>`).join('') : '<p class="muted">Your evening writing will appear here.</p>'}
    </section>
  </section>`;
}
function roadmapHTML() {
  const steps = [...levelsInfo(), { name: 'Confident speaker', goal: 'All three levels mastered, mistakes reviewed, speaking clearly every day.', p: Math.min(1, ...levelsInfo().map((x) => x.p)) }];
  let cur = steps.findIndex((x) => x.p < 1); if (cur < 0) cur = steps.length - 1;
  return steps.map((x, i) => `<li class="${x.p >= 1 ? 'done' : i === cur ? 'cur' : ''}">
    <span class="node">${icon(x.p >= 1 ? 'check' : i === cur ? 'flag' : 'dot')}</span>
    <span><b>${esc(x.name)}</b><small>${esc(x.goal)}</small>${i === cur && x.p < 1 ? `<span class="bar"><i style="width:${Math.round(x.p * 100)}%"></i></span>` : ''}</span>
    <span class="pct">${Math.round(x.p * 100)}%</span></li>`).join('');
}
function levelsInfo() { return L.LEVELS_LIST.map((Lv) => ({ name: `Level ${Lv.id}: ${Lv.name}`, goal: Lv.goal, p: L.levelProgress(Lv) })); }
async function fillAllRecs() {
  const box = $('#all-recs'); if (!box) return;
  const all = (await store.recordings.all()).sort((a, b) => b.created - a.created);
  if (!all.length) { box.innerHTML = '<p class="muted">No recordings yet. Record your first one-minute talk in the morning practice.</p>'; return; }
  box.innerHTML = all.map((r) => recHTML(r, { canDelete: true, preload: 'none', fold: true })).join('');
  box.querySelectorAll('audio').forEach((a) => { const r = all.find((x) => x.id === a.dataset.rec); a.src = URL.createObjectURL(r.blob); });
}

/* ---------------- Settings ---------------- */
let settingsOpen = false;
let driveStatus = { state: 'idle', message: '' };
function viewSettings() {
  const s = store.get();
  const remUrl = `/api/reminders?m=${encodeURIComponent(s.settings.morningTime)}&e=${encodeURIComponent(s.settings.eveningTime)}&d=${store.todayKey()}`;
  const dc = s.drive.connected;
  return `
  <div class="sheet settings" role="dialog" aria-modal="true" aria-label="Settings">
    <header class="sheet-top"><h2>Settings</h2><button class="icon-btn" data-action="close-settings" aria-label="Close">${icon('x')}</button></header>
    <div class="sheet-body">
      <section>
        <h3>Daily reminders</h3>
        <div class="two">
          <label>Morning<input type="time" class="field" data-bind="morningTime" value="${esc(s.settings.morningTime)}"></label>
          <label>Evening<input type="time" class="field" data-bind="eveningTime" value="${esc(s.settings.eveningTime)}"></label>
        </div>
        <a class="btn primary block" href="${remUrl}" data-action="add-reminders">${icon('bell')} Add to my iPhone Calendar</a>
        <p class="hint">Your iPhone will ask to <b>Add All</b>. Tap it. The alerts ring at the exact time every day, even when the app is closed or you are offline. If you change the times, tap the button again and delete the old events in Calendar.</p>
      </section>

      <section>
        <h3>Google Drive backup</h3>
        ${!config.googleClientId ? `<p class="hint">Not set up yet. Add <b>GOOGLE_CLIENT_ID</b> in Vercel (steps are in the README on GitHub). Until then, your progress is saved on this phone, and you can use Export below.</p>` : dc ? `
          <p class="status ${driveStatus.state}">${esc(driveStatus.message || (s.drive.lastSync ? `Last saved ${ago(s.drive.lastSync)}.` : 'Connected.'))}</p>
          <p class="hint">Saved in your Drive in a folder called <b>Speak Daily</b>: progress.json and your recordings.</p>
          <div class="btns"><button class="btn" data-action="drive-sync">${icon('cloud')} Save to Drive now</button><button class="btn ghost" data-action="drive-off">Disconnect</button></div>` : `
          <p class="hint">Save your progress, journal and recordings to your own Google Drive, so nothing is lost if you change phones.</p>
          <button class="btn primary block" data-action="drive-connect">${icon('cloud')} Connect Google Drive</button>
          ${driveStatus.state === 'error' ? `<p class="status error">${esc(driveStatus.message)}</p>` : ''}`}
      </section>

      <section>
        <h3>AI coach</h3>
        <p class="hint">${config.ai ? `Connected to ${config.ai === 'claude' ? 'Claude' : 'Google Gemini'}.` : 'Not switched on yet. Add ANTHROPIC_API_KEY or GEMINI_API_KEY in Vercel, then redeploy.'}</p>
        ${config.passcodeRequired ? `<label>App passcode<input class="field" type="password" autocomplete="off" data-bind="passcode" value="${esc(s.settings.passcode)}" placeholder="Enter your passcode"></label>
        <p class="hint">The passcode stops strangers from using your AI credit.</p>` : ''}
        <label class="toggle"><input type="checkbox" data-bind="speakReplies" ${s.settings.speakReplies ? 'checked' : ''}> Read coach replies aloud</label>
      </section>

      <section>
        <h3>You</h3>
        <label>Your name<input class="field" data-bind="name" value="${esc(s.profile.name)}"></label>
        <label>Practice started on<input class="field" type="date" data-bind="startDate" value="${esc(s.profile.startDate)}"></label>
      </section>

      <section>
        <h3>Backup file</h3>
        <p class="hint">Works offline. Export saves your progress as a file; Import brings it back.</p>
        <div class="btns"><button class="btn ghost" data-action="export">Export</button><label class="btn ghost">Import<input type="file" accept="application/json" data-action="import" hidden></label></div>
      </section>
      <p class="muted center">Speak Daily 1.2</p>
    </div>
  </div>`;
}

/* ---------------- render ---------------- */
function render() {
  applyPhase();
  const main = $('#main');
  const views = { today: viewToday, learn: learn.view, coach: viewCoach, progress: viewProgress };
  if (!views[tab]) tab = 'today';
  const active = document.activeElement;
  const keepFocus = active && active.id === 'chat-input';
  const selStart = keepFocus ? active.selectionStart : 0;
  main.innerHTML = views[tab]();
  document.querySelectorAll('.tabbar button').forEach((b) => b.setAttribute('aria-current', b.dataset.tab === tab ? 'page' : 'false'));
  const ov = $('#overlay'); const wasEmpty = !ov.innerHTML;
  ov.innerHTML = session ? viewSession() : learn.isOpen() ? learn.sheetView() : settingsOpen ? viewSettings() : '';
  if (wasEmpty) ov.firstElementChild?.classList.add('enter'); // animate only when a sheet opens, not on every redraw
  document.body.classList.toggle('sheet-open', !!(session || settingsOpen || learn.isOpen()));
  document.body.dataset.tab = tab;
  if (keepFocus) { const i = $('#chat-input'); if (i) { i.focus(); i.setSelectionRange(selStart, selStart); } }
  fillRecLists(); fillAllRecs();
  autoGrow();
}
function autoGrow() { const ta = $('#chat-input'); if (ta) { ta.style.height = 'auto'; ta.style.height = Math.min(140, ta.scrollHeight) + 'px'; } }

/* ---------------- events ---------------- */

document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const a = el.dataset.action;
  const t = today();
  switch (a) {
    case 'tab': if (tab === el.dataset.tab && tab === 'learn') learn.reset(); tab = el.dataset.tab; window.scrollTo(0, 0); render(); break;
    case 'go-unit': session = null; stopTimer(); tab = 'learn'; learn.openPillar('grammar'); await learn.handle('l-unit', el); window.scrollTo(0, 0); break;
    case 'go-pillar': tab = 'learn'; learn.openPillar(el.dataset.p); window.scrollTo(0, 0); render(); break;
    case 'new-chat': chatSince = Date.now(); voice.stopSpeaking(); render(); toast('New conversation started.'); break;
    case 'review-chat': reviewChat(); break;
    case 'tab-close': session = null; stopTimer(); tab = el.dataset.tab; render(); break;
    case 'open-session': {
      const unit = t.week;
      store.update((s) => { const d = store.day(); if (d.unit == null) d.unit = unit; }, { silent: true });
      session = { which: el.dataset.which, step: Math.max(0, store.day()[el.dataset.which].done.findIndex((x) => !x)) }; if (session.step < 0) session.step = 0; render(); break;
    }
    case 'close-session': if (rec.ctl) await finishRecord(); session = null; stopTimer(); timer.key = null; voice.stopSpeaking(); render(); break;
    case 'goto': { const n = +el.dataset.step; if (n >= 0 && n < 4) { if (rec.ctl) await finishRecord(); session.step = n; render(); $('.sheet-body')?.scrollTo(0, 0); } break; }
    case 'complete-step': {
      const { which, step } = session;
      if (step === 3) drive.renewFromTap();
      const wasDone = store.day()[which].done[step];
      store.update((s) => {
        const d = store.day(); d[which].done[step] = true; d.updatedAt = Date.now(); if (!wasDone) d.minutes = (d.minutes || 0) + STEPS[which][step].mins;
        if (which === 'morning' && STEPS.morning[step].id === 'word') L.addWord(s, t.word); // the day's word joins the word bank
      });
      if (step < 3) { session.step++; render(); $('.sheet-body')?.scrollTo(0, 0); }
      else {
        session = null; stopTimer(); timer.key = null; render();
        const both = store.sessionDone(store.day(), 'morning') && store.sessionDone(store.day(), 'evening');
        toast(both ? 'Both sessions done today. Well done!' : which === 'morning' ? 'Morning practice done. See you this evening.' : 'Evening practice done. Rest well.');
      }
      drive.scheduleSync();
      break;
    }
    case 'timer': toggleTimer(); break;
    case 'speak': voice.speak(el.dataset.text, { rate: 0.9 }); break;
    case 'record': await toggleRecord({ limit: +el.dataset.limit, title: el.dataset.title, sessionName: el.dataset.session, kind: el.dataset.kind, topic: el.dataset.topic, expected: el.dataset.expected }); render(); break;
    case 'fix': store.update((s) => { const d = store.day(); d.fix = el.dataset.v; d.updatedAt = Date.now(); }); drive.scheduleSync(); break;
    case 'quiz': {
      const qi = +el.dataset.q; const oi = +el.dataset.o;
      store.update((s) => {
        const d = store.day(); if (d.unit == null) d.unit = t.week; d.quizAnswers ||= {}; d.quizAnswers[qi] = oi; d.updatedAt = Date.now();
        if (oi !== t.quiz[qi].a) L.fromQuiz(s, t.week, t.quiz[qi]);
        const ans = Object.keys(d.quizAnswers);
        if (ans.length === t.quiz.length) d.quiz = { score: t.quiz.filter((q, i) => d.quizAnswers[i] === q.a).length, total: t.quiz.length };
      });
      drive.scheduleSync();
      break;
    }
    case 'journal-check': {
      const text = (store.day().journal || '').trim();
      if (text.split(/\s+/).length < 5) { toast('Write a few sentences first.'); break; }
      if (!navigator.onLine) { toast('You’re offline. Your writing is saved; ask the coach when you’re back online.'); break; }
      chatBusy = true; render();
      try {
        const fb = await learn.checkWriting(text, `Evening journal. Prompt: ${t.prompt}`, 'journal');
        store.update((s) => { const d = store.day(); d.journalFeedback = fb; d.updatedAt = Date.now(); });
        drive.scheduleSync();
      } catch (err) { toast(err.message); }
      chatBusy = false; render();
      break;
    }
    case 'mode': chatMode = el.dataset.mode; render(); break;
    case 'starter': sendChat(el.dataset.text); break;
    case 'retry': store.update((s) => { s.chat = s.chat.filter((m) => !m.error); }); runChat(false); break;
    case 'toggle-speak': store.update((s) => { s.settings.speakReplies = !s.settings.speakReplies; }); if (!store.get().settings.speakReplies) voice.stopSpeaking(); break;
    case 'listen': {
      if (listening) { recognizer?.stop(); break; }
      voice.stopSpeaking();
      recognizer = voice.listen({
        onText: (txt) => { draft = txt; const i = $('#chat-input'); if (i) { i.value = txt; autoGrow(); } },
        onEnd: (final) => { listening = false; render(); if (final) sendChat(final, { spoken: true }); },
        onError: (err) => { listening = false; toast(err.message); render(); },
      });
      if (recognizer) { listening = true; render(); }
      break;
    }
    case 'settings': settingsOpen = true; render(); break;
    case 'close-settings': settingsOpen = false; render(); break;
    case 'add-reminders': if (!navigator.onLine) { e.preventDefault(); toast('Connect to the internet once to add the reminders.'); } break;
    case 'drive-connect': case 'drive-sync': await drive.sync({ interactive: true }); render(); break;
    case 'drive-off': drive.disconnect(); render(); break;
    case 'export': {
      const s = store.get();
      const blob = new Blob([JSON.stringify({ ...s, settings: { ...s.settings, passcode: '' } }, null, 1)], { type: 'application/json' });
      const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `speak-daily-backup-${store.todayKey()}.json`; link.click();
      break;
    }
    case 'weekly-report': makeReport(); break;
    case 'rec-feedback': analyse(el.dataset.id); break;
    case 'del-rec': if (confirm('Delete this recording from this phone?')) { await store.recordings.remove(el.dataset.id); render(); } break;
    default: await learn.handle(a, el);
  }
});

document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.id === 'chat-input') { draft = el.value; autoGrow(); return; }
  if (learn.onInput(el)) { drive.scheduleSync(); return; }
  const b = el.dataset?.bind; if (!b) return;
  const silent = { silent: true };
  store.update((s) => {
    const d = store.day();
    if (b === 'journal') { d.journal = el.value; d.updatedAt = Date.now(); }
    else if (b === 'wordSentence') { d.wordSentences ||= ['', '', '']; d.wordSentences[+el.dataset.i] = el.value; d.updatedAt = Date.now(); }
    else if (b === 'name') s.profile.name = el.value || 'friend';
    else if (b === 'startDate' && el.value) s.profile.startDate = el.value;
    else if (b === 'passcode') s.settings.passcode = el.value.trim();
    else if (b === 'morningTime' || b === 'eveningTime') s.settings[b] = el.value;
    else if (b === 'speakReplies') s.settings.speakReplies = el.checked;
  }, silent);
  if (b === 'journal') {
    const v = el.value.trim();
    const c = $('#jcount'); if (c) c.textContent = `${v.split(/[.!?]+/).filter((x) => x.trim().length > 3).length} sentences, ${v.split(/\s+/).filter(Boolean).length} words`;
  }
  if (['morningTime', 'eveningTime'].includes(b)) {
    const s = store.get(); const link = $('[data-action="add-reminders"]');
    if (link) link.href = `/api/reminders?m=${encodeURIComponent(s.settings.morningTime)}&e=${encodeURIComponent(s.settings.eveningTime)}&d=${store.todayKey()}`;
  }
  drive.scheduleSync();
});

document.addEventListener('change', async (e) => {
  if (e.target.dataset.action === 'import' && e.target.files[0]) {
    try {
      const data = JSON.parse(await e.target.files[0].text());
      if (!data.days) throw new Error();
      store.replace(store.merge(store.get(), { ...data, updatedAt: Date.now() }));
      toast('Backup imported.'); drive.scheduleSync();
    } catch { toast('That file is not a Speak Daily backup.'); }
  }
  if (e.target.dataset.bind === 'speakReplies' || e.target.dataset.bind === 'startDate') render();
});

document.addEventListener('submit', (e) => {
  if (e.target.dataset.action === 'send') { e.preventDefault(); sendChat($('#chat-input').value); }
});
document.addEventListener('keydown', (e) => {
  if (e.target.id === 'chat-input' && e.key === 'Enter' && !e.shiftKey && !e.isComposing && window.matchMedia('(hover: hover)').matches) { e.preventDefault(); sendChat(e.target.value); }
  if (e.key === 'Escape' && (session || settingsOpen || learn.isOpen())) { session = null; settingsOpen = false; learn.handle('l-close', e.target); stopTimer(); timer.key = null; render(); }
});

/* ---------------- boot ---------------- */
learn.init({ render, recorderBlock, recList, askCoach, openScenario, today, sync: () => drive.scheduleSync() });
store.subscribe(() => render());
drive.onStatus((st) => { driveStatus = st; if (settingsOpen) render(); });
window.addEventListener('speakdaily:merged', () => render());
window.addEventListener('speakdaily:saved', () => { if (tab === 'today' || settingsOpen) render(); });
try { navigator.storage?.persist?.(); } catch { /* optional */ }
window.addEventListener('online', () => render());
window.addEventListener('offline', () => render());
document.addEventListener('visibilitychange', () => { if (!document.hidden) { applyPhase(); render(); } });

(async function boot() {
  const params = new URLSearchParams(location.search);
  const sess = params.get('session');
  if (sess === 'morning' || sess === 'evening') {
    session = { which: sess, step: Math.max(0, store.day()[sess].done.findIndex((x) => !x)) };
    history.replaceState(null, '', '/');
  }
  render();
  try {
    const r = await fetch('/api/config');
    if (r.ok) { config = await r.json(); localStorage.setItem('speakdaily.config', JSON.stringify(config)); }
  } catch {
    try { config = JSON.parse(localStorage.getItem('speakdaily.config')) || config; } catch { /* defaults */ }
  }
  drive.configure(config.googleClientId);
  render();
  if (store.get().drive.connected) drive.sync({ interactive: false });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
})();
