// Données de départ pour le développement. Idempotent : peut être relancé sans créer de doublons.
// ⚠️ Noms de restos, coordonnées et prix des abonnements sont des valeurs d'exemple.
db = db.getSiblingDB('trouve_ton_resto');

const now = new Date();

//CUISINES
const cuisineNames = [
  ["Française", "Bistrots, brasseries et cuisine traditionnelle"],
  ["Italienne", "Pizzas, pâtes et antipasti"],
  ["Japonaise", "Sushis, ramens et izakayas"],
  ["Libanaise", "Mezzés, grillades et falafels"],
  ["Indienne", "Currys, tandoori et street food"],
  ["Burger", "Burgers et fast-food"],
  ["Végétarienne", "Cuisine végétarienne et vegan"],
  ["Orientale", "Cuisine du Moyen-Orient"],
  ["Chinoise", "Cuisine chinoise, dim sum et wok"],
  ["Thaïlandaise", "Cuisine thaïlandaise"],
  ["Vietnamienne", "Cuisine vietnamienne, pho et bo bun"],
  ["Coréenne", "Cuisine coréenne et barbecue coréen"],
  ["Mexicaine", "Tacos, burritos et cuisine tex-mex"],
  ["Marocaine", "Couscous, tajines et cuisine du Maghreb"],
  ["Turque", "Kebabs, grillades et cuisine turque"],
  ["Grecque", "Cuisine grecque"],
  ["Espagnole", "Tapas et cuisine espagnole"],
  ["Africaine", "Cuisine d'Afrique de l'Ouest, du Centre et de l'Est"],
  ["Américaine", "Grillades, steakhouses et barbecue"],
  ["Fruits de mer", "Poissons, huîtres et fruits de mer"],
  ["Crêperie", "Crêpes et galettes"],
  ["Méditerranéenne", "Cuisine méditerranéenne"]
];
const cuisineId = {};
cuisineNames.forEach(([cuisine_name, description]) => {
  db.cuisines.updateOne({ cuisine_name }, { $set: { description }, $setOnInsert: { cuisine_name } }, { upsert: true });
  cuisineId[cuisine_name] = db.cuisines.findOne({ cuisine_name })._id;
});

//RANKS
[
  ["Curieux", 1, "🍽️", "Accès aux listes personnalisées"],
  ["Gourmet", 2, "🥐", "Badge Gourmet sur le profil"],
  ["Fin gourmet", 3, "🍷", "Avis mis en avant"],
  ["Chef", 4, "👨‍🍳", "Thème exclusif"]
].forEach(([name, level, icon, reward]) => {
  db.ranks.updateOne({ name }, { $set: { level: NumberInt(level), icon, reward } }, { upsert: true });
});

//SUBSCRIPTIONS (prix provisoires)
[
  ["Premium", ["Avis remontés plus vite", "Thèmes et personnalisation du profil"], 3.99, 39.9],
  ["Restaurateur Pro", ["Boost du restaurant", "Statistiques détaillées", "Messagerie avec les clients"], 29.9, 299]
].forEach(([name, avantages, price_per_month, price_per_year]) => {
  db.subscriptions.updateOne({ name }, { $set: { avantages, price_per_month, price_per_year } }, { upsert: true });
});

//BADGES
[
  ["first_resto", "Premier resto", "A ajouté son premier restaurant", "📍"],
  ["first_review", "Premier avis", "A publié son premier avis", "✍️"],
  ["first_photo", "Premier cliché", "A ajouté sa première photo", "📸"]
].forEach(([code, name, description, icon]) => {
  db.badges.updateOne({ code }, { $set: { name, description, icon } }, { upsert: true });
});

//RESTOS d'exemple (coordonnées GeoJSON : [longitude, latitude])
const weekdays = [{ open: "12:00", close: "14:30" }, { open: "19:00", close: "22:30" }];
const template = { mon: [], tue: weekdays, wed: weekdays, thu: weekdays, fri: weekdays, sat: weekdays, sun: [] };

[
  {
    name: "Le Bistrot d'Exemple",
    street: "12 rue de Rivoli", zip: "75001", coords: [2.3412, 48.8606],
    cuisines: ["Française"], price: "€€", tags: ["terrasse", "bistrot"], meals: ["lunch", "dinner"], verified: true, sponsored: false
  },
  {
    name: "Pizzeria Test",
    street: "5 rue Oberkampf", zip: "75011", coords: [2.3790, 48.8650],
    cuisines: ["Italienne"], price: "€", tags: ["pizza", "à emporter"], meals: ["lunch", "dinner"], verified: true, sponsored: true
  },
  {
    name: "Sushi Démo",
    street: "30 rue Sainte-Anne", zip: "75002", coords: [2.3350, 48.8660],
    cuisines: ["Japonaise"], price: "€€€", tags: ["sushi", "ramen"], meals: ["dinner"], verified: false, sponsored: false
  },
  {
    name: "Mezzé Exemple",
    street: "8 rue Mouffetard", zip: "75005", coords: [2.3500, 48.8420],
    cuisines: ["Libanaise", "Végétarienne"], price: "€€", tags: ["mezzé", "végétarien"], meals: ["lunch", "dinner"], verified: true, sponsored: false
  }
].forEach((r) => {
  db.restos.updateOne(
    { name: r.name },
    {
      $set: {
        location: { street: r.street, city: "Paris", state: "Île-de-France", zip: r.zip, country: "FR" },
        geo: { type: "Point", coordinates: r.coords },
        cuisines: r.cuisines.map((c) => cuisineId[c]),
        meal_types: r.meals,
        price_range: r.price,
        tags: r.tags,
        verified: r.verified,
        sponsored: r.sponsored,
        vegan: r.cuisines.includes("Végétarienne"),
        halal_certificate: false,
        status: "open",
        updated_at: now
      },
      $setOnInsert: { name: r.name, add_date: now, created_at: now }
    },
    { upsert: true }
  );
  const resto = db.restos.findOne({ name: r.name });
  db.open_hours.updateOne(
    { resto: resto._id },
    { $set: { timezone: "Europe/Paris", weekly: template }, $setOnInsert: { resto: resto._id } },
    { upsert: true }
  );
  db.restos.updateOne({ _id: resto._id }, { $set: { open_hours: db.open_hours.findOne({ resto: resto._id })._id } });
});

print("✅ Seed OK: cuisines, ranks, abonnements, badges et restos d'exemple.");
