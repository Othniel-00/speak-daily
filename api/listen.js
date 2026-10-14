// POST /api/listen  { audio: <base64 WAV>, mode: 'talk' | 'pronounce', topic?, expected? }
// The AI listens to a recording and returns feedback as JSON.
//   talk:      clarity, pace, filler words, grammar, one thing to fix next
//   pronounce: compares the recording with the text he was reading and lists unclear words
// Needs GEMINI_API_KEY (Gemini can listen to audio).
import { gemini, checkPasscode } from '../lib/gemini.js';

const WHO = 'The speaker is Othniel, a university student in Liberia practising clear spoken English. A Liberian accent is completely fine: judge clarity, pace and correctness, never the accent itself. Use plain, simple, kind and honest English.';

const TALK = (topic) => `${WHO}
Listen to his one-minute talk${topic ? ` on the topic "${topic}"` : ''}.
Return ONLY a JSON object with exactly these keys:
{
  "transcript": "what he said, word for word as best you can",
  "scores": { "clarity": 1-5, "pace": 1-5, "grammar": 1-5, "confidence": 1-5 },
  "words_per_minute": estimated number,
  "pace_note": "short note, e.g. a little fast / good speed / too slow",
  "filler_words": { "count": number, "examples": ["um", "like"] },
  "unclear_words": ["words that were hard to understand"],
  "grammar_fixes": [ { "said": "what he said", "better": "the correct way" } ],
  "went_well": "one sentence",
  "fix_next": "ONE specific, practical thing to fix tomorrow (one sentence)",
  "encouragement": "one short warm sentence"
}
Keep lists short (max 5 items). If the audio is silent or too unclear, say so in "fix_next" and give low scores.`;

const PRONOUNCE = (expected) => `${WHO}
He is reading this text aloud:
"""${expected}"""
Listen and compare what he said with the text.
Return ONLY a JSON object with exactly these keys:
{
  "transcript": "what you heard",
  "accuracy": number from 0 to 100 (how much of the text was clear and correct),
  "problem_words": [ { "word": "the word from the text", "issue": "unclear | skipped | changed | ending dropped", "tip": "short how-to-say-it tip, e.g. stress or sound" } ],
  "went_well": "one sentence",
  "overall_tip": "one practical tip for the next reading"
}
List at most 8 problem words, most important first. If everything was clear, return an empty problem_words list.`;

function parseJson(text) {
  try { return JSON.parse(text); } catch { /* fall through */ }
  const m = text.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* fall through */ } }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });
  if (!checkPasscode(req, res)) return;
  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({ error: 'Voice feedback needs a Google Gemini key (GEMINI_API_KEY) in Vercel.' });
  }
  const { audio, mode = 'talk', topic = '', expected = '' } = req.body || {};
  if (typeof audio !== 'string' || audio.length < 1000) return res.status(400).json({ error: 'The recording is empty. Record again.' });
  if (audio.length > 4_200_000) return res.status(413).json({ error: 'The recording is too long. Keep it under 2 minutes.' });
  if (mode === 'pronounce' && !expected.trim()) return res.status(400).json({ error: 'Missing the text you were reading.' });

  const prompt = mode === 'pronounce' ? PRONOUNCE(String(expected).slice(0, 2500)) : TALK(String(topic).slice(0, 200));
  try {
    const text = await gemini({
      contents: [{ role: 'user', parts: [{ inlineData: { mimeType: 'audio/wav', data: audio } }, { text: prompt }] }],
      json: true,
      maxTokens: 1500,
      temperature: 0.3,
    });
    const data = parseJson(text);
    if (!data) return res.status(502).json({ error: 'The AI answer could not be read. Try again.' });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ mode, ...data });
  } catch (e) {
    return res.status(502).json({ error: `The coach could not listen: ${e.message}` });
  }
}
