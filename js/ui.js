// Small helpers shared by every screen.
export const $ = (s, el = document) => el.querySelector(s);
export const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fmtTime = (sec) => `${Math.floor(sec / 60)}:${String(Math.max(0, sec % 60)).padStart(2, '0')}`;
export const icon = (name) => `<svg class="ic" aria-hidden="true"><use href="#i-${name}"/></svg>`;
export const ago = (d) => {
  const m = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  if (!isFinite(m)) return '';
  if (m < 60) return `${Math.max(1, m)} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} d ago`;
};
export const toast = (msg) => {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => { t.classList.remove('show'); setTimeout(() => (t.hidden = true), 300); }, 2600);
};
// Very small, safe markdown: bold, italics, line breaks, bullet lines.
export function md(text = '') {
  return esc(text)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/(^|\s)\*(\S.+?)\*/g, '$1<i>$2</i>')
    .split(/\n{2,}/).map((p) => `<p>${p.replace(/\n[-•] /g, '<br>• ').replace(/^[-•] /, '• ').replace(/\n/g, '<br>')}</p>`).join('');
}
// Read a JSON object out of an AI answer, even if it is wrapped in other text.
export function parseJson(text) {
  try { return JSON.parse(text); } catch { /* look inside */ }
  const m = String(text || '').match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* not JSON */ } }
  return null;
}
// A progress ring (0..1) drawn with SVG.
export function ring(p, size = 56, stroke = 6) {
  const r = size / 2 - stroke; const c = 2 * Math.PI * r;
  return `<svg class="pring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="pring-track" stroke-width="${stroke}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="pring-fill" stroke-width="${stroke}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - Math.max(0, Math.min(1, p)))}"/>
  </svg>`;
}
