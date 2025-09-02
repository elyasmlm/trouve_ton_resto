// Sélectionne explicitement la base
db = db.getSiblingDB('trouve_ton_resto');

//CUISINES
db.createCollection("cuisines", {
  validator: { $jsonSchema: {
    bsonType: "object",
    required: ["cuisine_name"],
    properties: {
      cuisine_name: { bsonType: "string" },
      description: { bsonType: "string" }
    }
  }}
});
db.cuisines.createIndex({ cuisine_name: 1 }, { unique: true });

//REVIEWS
db.createCollection("reviews", {
  validator: { $jsonSchema: {
    bsonType: "object",
    required: ["rating","resto","user","date"],
    properties: {
      rating: { bsonType: ["int","double","decimal"] },
      comment: { bsonType: "string" },
      resto: { bsonType: "objectId" },
      user: { bsonType: "objectId" },
      date: { bsonType: "date" }
    }
  }}
});
db.reviews.createIndex({ resto: 1, user: 1 }, { unique: true });
db.reviews.createIndex({ resto: 1, date: -1 });

//RATINGS
db.createCollection("ratings", {
  validator: { $jsonSchema: {
    bsonType: "object",
    required: ["value","source","resto","date"],
    properties: {
      value: { bsonType: ["int","double","decimal"] },
      source: { bsonType: "string" }, // google, tripadvisor, inside, etc.
      date: { bsonType: "date" },
      resto: { bsonType: "objectId" },
      total_reviews: { bsonType: "int" }
    }
  }}
});
db.ratings.createIndex({ resto: 1, source: 1 }, { unique: true });

//OPEN HOURS
db.createCollection("open_hours", {
  validator: { $jsonSchema: {
    bsonType: "object",
    required: ["resto","timezone","weekly"],
    properties: {
      resto: { bsonType: "objectId" },
      timezone: { bsonType: "string" },
      weekly: {
        bsonType: "object",
        properties: {
          mon: { bsonType: "array" },
          tue: { bsonType: "array" },
          wed: { bsonType: "array" },
          thu: { bsonType: "array" },
          fri: { bsonType: "array" },
          sat: { bsonType: "array" },
          sun: { bsonType: "array" }
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
  }}
});
db.open_hours.createIndex({ resto: 1 }, { unique: true });

//RESTOS
db.createCollection("restos", {
  validator: { $jsonSchema: {
    bsonType: "object",
    required: ["name","location","add_date","created_at","updated_at"],
    properties: {
      name: { bsonType: "string" },
      location: {
        bsonType: "object",
        required: ["street","city","state","zip"],
        properties: {
          street: { bsonType: "string" },
          city: { bsonType: "string" },
          state: { bsonType: "string" },
          zip: { bsonType: "string" }
        }
      },
      price_range: { bsonType: "string" },
      add_date: { bsonType: "date" },
      rating: {
        bsonType: "object",
        properties: {
          google_rating: { bsonType: ["int","double","decimal"] },
          tripadvisor_rating: { bsonType: ["int","double","decimal"] },
          inside_rating: { bsonType: ["int","double","decimal"] }
        }
      },
      status: { bsonType: "string" }, // ouvert/fermé/etc.
      open_hours: { bsonType: "objectId" },
      halal_certificate: { bsonType: "bool" },
      vegan: { bsonType: "bool" },
      added_by: { bsonType: "objectId" }, // user
      created_at: { bsonType: "date" },
      updated_at: { bsonType: "date" },
      social_networks: {
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
      },
      phone_numbers: { bsonType: "array", items: { bsonType: "string" } },
      website: { bsonType: "string" },
      tags: { bsonType: "array", items: { bsonType: "string" } }
    }
  }}
});
db.restos.createIndex({ "location.city": 1 });
db.restos.createIndex({ tags: 1 });
db.restos.createIndex({ name: "text", tags: "text" });

//SUBSCRIPTIONS
db.createCollection("subscriptions", {
  validator: { $jsonSchema: {
    bsonType: "object",
    required: ["name","price_per_month","price_per_year"],
    properties: {
      name: { bsonType: "string" },
      avantages: { bsonType: "array", items: { bsonType: "string" } },
      price_per_month: { bsonType: ["double","int","decimal"] },
      price_per_year: { bsonType: ["double","int","decimal"] }
    }
  }}
});
db.subscriptions.createIndex({ name: 1 }, { unique: true });

//RANKS
db.createCollection("ranks", {
  validator: { $jsonSchema: {
    bsonType: "object",
    required: ["name","level"],
    properties: {
      name: { bsonType: "string" },
      level: { bsonType: "int" },
      icon: { bsonType: "string" },
      reward: { bsonType: "string" }
    }
  }}
});
db.ranks.createIndex({ name: 1 }, { unique: true });

//USERS
db.createCollection("users", {
  validator: { $jsonSchema: {
    bsonType: "object",
    required: ["username","mail","password","created_at","updated_at"],
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
      restos: { bsonType: "array", items: { bsonType: "objectId" } },
      exp_points: { bsonType: "int" },
      level: { bsonType: "int" },
      social_networks: {
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
      },
      created_at: { bsonType: "date" },
      updated_at: { bsonType: "date" }
    }
  }}
});
db.users.createIndex({ username: 1 }, { unique: true });
db.users.createIndex({ mail: 1 }, { unique: true });

print("✅ Init OK: toutes les collections créées avec schémas et index.");
