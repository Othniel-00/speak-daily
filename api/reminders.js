// GET /api/reminders?m=04:55&e=20:55&d=2026-10-14
// Returns a calendar file. Opening it on iPhone offers "Add All", and the
// alerts then fire at the exact time every day, even offline.
const ok = (t) => /^\d{2}:\d{2}$/.test(t || '');

function local(date, time) {
  return date.replace(/-/g, '') + 'T' + time.replace(':', '') + '00';
}
function addMinutes(time, mins) {
  const [h, m] = time.split(':').map(Number);
  const t = h * 60 + m + mins;
  return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

export default function handler(req, res) {
  const m = ok(req.query.m) ? req.query.m : '04:55';
  const e = ok(req.query.e) ? req.query.e : '20:55';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(req.query.d || '') ? req.query.d : new Date().toISOString().slice(0, 10);
  const host = `https://${req.headers['x-forwarded-host'] || req.headers.host}`;
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const ev = (id, title, time, desc, session) => [
    'BEGIN:VEVENT',
    `UID:speakdaily-${id}@${req.headers.host}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${local(d, time)}`,
    `DTEND:${local(d, addMinutes(time, 20))}`,
    'RRULE:FREQ=DAILY',
    `SUMMARY:${title}`,
    `DESCRIPTION:${desc}\\n\\nOpen Speak Daily: ${host}/?session=${session}`,
    `URL:${host}/?session=${session}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${title}`, 'TRIGGER:PT0M', 'END:VALARM',
    'END:VEVENT',
  ].join('\r\n');

  const body = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Speak Daily//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:Speak Daily',
    ev('morning', 'Speak Daily: morning practice', m, '20 minutes: warm up, read aloud, record a 1-minute talk, learn a new word.', 'morning'),
    ev('evening', 'Speak Daily: evening practice', e, '20 minutes: listen back, write your journal, grammar quiz, shadow a speaker.', 'evening'),
    'END:VCALENDAR',
  ].join('\r\n');

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'inline; filename="speak-daily-reminders.ics"');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(body);
}
