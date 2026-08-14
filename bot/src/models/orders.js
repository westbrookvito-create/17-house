const db = require('../db');

function rowToOrder(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    productId: row.product_id,
    productName: row.product_name,
    color: row.color,
    size: row.size,
    basePrice: row.base_price,
    price: row.price,
    discountPercent: row.discount_percent,
    status: row.status,
    createdAt: row.created_at,
    paidAt: row.paid_at,
    deliveryMethod: row.delivery_method,
    recipientName: row.recipient_name,
    phone: row.phone,
    pvzAddress: row.pvz_address,
    payment: {
      name: row.payment_name,
      phone: row.payment_phone,
      bank: row.payment_bank,
    },
  };
}

function create({
  userId,
  productId,
  productName,
  color,
  size,
  basePrice,
  price,
  discountPercent,
  deliveryMethod,
  recipientName,
  phone,
  pvzAddress,
  payment,
}) {
  const info = db
    .prepare(
      `INSERT INTO orders (
         user_id, product_id, product_name, color, size, base_price, price, discount_percent,
         status, created_at, delivery_method, recipient_name, phone, pvz_address,
         payment_name, payment_phone, payment_bank
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      userId,
      productId,
      productName,
      color,
      size,
      basePrice,
      price,
      discountPercent,
      new Date().toISOString(),
      deliveryMethod,
      recipientName,
      phone,
      pvzAddress,
      payment.name,
      payment.phone,
      payment.bank,
    );
  return getById(info.lastInsertRowid);
}

function getById(id) {
  return rowToOrder(db.prepare(`SELECT * FROM orders WHERE id = ?`).get(id));
}

function listByUser(userId) {
  return db
    .prepare(`SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC`)
    .all(userId)
    .map(rowToOrder);
}

function listPending() {
  return db
    .prepare(`SELECT * FROM orders WHERE status = 'pending' ORDER BY id ASC`)
    .all()
    .map(rowToOrder);
}

function setStatus(id, status) {
  const paidAt = status === 'paid' ? new Date().toISOString() : null;
  db.prepare(`UPDATE orders SET status = ?, paid_at = COALESCE(?, paid_at) WHERE id = ?`).run(status, paidAt, id);
  return getById(id);
}

module.exports = { create, getById, listByUser, listPending, setStatus };
