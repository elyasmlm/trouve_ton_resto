const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const SHORT = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function localParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type).value;
  return {
    day: SHORT.indexOf(get('weekday').toLowerCase().slice(0, 3)),
    minutes: (Number(get('hour')) % 24) * 60 + Number(get('minute')),
    dateStr: `${get('year')}-${get('month')}-${get('day')}`,
  };
}

const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/**
 * Le resto est-il ouvert à `date` ?
 * @returns {boolean|null} null si on n'a pas d'horaires exploitables
 * Un créneau dont la fermeture est avant l'ouverture (ex. 18:00-02:00) déborde sur le lendemain.
 * Les fermetures temporaires (from/to inclus, YYYY-MM-DD, dans le fuseau du resto) l'emportent.
 */
function isOpenAt(hours, date = new Date()) {
  if (!hours || !hours.weekly) return null;
  let p;
  try {
    p = localParts(date, hours.timezone || 'UTC');
  } catch {
    return null;
  }

  for (const c of [].concat(hours.temporaryClosures || [])) {
    if (c && c.from && c.to && p.dateStr >= c.from && p.dateStr <= c.to) return false;
  }

  for (const s of hours.weekly[DAYS[p.day]] || []) {
    const open = toMinutes(s.open);
    const close = toMinutes(s.close);
    if (close === open) return true; // 24h/24
    if (close > open ? p.minutes >= open && p.minutes < close : p.minutes >= open) return true;
  }
  for (const s of hours.weekly[DAYS[(p.day + 6) % 7]] || []) {
    const open = toMinutes(s.open);
    const close = toMinutes(s.close);
    if (close < open && p.minutes < close) return true;
  }
  return false;
}

module.exports = { isOpenAt };