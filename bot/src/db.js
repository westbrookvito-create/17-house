const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('./config');

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id TEXT UNIQUE NOT NULL,
  username TEXT,
  first_name TEXT,
  member_code TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'member',
  joined_at TEXT NOT NULL,
  status_until TEXT NOT NULL,
  shirts_purchased INTEGER NOT NULL DEFAULT 0,
  bonus_unlocked INTEGER NOT NULL DEFAULT 0,
  is_admin INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price INTEGER NOT NULL,
  sizes TEXT NOT NULL DEFAULT '[]',
  colors TEXT NOT NULL DEFAULT '[]',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  product_id INTEGER REFERENCES products(id),
  product_name TEXT NOT NULL,
  color TEXT,
  size TEXT,
  base_price INTEGER NOT NULL,
  price INTEGER NOT NULL,
  discount_percent INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  paid_at TEXT,
  shipped_at TEXT,
  received_at TEXT,
  delivery_method TEXT,
  recipient_name TEXT,
  phone TEXT,
  pvz_address TEXT,
  payment_name TEXT,
  payment_phone TEXT,
  payment_bank TEXT
);

CREATE TABLE IF NOT EXISTS counters (
  name TEXT PRIMARY KEY,
  value INTEGER NOT NULL
);
`);

// Идемпотентная миграция для баз, созданных до появления полей доставки/оплаты.
const orderColumns = new Set(db.prepare(`PRAGMA table_info(orders)`).all().map((c) => c.name));
const newOrderColumns = {
  shipped_at: 'TEXT',
  received_at: 'TEXT',
  delivery_method: 'TEXT',
  recipient_name: 'TEXT',
  phone: 'TEXT',
  pvz_address: 'TEXT',
  payment_name: 'TEXT',
  payment_phone: 'TEXT',
  payment_bank: 'TEXT',
};
for (const [column, type] of Object.entries(newOrderColumns)) {
  if (!orderColumns.has(column)) {
    db.exec(`ALTER TABLE orders ADD COLUMN ${column} ${type}`);
  }
}

// Идемпотентная миграция для баз, созданных до появления согласия на
// обработку данных.
const userColumns = new Set(db.prepare(`PRAGMA table_info(users)`).all().map((c) => c.name));
if (!userColumns.has('privacy_accepted')) {
  db.exec(`ALTER TABLE users ADD COLUMN privacy_accepted INTEGER NOT NULL DEFAULT 0`);
}

module.exports = db;
