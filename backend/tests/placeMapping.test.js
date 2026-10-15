const { normalize, timezoneFor, fromCategories, socialLinks, cleanWebsites, cleanPhones, parseOpeningHours, fromOsmTags } = require('../src/services/placeMapping');

describe('normalize', () => {
  it('removes accents, case and punctuation', () => {
    expect(normalize("Café de l'Été – Paris 1er")).toBe('cafe de l ete paris 1er');
    expect(normalize('  CHEZ   Marcel ')).toBe('chez marcel');
    expect(normalize(null)).toBe('');
  });
});

describe('timezoneFor', () => {
  it('knows the main countries and returns null otherwise', () => {
    expect(timezoneFor('fr')).toBe('Europe/Paris');
    expect(timezoneFor('BE')).toBe('Europe/Brussels');
    expect(timezoneFor('JP')).toBeNull();
    expect(timezoneFor(undefined)).toBeNull();
  });
});

describe('fromCategories', () => {
  it('maps Overture categories to cuisines and tags', () => {
    const r = fromCategories(['japanese_restaurant', 'restaurant', 'asian_restaurant', 'ramen_restaurant']);
    expect(r.cuisines).toEqual(['Japonaise']);
    expect(r.tags).toEqual(expect.arrayContaining(['ramen']));
    expect(r.vegan).toBe(false);
  });

  it('maps OpenStreetMap cuisine values (several at once)', () => {
    const r = fromCategories('french;pizza;steak_house'.split(';'));
    expect(r.cuisines).toEqual(expect.arrayContaining(['Française', 'Italienne', 'Américaine']));
    expect(r.tags).toEqual(expect.arrayContaining(['pizza', 'grillades']));
  });

  it('detects vegan and vegetarian places', () => {
    expect(fromCategories(['vegan_restaurant'])).toMatchObject({ cuisines: ['Végétarienne'], vegan: true });
    expect(fromCategories(['vegetarian_restaurant'])).toMatchObject({ cuisines: ['Végétarienne'], vegan: true }); // une option végé suffit à la règle de l'appli
    expect(fromCategories(['halal_restaurant'])).toMatchObject({ halal: true, tags: ['halal'] });
    expect(fromCategories(['french_restaurant'])).toMatchObject({ vegan: false, halal: false });
  });

  it('does not match words inside other words', () => {
    expect(fromCategories(['barbershop', 'pizzaiolo']).tags).toEqual([]);
    expect(fromCategories(['cafe']).tags).toEqual(['café']);
    expect(fromCategories(['casual_eatery', 'fast_food_restaurant']).tags).toContain('fast-food');
    expect(fromCategories([]).cuisines).toEqual([]);
    expect(fromCategories(undefined).tags).toEqual([]);
  });
});

describe('socialLinks', () => {
  it('sorts links by network and keeps the first of each', () => {
    const r = socialLinks([
      'https://www.facebook.com/chezmarcel',
      'http://instagram.com/chez_marcel/',
      'https://fb.com/autre',
      'https://x.com/marcel',
      'https://www.tiktok.com/@marcel',
      'https://www.tripadvisor.fr/Restaurant_Review-g187147',
    ]);
    expect(r).toEqual({
      facebook: 'https://www.facebook.com/chezmarcel',
      instagram: 'http://instagram.com/chez_marcel/',
      twitter: 'https://x.com/marcel',
      tiktok: 'https://www.tiktok.com/@marcel',
      tripadvisor: 'https://www.tripadvisor.fr/Restaurant_Review-g187147',
    });
  });

  it('ignores anything that is not a clean http(s) link to a known network', () => {
    expect(socialLinks(['javascript:alert(1)', 'ftp://facebook.com/x', '@marcel', 'monsite.fr', '', null, 'https://notfacebook.com/x'])).toEqual({});
  });
});

describe('cleanWebsites and cleanPhones', () => {
  it('keeps real websites, drops social networks and junk, adds https when missing', () => {
    expect(cleanWebsites(['https://chez-marcel.fr/', 'chez-marcel.fr', 'https://facebook.com/marcel', 'javascript:alert(1)', 'x'.repeat(400), 'pas un site', null])).toEqual(['https://chez-marcel.fr/']);
  });

  it('keeps plausible phone numbers only', () => {
    expect(cleanPhones(['+33 1 42 72 02 00', ' 01  42 72 02 00 ', 'abc', '123', '9'.repeat(31), null, '+33 1 42 72 02 00'])).toEqual(['+33 1 42 72 02 00', '01 42 72 02 00']);
  });
});

describe('parseOpeningHours', () => {
  const slots = (h, day) => h.weekly[day];

  it('reads days, ranges and several slots', () => {
    const h = parseOpeningHours('Mo-Fr 12:00-14:30,19:00-22:30; Sa 19:00-23:00; Su off');
    expect(slots(h, 'mon')).toEqual([{ open: '12:00', close: '14:30' }, { open: '19:00', close: '22:30' }]);
    expect(slots(h, 'fri')).toHaveLength(2);
    expect(slots(h, 'sat')).toEqual([{ open: '19:00', close: '23:00' }]);
    expect(slots(h, 'sun')).toEqual([]);
  });

  it('supports lists of days, a bare time range and wrapping ranges', () => {
    expect(slots(parseOpeningHours('Mo,We,Fr 10:00-18:00'), 'wed')).toEqual([{ open: '10:00', close: '18:00' }]);
    expect(slots(parseOpeningHours('Mo,We,Fr 10:00-18:00'), 'tue')).toEqual([]);
    expect(slots(parseOpeningHours('11:00-23:00'), 'sun')).toEqual([{ open: '11:00', close: '23:00' }]);
    expect(slots(parseOpeningHours('Fr-Mo 18:00-02:00'), 'sun')).toEqual([{ open: '18:00', close: '02:00' }]);
    expect(slots(parseOpeningHours('Fr-Mo 18:00-02:00'), 'wed')).toEqual([]);
  });

  it('handles 24/7 and 24:00', () => {
    expect(slots(parseOpeningHours('24/7'), 'sat')).toEqual([{ open: '00:00', close: '00:00' }]);
    expect(slots(parseOpeningHours('Mo-Su 08:00-24:00'), 'mon')).toEqual([{ open: '08:00', close: '00:00' }]);
  });

  it('lets a later rule override an earlier one, as OpenStreetMap does', () => {
    const h = parseOpeningHours('Mo-Su 10:00-20:00; Mo off');
    expect(slots(h, 'mon')).toEqual([]);
    expect(slots(h, 'tue')).toEqual([{ open: '10:00', close: '20:00' }]);
  });

  it('ignores public and school holidays rules', () => {
    const h = parseOpeningHours('Mo-Sa 12:00-14:30; PH off; SH off');
    expect(slots(h, 'mon')).toEqual([{ open: '12:00', close: '14:30' }]);
    expect(parseOpeningHours('PH off')).toBeNull();
  });

  it('returns null rather than guessing for anything complex or invalid', () => {
    for (const text of ['Mo-Fr sunrise-sunset', 'week 1-4 Mo 10:00-12:00', 'Jan-Mar Mo 10:00-12:00', 'Mo-Fr 10:00-12:00+', 'Mo-Fr 10:00-25:00', 'Mo-Xx 10:00-12:00', 'by appointment', '', null, 'Mo 12:00-14:00 "sur rendez-vous"', 'Mo-Fr 12:61-14:00']) {
      expect(parseOpeningHours(text)).toBeNull();
    }
  });
});

describe('fromOsmTags', () => {
  const tags = {
    cuisine: 'french;pizza',
    phone: '+33 1 40 46 79 00',
    website: 'www.procope.com',
    'contact:instagram': 'https://www.instagram.com/procope',
    'contact:facebook': '@procope',
    email: 'contact@procope.com',
    opening_hours: 'Mo-Su 11:30-24:00',
    outdoor_seating: 'yes',
    takeaway: 'only',
    wheelchair: 'yes',
    internet_access: 'wlan',
    'diet:vegetarian': 'yes',
    'diet:vegan': 'no',
    'diet:halal': 'yes',
  };

  it('extracts everything useful for the form', () => {
    const r = fromOsmTags(tags, 'FR');
    expect(r.phones).toEqual(['+33 1 40 46 79 00']);
    expect(r.websites).toEqual(['https://www.procope.com/']);
    expect(r.socials).toEqual({ instagram: 'https://www.instagram.com/procope' });
    expect(r.emails).toEqual(['contact@procope.com']);
    expect(r.cuisines).toEqual(expect.arrayContaining(['Française', 'Italienne']));
    expect(r.tags).toEqual(expect.arrayContaining(['pizza', 'terrasse', 'à emporter', 'accessible PMR', 'wifi', 'végétarien']));
    expect(r.vegan).toBe(true); // diet:vegetarian=yes
    expect(r.halal).toBe(true);
    expect(r.hours).toMatchObject({ timezone: 'Europe/Paris', text: 'Mo-Su 11:30-24:00' });
    expect(r.hours.weekly.thu).toEqual([{ open: '11:30', close: '00:00' }]);
  });

  it('copes with empty or hostile tags', () => {
    expect(fromOsmTags(undefined, 'FR')).toMatchObject({ phones: [], websites: [], emails: [], cuisines: [], tags: [], vegan: false, halal: false, hours: null });
    const r = fromOsmTags({ phone: 'x', website: 'javascript:alert(1)', email: 'pas un mail', opening_hours: 'n importe quoi', 'contact:instagram': 'javascript:alert(1)' }, 'FR');
    expect(r).toMatchObject({ phones: [], websites: [], emails: [], socials: {}, hours: null });
  });
});
