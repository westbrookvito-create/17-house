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
    color: row.color,
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
      color || null,
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

const PAID_STATUSES = ['paid', 'shipped', 'received'];

// Статистика продаж за текущий календарный месяц — для админ-панели.
function monthStats() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const rows = db.prepare(`SELECT status, price FROM orders WHERE created_at >= ?`).all(monthStart);
  const paid = rows.filter((r) => PAID_STATUSES.includes(r.status));

  return {
    monthLabel: now.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }),
    totalOrders: rows.length,
    paidOrders: paid.length,
    pendingOrders: rows.filter((r) => r.status === 'pending').length,
    cancelledOrders: rows.filter((r) => r.status === 'cancelled').length,
    revenue: paid.reduce((sum, r) => sum + r.price, 0),
  };
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

module.exports = { STATUSES, create, getById, listByUser, listFiltered, setStatus, monthStats };
