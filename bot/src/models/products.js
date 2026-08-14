const db = require('../db');

function rowToProduct(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: row.price,
    sizes: JSON.parse(row.sizes || '[]'),
    colors: JSON.parse(row.colors || '[]'),
    active: !!row.active,
    createdAt: row.created_at,
  };
}

function listActive() {
  return db
    .prepare(`SELECT * FROM products WHERE active = 1 ORDER BY id DESC`)
    .all()
    .map(rowToProduct);
}

function listAll() {
  return db.prepare(`SELECT * FROM products ORDER BY id DESC`).all().map(rowToProduct);
}

function getById(id) {
  return rowToProduct(db.prepare(`SELECT * FROM products WHERE id = ?`).get(id));
}

function create({ name, description, price, sizes, colors }) {
  const info = db
    .prepare(
      `INSERT INTO products (name, description, price, sizes, colors, active, created_at)
       VALUES (?, ?, ?, ?, ?, 1, ?)`,
    )
    .run(name, description, price, JSON.stringify(sizes), JSON.stringify(colors), new Date().toISOString());
  return getById(info.lastInsertRowid);
}

function updateField(id, field, value) {
  const allowed = ['name', 'description', 'price', 'sizes', 'colors', 'active'];
  if (!allowed.includes(field)) throw new Error(`Field not editable: ${field}`);
  const dbValue = field === 'sizes' || field === 'colors' ? JSON.stringify(value) : value;
  db.prepare(`UPDATE products SET ${field} = ? WHERE id = ?`).run(dbValue, id);
  return getById(id);
}

function toggleActive(id) {
  const product = getById(id);
  db.prepare(`UPDATE products SET active = ? WHERE id = ?`).run(product.active ? 0 : 1, id);
  return getById(id);
}

function remove(id) {
  db.prepare(`DELETE FROM products WHERE id = ?`).run(id);
}

module.exports = { listActive, listAll, getById, create, updateField, toggleActive, remove };
