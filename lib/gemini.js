// Shared Google Gemini helper. If a model is busy (high demand / rate limit) or
// unavailable, it tries the next one so the coach keeps working.
const FALLBACKS = ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-3.1-flash-lite'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function once(model, { system, contents, json, maxTokens, temperature }) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      contents,
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature,
        ...(json ? { responseMimeType: 'application/json' } : {}),
      },
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(j?.error?.message || `Gemini error ${r.status}`);
    err.retryable = [404, 429, 500, 503].includes(r.status);
    throw err;
  }
  const text = (j.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
  if (!text.trim()) { const err = new Error('The AI returned an empty answer.'); err.retryable = true; throw err; }
  return text;
}

export async function gemini({ system, contents, json = false, maxTokens = 800, temperature = 0.7 }) {
  const models = [...new Set([process.env.GEMINI_MODEL, ...FALLBACKS].filter(Boolean))];
  let last;
  for (let i = 0; i < models.length; i++) {
    try { return await once(models[i], { system, contents, json, maxTokens, temperature }); }
    catch (e) {
      last = e;
      if (!e.retryable) throw e;
      if (i === 0) await sleep(600);
    }
  }
  throw new Error(`All AI models are busy right now. Please try again in a minute. (${last?.message || 'unknown error'})`);
}

export function checkPasscode(req, res) {
  const pass = process.env.APP_PASSCODE;
  if (pass && req.headers['x-app-passcode'] !== pass) {
    res.status(401).json({ error: 'Wrong or missing passcode. Enter it in Settings.' });
    return false;
  }
  return true;
}
