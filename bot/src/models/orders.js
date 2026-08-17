const db = require('../db');

const STATUSES = ['pending', 'paid', 'shipped', 'received', 'cancelled'];

// Какую *_at колонку проставлять при переходе в этот статус.
const STATUS_TIMESTAMP_COLUMN = {
  paid: 'paid_at',
  shipped: 'shipped_at',
  received: 'received_at',
};

function rowToOrder(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    productId: row.product_id,
    productName: row.product_name,
    size: row.size,
    basePrice: row.base_price,
    price: row.price,
    discountPercent: row.discount_percent,
    status: row.status,
    createdAt: row.created_at,
    paidAt: row.paid_at,
    shippedAt: row.shipped_at,
    receivedAt: row.received_at,
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
         user_id, product_id, product_name, size, base_price, price, discount_percent,
         status, created_at, delivery_method, recipient_name, phone, pvz_address,
         payment_name, payment_phone, payment_bank
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      userId,
      productId,
      productName,
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

// Полная история заказов админа, с необязательным фильтром по статусу и/или способу доставки.
function listFiltered({ status, deliveryMethod } = {}) {
  const clauses = [];
  const params = [];
  if (status && status !== 'all') {
    clauses.push('status = ?');
    params.push(status);
  }
  if (deliveryMethod && deliveryMethod !== 'all') {
    clauses.push('delivery_method = ?');
    params.push(deliveryMethod);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return db
    .prepare(`SELECT * FROM orders ${where} ORDER BY id DESC`)
    .all(...params)
    .map(rowToOrder);
}

function setStatus(id, status) {
  const column = STATUS_TIMESTAMP_COLUMN[status];
  if (column) {
    db.prepare(`UPDATE orders SET status = ?, ${column} = ? WHERE id = ?`).run(status, new Date().toISOString(), id);
  } else {
    db.prepare(`UPDATE orders SET status = ? WHERE id = ?`).run(status, id);
  }
  return getById(id);
}

module.exports = { STATUSES, create, getById, listByUser, listFiltered, setStatus };
