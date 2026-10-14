// Turns a phone recording (m4a/webm) into a small mono WAV file, as base64,
// so the AI can listen to it. Long recordings use a lower sample rate to stay small.

const MAX_BYTES = 2_900_000; // keeps the upload under the server's size limit

function resample(channels, fromRate, toRate) {
  const len = channels[0].length;
  const outLen = Math.floor((len * toRate) / fromRate);
  const out = new Float32Array(outLen);
  const ratio = fromRate / toRate;
  for (let i = 0; i < outLen; i++) {
    const pos = i * ratio;
    const i0 = Math.floor(pos);
    const i1 = Math.min(i0 + 1, len - 1);
    const f = pos - i0;
    let v = 0;
    for (const ch of channels) v += ch[i0] * (1 - f) + ch[i1] * f;
    out[i] = v / channels.length;
  }
  return out;
}

function encodeWav(samples, rate) {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, samples.length * 2, true);
  // Normalise quiet recordings so the AI can hear them.
  let peak = 0;
  for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
  const gain = peak > 0 && peak < 0.5 ? 0.9 / peak : 1;
  for (let i = 0, o = 44; i < samples.length; i++, o += 2) {
    const s = Math.max(-1, Math.min(1, samples[i] * gain));
    v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buf;
}

function toBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export async function toWavBase64(blob) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  try {
    const data = await blob.arrayBuffer();
    const audio = await new Promise((res, rej) => {
      const p = ctx.decodeAudioData(data, res, rej);
      if (p && p.then) p.then(res, rej);
    });
    const channels = [];
    for (let c = 0; c < audio.numberOfChannels; c++) channels.push(audio.getChannelData(c));
    const rate = Math.max(8000, Math.min(16000, Math.floor(MAX_BYTES / 2 / Math.max(1, audio.duration))));
    const mono = resample(channels, audio.sampleRate, rate);
    return { base64: toBase64(encodeWav(mono, rate)), seconds: audio.duration };
  } finally {
    ctx.close?.();
  }
}
