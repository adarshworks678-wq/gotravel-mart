'use strict';
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data.db');
const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL;');

db.exec(`
CREATE TABLE IF NOT EXISTS packages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  place       TEXT,
  category    TEXT NOT NULL DEFAULT 'international',   -- domestic | international
  price_inr   INTEGER NOT NULL DEFAULT 0,
  strike_inr  INTEGER,
  image       TEXT,                                    -- gradient class (bg-bali) OR image URL
  duration    TEXT,
  rating      TEXT,
  tag         TEXT,
  features    TEXT,                                    -- JSON array of strings
  description TEXT,
  active      INTEGER NOT NULL DEFAULT 1,
  sort        INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS enquiries (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ref         TEXT UNIQUE NOT NULL,
  name        TEXT, phone TEXT, email TEXT, city TEXT,
  package_id  INTEGER, package_name TEXT, place TEXT, price_inr INTEGER,
  travel_date TEXT, travellers TEXT, budget TEXT, source TEXT, message TEXT,
  status      TEXT DEFAULT 'New',
  crm_status  TEXT DEFAULT 'pending',                  -- pending | synced | failed
  crm_detail  TEXT,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS appointments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  enquiry_id  INTEGER NOT NULL,
  requested   INTEGER DEFAULT 0,
  date        TEXT, slot TEXT, mode TEXT,
  status      TEXT DEFAULT 'scheduled',
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  enquiry_id  INTEGER,
  phone       TEXT,
  type        TEXT,                                    -- confirmation | reminder
  send_at     TEXT NOT NULL,
  status      TEXT DEFAULT 'queued',                   -- queued | sent | failed
  detail      TEXT,
  created_at  TEXT NOT NULL,
  sent_at     TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  token       TEXT PRIMARY KEY,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bookings (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ref           TEXT UNIQUE NOT NULL,
  type          TEXT NOT NULL,                       -- flight | hotel
  name          TEXT, phone TEXT, email TEXT,
  summary       TEXT,                                -- human-readable (route / hotel name)
  details       TEXT,                                -- JSON snapshot of the offer + travellers
  amount_inr    INTEGER,
  provider_ref  TEXT,                                -- PNR / confirmation number
  provider_mode TEXT,                                -- live | demo
  pay_order_id  TEXT,
  pay_id        TEXT,
  pay_status    TEXT DEFAULT 'created',              -- created | paid | failed
  pay_mode      TEXT,                                -- live | mock
  status        TEXT DEFAULT 'pending',             -- pending | confirmed | failed
  created_at    TEXT NOT NULL
);
`);

/* Seed the catalogue once, from the original hard-coded homepage packages. */
const n = db.prepare('SELECT COUNT(*) AS n FROM packages').get().n;
if (n === 0) {
  const now = new Date().toISOString();
  const seed = [
    { title: 'Bali Honeymoon Escape',        place: 'Bali, Indonesia', category: 'international', price: 42999,  strike: 55999,  image: 'bg-bali',        duration: '6N / 7D', rating: '★ 4.9 (1.2k)', tag: 'Bestseller', features: ['🌙 6N / 7D', '🍽 Meals incl.', '🛏 4★ Stays'] },
    { title: 'Dubai Luxury & Desert',        place: 'Dubai, UAE',      category: 'international', price: 55999,  strike: 72000,  image: 'bg-dubai',       duration: '5N / 6D', rating: '★ 4.8 (980)',  tag: '-22%',       features: ['🌙 5N / 6D', '🏜 Safari', '🛏 5★ Stays'] },
    { title: 'Maldives Overwater Villas',    place: 'Maldives',        category: 'international', price: 89999,  strike: 120000, image: 'bg-maldives',    duration: '4N / 5D', rating: '★ 5.0 (640)',  tag: 'Honeymoon',  features: ['🌙 4N / 5D', '🐠 Snorkel', '🛥 Speedboat'] },
    { title: 'Kerala Backwaters Family Tour',place: 'Kerala, India',   category: 'domestic',     price: 18999,  strike: 24000,  image: 'bg-kerala',      duration: '5N / 6D', rating: '★ 4.9 (1.5k)', tag: 'Family',     features: ['🌙 5N / 6D', '🛶 Houseboat', '👨‍👩‍👧 Family'] },
    { title: 'Paradise on Earth — Kashmir',  place: 'Kashmir, India',  category: 'domestic',     price: 22999,  strike: 32000,  image: 'bg-kashmir',     duration: '5N / 6D', rating: '★ 4.8 (820)',  tag: 'New',        features: ['🌙 5N / 6D', '⛷ Gondola', '🚣 Shikara'] },
    { title: 'Thailand Bangkok + Phuket',    place: 'Thailand',        category: 'international', price: 38999,  strike: 48000,  image: 'bg-thailand',    duration: '6N / 7D', rating: '★ 4.7 (2.1k)', tag: 'Hot Deal',   features: ['🌙 6N / 7D', '🏝 2 Islands', '🛏 4★'] },
    { title: 'Swiss Alps Romance',           place: 'Switzerland',     category: 'international', price: 129999, strike: 160000, image: 'bg-switzerland', duration: '8N / 9D', rating: '★ 4.9 (540)',  tag: 'Premium',    features: ['🌙 8N / 9D', '🚞 Glacier Express', '🛏 4★'] },
    { title: 'Goa Beach Getaway',            place: 'Goa, India',      category: 'domestic',     price: 12999,  strike: 18000,  image: 'bg-goa',         duration: '3N / 4D', rating: '★ 4.6 (3.4k)', tag: 'Weekend',    features: ['🌙 3N / 4D', '🏖 Beach', '🍹 Cruise'] },
  ];
  const stmt = db.prepare(`INSERT INTO packages
    (title,place,category,price_inr,strike_inr,image,duration,rating,tag,features,description,active,sort,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,1,?,?)`);
  seed.forEach((p, i) => stmt.run(p.title, p.place, p.category, p.price, p.strike, p.image, p.duration, p.rating, p.tag, JSON.stringify(p.features), '', i, now));
  console.log(`  Seeded ${seed.length} packages into data.db`);
}

module.exports = db;
