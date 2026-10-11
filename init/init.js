// Sélectionne explicitement la base
db = db.getSiblingDB('trouve_ton_resto');

// Idempotent : crée la collection, ou met à jour son validateur si elle existe déjà.
// Ce script tourne au premier démarrage de Mongo, mais peut aussi être relancé à la main
// pour appliquer une évolution du schéma (voir README).
function ensureCollection(name, jsonSchema) {
  const validator = { $jsonSchema: jsonSchema };
  const exists = db.getCollectionNames().includes(name);
  if (exists) {
    db.runCommand({ collMod: name, validator: validator, validationLevel: "strict" });
  } else {
    db.createCollection(name, { validator: validator });
  }
}

const NUM = ["int", "double", "decimal"];
const SOCIAL = {
  bsonType: "object",
  properties: {
    facebook: { bsonType: "string" },
    instagram: { bsonType: "string" },
    twitter: { bsonType: "string" },
    tiktok: { bsonType: "string" },
    youtube: { bsonType: "string" },
    google_maps: { bsonType: "string" },
    tripadvisor: { bsonType: "string" }
  }
};
const HHMM = "^([01][0-9]|2[0-3]):[0-5][0-9]$";
const DAY_SLOTS = {
  bsonType: "array",
  items: {
    bsonType: "object",
    required: ["open", "close"],
    properties: {
      open: { bsonType: "string", pattern: HHMM },
      close: { bsonType: "string", pattern: HHMM }
    }
  }
};
const MEAL_TYPES = ["breakfast", "brunch", "lunch", "dinner", "snack", "late_night"];
const ROLES = ["user", "premium", "restaurateur", "admin"];

//CUISINES
ensureCollection("cuisines", {
  bsonType: "object",
  required: ["cuisine_name"],
  properties: {
    cuisine_name: { bsonType: "string" },
    description: { bsonType: "string" }
  }
});
db.cuisines.createIndex({ cuisine_name: 1 }, { unique: true });

//REVIEWS
ensureCollection("reviews", {
  bsonType: "object",
  required: ["rating", "resto", "user", "date"],
  properties: {
    rating: { bsonType: NUM },
    comment: { bsonType: "string" },
    resto: { bsonType: "objectId" },
    user: { bsonType: "objectId" },
    date: { bsonType: "date" }
  }
});
db.reviews.createIndex({ resto: 1, user: 1 }, { unique: true });
db.reviews.createIndex({ resto: 1, date: -1 });

//RATINGS : source de vérité des notes, une ligne par (resto, source)
ensureCollection("ratings", {
  bsonType: "object",
  required: ["value", "source", "resto", "date"],
  properties: {
    value: { bsonType: NUM },
    source: { bsonType: "string" }, // google, tripadvisor, inside, etc.
    date: { bsonType: "date" },
    resto: { bsonType: "objectId" },
    total_reviews: { bsonType: "int" }
  }
});
db.ratings.createIndex({ resto: 1, source: 1 }, { unique: true });

//OPEN HOURS : un document par resto, référencé par restos.open_hours
// weekly.<jour> = liste de créneaux [{ open: "12:00", close: "14:30" }] ([] = fermé ce jour-là)
ensureCollection("open_hours", {
  bsonType: "object",
  required: ["resto", "timezone", "weekly"],
  properties: {
    resto: { bsonType: "objectId" },
    timezone: { bsonType: "string" },
    weekly: {
      bsonType: "object",
      properties: {
        mon: DAY_SLOTS,
        tue: DAY_SLOTS,
        wed: DAY_SLOTS,
        thu: DAY_SLOTS,
        fri: DAY_SLOTS,
        sat: DAY_SLOTS,
        sun: DAY_SLOTS
      }
    },
    exceptions: {
      bsonType: "object",
      properties: {
        from: { bsonType: "string" }, // YYYY-MM-DD
        to: { bsonType: "string" }
      }
    },
    temporaryClosures: {
      bsonType: "object",
      properties: {
        from: { bsonType: "string" },
        to: { bsonType: "string" },
        reason: { bsonType: "string" }
      }
    }
  }
});
db.open_hours.createIndex({ resto: 1 }, { unique: true });

//RESTOS
ensureCollection("restos", {
  bsonType: "object",
  required: ["name", "location", "add_date", "created_at", "updated_at"],
  properties: {
    name: { bsonType: "string" },
    location: {
      bsonType: "object",
      required: ["street", "city", "state", "zip"],
      properties: {
        street: { bsonType: "string" },
        city: { bsonType: "string" },
        state: { bsonType: "string" },
        zip: { bsonType: "string" },
        country: { bsonType: "string" } // code ISO 3166-1 alpha-2 (FR, BE, ...)
      }
    },
    // Point GeoJSON [longitude, latitude] pour la carte et la recherche par proximité.
    // Optionnel : un resto ajouté à la main peut être géocodé plus tard.
    geo: {
      bsonType: "object",
      required: ["type", "coordinates"],
      properties: {
        type: { enum: ["Point"] },
        coordinates: {
          bsonType: "array",
          minItems: 2,
          maxItems: 2,
          items: { bsonType: ["double", "int"] }
        }
      }
    },
    cuisines: { bsonType: "array", items: { bsonType: "objectId" } },
    meal_types: { bsonType: "array", items: { enum: MEAL_TYPES } },
    price_range: { bsonType: "string" },
    add_date: { bsonType: "date" },
    // Résumé dénormalisé, recalculé à partir de la collection ratings
    rating: {
      bsonType: "object",
      properties: {
        google_rating: { bsonType: NUM },
        tripadvisor_rating: { bsonType: NUM },
        inside_rating: { bsonType: NUM }
      }
    },
    status: { bsonType: "string" }, // ouvert/fermé/etc.
    verified: { bsonType: "bool" }, // validé par un admin
    sponsored: { bsonType: "bool" },
    sponsored_until: { bsonType: "date" },
    open_hours: { bsonType: "objectId" },
    halal_certificate: { bsonType: "bool" },
    vegan: { bsonType: "bool" },
    added_by: { bsonType: "objectId" }, // user
    created_at: { bsonType: "date" },
    updated_at: { bsonType: "date" },
    social_networks: SOCIAL,
    phone_numbers: { bsonType: "array", items: { bsonType: "string" } },
    website: { bsonType: "string" },
    tags: { bsonType: "array", items: { bsonType: "string" } }
  }
});
db.restos.createIndex({ "location.city": 1 });
db.restos.createIndex({ tags: 1 });
db.restos.createIndex({ name: "text", tags: "text" });
db.restos.createIndex({ geo: "2dsphere" });
db.restos.createIndex({ cuisines: 1 });
db.restos.createIndex({ verified: 1, sponsored: 1 });

//PHOTOS
ensureCollection("photos", {
  bsonType: "object",
  required: ["resto", "user", "url", "created_at"],
  properties: {
    resto: { bsonType: "objectId" },
    user: { bsonType: "objectId" },
    url: { bsonType: "string" },
    caption: { bsonType: "string" },
    created_at: { bsonType: "date" }
  }
});
db.photos.createIndex({ resto: 1, created_at: -1 });

//LISTS : wishlist, eatenlist et listes personnalisées (éventuellement collaboratives)
ensureCollection("lists", {
  bsonType: "object",
  required: ["user", "name", "type", "created_at", "updated_at"],
  properties: {
    user: { bsonType: "objectId" }, // propriétaire
    name: { bsonType: "string" },
    type: { enum: ["wishlist", "eatenlist", "custom"] },
    restos: { bsonType: "array", items: { bsonType: "objectId" } },
    collaborators: { bsonType: "array", items: { bsonType: "objectId" } },
    is_public: { bsonType: "bool" },
    created_at: { bsonType: "date" },
    updated_at: { bsonType: "date" }
  }
});
db.lists.createIndex({ user: 1, name: 1 }, { unique: true });
db.lists.createIndex({ collaborators: 1 });

//NOTIFICATIONS
ensureCollection("notifications", {
  bsonType: "object",
  required: ["user", "type", "message", "read", "created_at"],
  properties: {
    user: { bsonType: "objectId" },
    type: { bsonType: "string" }, // new_badge, review_reply, list_invite, ...
    message: { bsonType: "string" },
    read: { bsonType: "bool" },
    data: { bsonType: "object" }, // ex. { resto: ObjectId(...) }
    created_at: { bsonType: "date" }
  }
});
db.notifications.createIndex({ user: 1, read: 1, created_at: -1 });

//BADGES : définitions des succès à débloquer (le déblocage est stocké dans users.badges)
ensureCollection("badges", {
  bsonType: "object",
  required: ["code", "name"],
  properties: {
    code: { bsonType: "string" },
    name: { bsonType: "string" },
    description: { bsonType: "string" },
    icon: { bsonType: "string" }
  }
});
db.badges.createIndex({ code: 1 }, { unique: true });

//SUBSCRIPTIONS
ensureCollection("subscriptions", {
  bsonType: "object",
  required: ["name", "price_per_month", "price_per_year"],
  properties: {
    name: { bsonType: "string" },
    avantages: { bsonType: "array", items: { bsonType: "string" } },
    price_per_month: { bsonType: NUM },
    price_per_year: { bsonType: NUM }
  }
});
db.subscriptions.createIndex({ name: 1 }, { unique: true });

//RANKS
ensureCollection("ranks", {
  bsonType: "object",
  required: ["name", "level"],
  properties: {
    name: { bsonType: "string" },
    level: { bsonType: "int" },
    icon: { bsonType: "string" },
    reward: { bsonType: "string" }
  }
});
db.ranks.createIndex({ name: 1 }, { unique: true });

//USERS
ensureCollection("users", {
  bsonType: "object",
  required: ["username", "mail", "password", "created_at", "updated_at"],
  properties: {
    username: { bsonType: "string" },
    mail: { bsonType: "string" },
    phone_number: { bsonType: "string" },
    address: {
      bsonType: "object",
      properties: {
        street: { bsonType: "string" },
        city: { bsonType: "string" },
        state: { bsonType: "string" },
        zip: { bsonType: "string" }
      }
    },
    password: { bsonType: "string" },
    role: { enum: ROLES }, // absent = "user"
    preferences: {
      bsonType: "object",
      properties: {
        cuisines: { bsonType: "array", items: { bsonType: "objectId" } },
        price_ranges: { bsonType: "array", items: { bsonType: "string" } },
        tags: { bsonType: "array", items: { bsonType: "string" } }
      }
    },
    subscription: { bsonType: "objectId" },
    rank: { bsonType: "objectId" },
    restos: { bsonType: "array", items: { bsonType: "objectId" } }, // restos possédés (restaurateur)
    badges: {
      bsonType: "array",
      items: {
        bsonType: "object",
        required: ["badge", "unlocked_at"],
        properties: {
          badge: { bsonType: "objectId" },
          unlocked_at: { bsonType: "date" }
        }
      }
    },
    exp_points: { bsonType: "int" },
    level: { bsonType: "int" },
    social_networks: SOCIAL,
    created_at: { bsonType: "date" },
    updated_at: { bsonType: "date" }
  }
});
db.users.createIndex({ username: 1 }, { unique: true });
db.users.createIndex({ mail: 1 }, { unique: true });

print("✅ Init OK: toutes les collections créées/mises à jour avec schémas et index.");
