const { toPlaceDoc } = require('../src/services/placeImport');

const row = (o = {}) => ({
  id: 'abc123', name: ' Café de l\'Été ', kind: 'restaurant', category: 'japanese_restaurant',
  hierarchy: ['food_and_drink', 'restaurant', 'asian_restaurant', 'japanese_restaurant'], alternates: ['sushi_restaurant'], confidence: 0.83,
  websites: ['http://www.cafe.fr', 'https://www.instagram.com/cafe'], emails: ['contact@cafe.fr', 'pas un mail'], socials: ['https://www.facebook.com/cafe', 'javascript:alert(1)'],
  phones: ['+33142720200', 'abc'], street: ' 12 rue de Rivoli ', city: 'Paris', zip: '75001', region: 'Île-de-France', country: 'fr',
  lng: 2.3412, lat: 48.8606, datasets: ['meta', 'Foursquare', 'meta'], brand: 'Cafe', ...o,
});

describe('toPlaceDoc', () => {
  it('builds a clean, searchable document', () => {
    const doc = toPlaceDoc(row(), '2026-09-23.1');
    expect(doc).toMatchObject({
      _id: 'abc123', name: "Café de l'Été", name_norm: 'cafe de l ete', street: '12 rue de Rivoli', city: 'Paris', city_norm: 'paris', zip: '75001',
      region: 'Île-de-France', country: 'FR', confidence: 0.83, release: '2026-09-23.1', brand: 'Cafe',
      geo: { type: 'Point', coordinates: [2.3412, 48.8606] },
      cuisines: ['Japonaise'], vegan: false,
    });
    expect(doc.tags).toEqual(expect.arrayContaining(['sushi']));
  });

  it('keeps only valid contacts and sorts social links out of the websites', () => {
    const doc = toPlaceDoc(row());
    expect(doc.phones).toEqual(['+33142720200']);
    expect(doc.emails).toEqual(['contact@cafe.fr']);
    expect(doc.websites).toEqual(['http://www.cafe.fr/']);
    expect(doc.socials).toEqual({ facebook: 'https://www.facebook.com/cafe', instagram: 'https://www.instagram.com/cafe' });
  });

  it('names the data sources readably, without duplicates', () => {
    expect(toPlaceDoc(row()).datasets).toEqual(['Meta', 'Foursquare']);
  });

  it('refuses rows it cannot use', () => {
    expect(toPlaceDoc(row({ name: '  ' }))).toBeNull();
    expect(toPlaceDoc(row({ name: null }))).toBeNull();
    expect(toPlaceDoc(row({ id: null }))).toBeNull();
    expect(toPlaceDoc(row({ lat: null }))).toBeNull();
    expect(toPlaceDoc(row({ lng: 'x' }))).toBeNull();
  });

  it('tolerates missing optional parts', () => {
    const doc = toPlaceDoc(row({ websites: null, emails: null, socials: null, phones: null, hierarchy: null, alternates: null, street: null, city: null, zip: null, region: null, datasets: null, brand: null, confidence: null }));
    expect(doc).toMatchObject({ phones: [], websites: [], emails: [], socials: {}, datasets: [] });
    expect(doc.city_norm).toBeUndefined();
  });
});
