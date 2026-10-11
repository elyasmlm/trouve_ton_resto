const mongoose = require('mongoose');

const HHMM = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

const slot = new mongoose.Schema(
  {
    open: { type: String, required: true, match: HHMM },
    close: { type: String, required: true, match: HHMM },
  },
  { _id: false }
);

function isValidTimeZone(tz) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// weekly.<jour> = liste de créneaux [{ open: '12:00', close: '14:30' }] ([] = fermé)
const openHoursSchema = new mongoose.Schema(
  {
    resto: { type: mongoose.Schema.Types.ObjectId, ref: 'Resto', required: true, unique: true },
    timezone: { type: String, required: true, validate: [isValidTimeZone, 'invalid timezone'] },
    weekly: {
      mon: [slot],
      tue: [slot],
      wed: [slot],
      thu: [slot],
      fri: [slot],
      sat: [slot],
      sun: [slot],
    },
    exceptions: { from: String, to: String }, // YYYY-MM-DD
    temporaryClosures: { from: String, to: String, reason: String }, // YYYY-MM-DD
  },
  { collection: 'open_hours' }
);

module.exports = mongoose.model('OpenHours', openHoursSchema);