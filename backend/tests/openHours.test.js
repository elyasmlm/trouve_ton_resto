const { isOpenAt } = require('../src/utils/openHours');

const lunchDinner = [{ open: '12:00', close: '14:30' }, { open: '19:00', close: '22:30' }];
const hours = {
  timezone: 'Europe/Paris',
  weekly: { mon: [], tue: lunchDinner, wed: lunchDinner, thu: lunchDinner, fri: lunchDinner, sat: lunchDinner, sun: [] },
};

describe('isOpenAt', () => {
  it('is open inside a slot, in the restaurant timezone', () => {
    // mardi 13 oct 2026, 11:30 UTC = 13:30 à Paris (UTC+2)
    expect(isOpenAt(hours, new Date('2026-10-13T11:30:00Z'))).toBe(true);
  });

  it('is closed between slots and on closed days', () => {
    expect(isOpenAt(hours, new Date('2026-10-13T15:30:00Z'))).toBe(false); // 17:30 à Paris
    expect(isOpenAt(hours, new Date('2026-10-12T11:30:00Z'))).toBe(false); // lundi
  });

  it('uses the local day, not the UTC day', () => {
    // mardi 22:00 UTC = mercredi 00:00 à Paris : fermé (créneau du soir fini à 22:30 le mardi)
    expect(isOpenAt(hours, new Date('2026-10-13T22:30:00Z'))).toBe(false);
  });

  it('handles slots running past midnight', () => {
    const bar = { timezone: 'UTC', weekly: { fri: [{ open: '18:00', close: '02:00' }], sat: [] } };
    expect(isOpenAt(bar, new Date('2026-10-16T23:00:00Z'))).toBe(true); // vendredi 23:00
    expect(isOpenAt(bar, new Date('2026-10-17T01:00:00Z'))).toBe(true); // samedi 01:00 (créneau de vendredi)
    expect(isOpenAt(bar, new Date('2026-10-17T03:00:00Z'))).toBe(false);
  });

  it('is closed during a temporary closure', () => {
    const closed = { ...hours, temporaryClosures: { from: '2026-10-10', to: '2026-10-20', reason: 'travaux' } };
    expect(isOpenAt(closed, new Date('2026-10-13T11:30:00Z'))).toBe(false);
  });

  it('returns null without usable hours', () => {
    expect(isOpenAt(null)).toBeNull();
    expect(isOpenAt({ timezone: 'Mars/Olympus', weekly: {} })).toBeNull();
  });
});