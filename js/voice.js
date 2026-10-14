// Microphone recording, speech-to-text and text-to-speech, using what the iPhone's Safari provides.

export function pickMime() {
  const types = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'];
  if (!window.MediaRecorder) return null;
  return types.find((t) => MediaRecorder.isTypeSupported?.(t)) || '';
}

export function canRecord() { return !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder); }

// Returns a controller: { stop(): Promise<Blob>, level(): number 0..1 }
export async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  const mime = pickMime();
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  rec.start(250);

  let analyser = null; let data = null; let ctx = null;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const src = ctx.createMediaStreamSource(stream);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    data = new Uint8Array(analyser.fftSize);
    src.connect(analyser);
  } catch { /* level meter is optional */ }

  return {
    level() {
      if (!analyser) return 0.3;
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
      return Math.min(1, Math.sqrt(sum / data.length) * 4);
    },
    stop() {
      return new Promise((res) => {
        rec.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          ctx?.close?.();
          res(new Blob(chunks, { type: rec.mimeType || mime || 'audio/mp4' }));
        };
        rec.stop();
      });
    },
  };
}

/* ---------- Speech to text ---------- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
export function canListen() { return !!SR; }

// onText(partialOrFinal, isFinal)
export function listen({ onText, onEnd, onError, lang = 'en-US' }) {
  if (!SR) { onError?.(new Error('Voice typing is not available here. Use the microphone key on your iPhone keyboard instead.')); return null; }
  const r = new SR();
  r.lang = lang;
  r.interimResults = true;
  r.continuous = false;
  let finalText = '';
  r.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) finalText += t; else interim += t;
    }
    onText?.((finalText + interim).trim(), false);
  };
  r.onerror = (e) => onError?.(new Error(e.error === 'not-allowed' ? 'Microphone permission is off. Turn it on in Settings › Safari › Microphone.' : 'I could not hear that. Try again.'));
  r.onend = () => { onText?.(finalText.trim(), true); onEnd?.(finalText.trim()); };
  r.start();
  return r;
}

/* ---------- Text to speech ---------- */
let voice = null;
function chooseVoice() {
  const vs = speechSynthesis.getVoices();
  voice = vs.find((v) => /en[-_]US/i.test(v.lang) && /Samantha|Ava|Allison|Nicky/i.test(v.name))
    || vs.find((v) => /en[-_](US|GB)/i.test(v.lang))
    || vs.find((v) => /^en/i.test(v.lang)) || null;
}
if ('speechSynthesis' in window) { chooseVoice(); speechSynthesis.onvoiceschanged = chooseVoice; }

export function canSpeak() { return 'speechSynthesis' in window; }

export function speak(text, { rate = 0.95, onEnd } = {}) {
  if (!canSpeak()) return;
  speechSynthesis.cancel();
  const clean = text.replace(/[*_#`>]/g, '').replace(/\s+/g, ' ');
  const u = new SpeechSynthesisUtterance(clean);
  if (voice) u.voice = voice;
  u.lang = voice?.lang || 'en-US';
  u.rate = rate;
  u.onend = () => onEnd?.();
  speechSynthesis.speak(u);
}

export function stopSpeaking() { if (canSpeak()) speechSynthesis.cancel(); }
