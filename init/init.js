// Sélectionne explicitement la base
db = db.getSiblingDB('trouve_ton_resto');

// === TYPES CUISINE ===
db.createCollection("types_cuisine", {
  validator: { $jsonSchema: {
    bsonType: "object",
    required: ["nom"],
    properties: {
      nom: { bsonType: "string" },
      description: { bsonType: "string" }
    }
  }}
});
db.types_cuisine.createIndex({ nom: 1 }, { unique: true });

// === ABONNEMENTS ===
db.createCollection("abonnements", {
  validator: { $jsonSchema: {
    bsonType: "object",
    required: ["nom","prix"],
    properties: {
      nom: { bsonType: "string" },
      avantages: { bsonType: "array", items: { bsonType: "string" } },
      prix: { bsonType: ["double","int","decimal"] }
    }
  }}
});
db.abonnements.createIndex({ nom: 1 }, { unique: true });

// === GRADES ===
db.createCollection("grades", {
  validator: { $jsonSchema: {
    bsonType: "object",
    required: ["nom"],
    properties: {
      nom: { bsonType: "string" },
      rang: { bsonType: "int" },
      icone: { bsonType: "string" },
      recompense: { bsonType: "string" }
    }
  }}
});
db.grades.createIndex({ nom: 1 }, { unique: true });

// === USERS ===
db.createCollection("users", {
  validator: { $jsonSchema: {
    bsonType: "object",
    required: ["username","email"],
    properties: {
      username: { bsonType: "string" },
      email: { bsonType: "string" },
      adresse: { bsonType: "string" },
      localisation: {
        bsonType: "object",
        properties: {
          type: { enum: ["Point"] },
          coordinates: {
            bsonType: "array",
            items: [{ bsonType: "double" }, { bsonType: "double" }],
            description: "[lng, lat]"
          }
        }
      },
      abonnement: { bsonType: "objectId" },
      badges: { bsonType: "array", items: { bsonType: "objectId" } },
      favoris: { bsonType: "array", items: { bsonType: "objectId" } },
      reseauxSociaux: { bsonType: "object" }
    }
  }}
});
db.users.createIndex({ username: 1 }, { unique: true });
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ localisation: "2dsphere" });

// === RESTAURANTS ===
db.createCollection("restaurants", {
  validator: { $jsonSchema: {
    bsonType: "object",
    required: ["nom"],
    properties: {
      nom: { bsonType: "string" },
      adresse: {
        bsonType: "object",
        properties: {
          rue: { bsonType: "string" },
          ville: { bsonType: "string" },
          cp: { bsonType: "string" }
        }
      },
      localisation: {
        bsonType: "object",
        properties: {
          type: { enum: ["Point"] },
          coordinates: { bsonType: "array", items: [{bsonType:"double"},{bsonType:"double"}] }
        }
      },
      typeCuisine: { bsonType: "objectId" },
      commandesDisponibles: { bsonType: "array", items: { bsonType: "string" } },
      photos: { bsonType: "array", items: { bsonType: "string" } },
      videos: { bsonType: "array", items: { bsonType: "string" } },
      noteGlobale: { bsonType: ["double","int","decimal"] },
      notePrix: { bsonType: ["double","int","decimal"] },
      noteService: { bsonType: ["double","int","decimal"] },
      horairesOuverture: { bsonType: "object" },
      moyensPaiement: { bsonType: "array", items: { bsonType: "string" } },
      siteWeb: { bsonType: "string" },
      googleMaps: { bsonType: "string" },
      reseauxSociaux: { bsonType: "object" },
      tags: { bsonType: "array", items: { bsonType: "string" } }
    }
  }}
});
db.restaurants.createIndex({ "adresse.ville": 1 });
db.restaurants.createIndex({ typeCuisine: 1 });
db.restaurants.createIndex({ tags: 1 });
db.restaurants.createIndex({ localisation: "2dsphere" });

// === AVIS ===
db.createCollection("avis", {
  validator: { $jsonSchema: {
    bsonType: "object",
    required: ["note","auteur","restaurant","date"],
    properties: {
      note: { bsonType: ["int","double","decimal"] },
      description: { bsonType: "string" },
      auteur: { bsonType: "objectId" },
      restaurant: { bsonType: "objectId" },
      date: { bsonType: "date" }
    }
  }}
});
db.avis.createIndex({ auteur: 1, restaurant: 1 }, { unique: true });
db.avis.createIndex({ restaurant: 1, date: -1 });

// === NOTES (optionnel) ===
db.createCollection("notes", {
  validator: { $jsonSchema: {
    bsonType: "object",
    required: ["critere","note","restaurant","utilisateur"],
    properties: {
      source: { bsonType: "string" },
      critere: { bsonType: "string" },
      note: { bsonType: ["int","double","decimal"] },
      restaurant: { bsonType: "objectId" },
      utilisateur: { bsonType: "objectId" }
    }
  }}
});
db.notes.createIndex({ utilisateur: 1, restaurant: 1, critere: 1 }, { unique: true });

print("✅ Init OK: base et index créés.");
