// POST /api/chat  { messages: [{role:'user'|'assistant', content}], mode }
// Works with either an Anthropic (Claude) key or a Google Gemini key, set in Vercel:
//   ANTHROPIC_API_KEY  (optional ANTHROPIC_MODEL)
//   GEMINI_API_KEY     (optional GEMINI_MODEL)
//   APP_PASSCODE       (optional, stops strangers from using your AI credit)

const BASE = `You are "Coach", a warm, patient English speaking and writing coach inside the Speak Daily app.
The learner is Othniel, a university student in Liberia who is improving his articulation, grammar and communication.
Rules:
- Use plain, simple English. No jargon. Short paragraphs.
- Be encouraging but honest. Point out real mistakes.
- When he writes something with mistakes, show the corrected version first, then list each fix in one short line ("went, not go: it happened yesterday, so use the past tense").
- Keep replies short (under 120 words) unless he asks for more, because replies may be read aloud.
- End most replies with one short question to keep him talking.
- Do not use tables. Avoid emojis except an occasional one.`;

const MODES = {
  chat: 'Have a friendly, natural conversation. Gently correct only the most important grammar mistake in each of his messages, in one line at the end, starting with "Tip:".',
  correct: 'He will send sentences or a journal entry. Correct them fully: give the corrected text, then explain each fix in one short line. Finish with one thing he did well.',
  practice: 'Role-play a real-life situation he picks (job interview, class presentation, selling at a market, talking to a customer, asking a lecturer a question). Stay in character, keep each turn short, and after every 4 turns give quick feedback.',
  explain: 'Explain grammar or word questions very simply with 2-3 examples, using everyday Liberian life (school, market, church, tech) where it helps.',
};

function clean(messages) {
  return (Array.isArray(messages) ? messages : [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
}

async function anthropic(system, messages) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5', max_tokens: 600, system, messages }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || `Claude error ${r.status}`);
  return j.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n');
}

// If a model is busy (high demand / rate limit) or unavailable, try the next one.
const GEMINI_FALLBACKS = ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-3.1-flash-lite'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function geminiOnce(model, system, messages) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      generationConfig: { maxOutputTokens: 800, temperature: 0.7 },
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(j?.error?.message || `Gemini error ${r.status}`);
    err.retryable = [404, 429, 500, 503].includes(r.status);
    throw err;
  }
  const text = (j.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
  if (!text.trim()) { const err = new Error('The coach returned an empty answer.'); err.retryable = true; throw err; }
  return text;
}

async function gemini(system, messages) {
  const models = [...new Set([process.env.GEMINI_MODEL, ...GEMINI_FALLBACKS].filter(Boolean))];
  let last;
  for (let i = 0; i < models.length; i++) {
    try { return await geminiOnce(models[i], system, messages); }
    catch (e) {
      last = e;
      if (!e.retryable) throw e;
      if (i === 0) await sleep(600);
    }
  }
  throw new Error(`All AI models are busy right now. Please try again in a minute. (${last?.message || 'unknown error'})`);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });
  const pass = process.env.APP_PASSCODE;
  if (pass && req.headers['x-app-passcode'] !== pass) {
    return res.status(401).json({ error: 'Wrong or missing passcode. Enter it in Settings.' });
  }
  if (!process.env.ANTHROPIC_API_KEY && !process.env.GEMINI_API_KEY) {
    return res.status(503).json({ error: 'The AI coach is not switched on yet. Add ANTHROPIC_API_KEY or GEMINI_API_KEY in Vercel, then redeploy.' });
  }
  const { messages, mode = 'chat', context = '' } = req.body || {};
  const msgs = clean(messages);
  if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return res.status(400).json({ error: 'Send a message first.' });
  // Both providers need the conversation to start with the user.
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();
  const system = `${BASE}\n\nMode: ${MODES[mode] || MODES.chat}${context ? `\n\nToday in his practice: ${String(context).slice(0, 500)}` : ''}`;
  try {
    const reply = process.env.ANTHROPIC_API_KEY ? await anthropic(system, msgs) : await gemini(system, msgs);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ reply: reply.trim() });
  } catch (e) {
    return res.status(502).json({ error: `The coach could not answer: ${e.message}` });
  }
}
