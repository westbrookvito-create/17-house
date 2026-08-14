const db = require('../db');
const config = require('../config');

const STATUS_DAYS = 365;

function nextMemberNumber() {
  const row = db.prepare(`SELECT value FROM counters WHERE name = 'member_number'`).get();
  if (!row) {
    // Первый участник клуба получает номер #0017 — отсылка к названию 17 House.
    db.prepare(`INSERT INTO counters (name, value) VALUES ('member_number', 17)`).run();
    return 17;
  }
  const next = row.value + 1;
  db.prepare(`UPDATE counters SET value = ? WHERE name = 'member_number'`).run(next);
  return next;
}

function formatCode(n) {
  return String(n).padStart(4, '0');
}

function getByTelegramId(telegramId) {
  return db.prepare(`SELECT * FROM users WHERE telegram_id = ?`).get(String(telegramId));
}

function getOrCreate(tgUser) {
  const existing = getByTelegramId(tgUser.id);
  if (existing) {
    db.prepare(`UPDATE users SET username = ?, first_name = ? WHERE id = ?`).run(
      tgUser.username || null,
      tgUser.first_name || null,
      existing.id,
    );
    return getByTelegramId(tgUser.id);
  }

  const now = new Date();
  const until = new Date(now.getTime() + STATUS_DAYS * 24 * 3600 * 1000);
  const memberCode = formatCode(nextMemberNumber());
  const isAdmin = config.adminIds.includes(String(tgUser.id)) ? 1 : 0;

  db.prepare(
    `INSERT INTO users (telegram_id, username, first_name, member_code, status, joined_at, status_until, is_admin)
     VALUES (?, ?, ?, ?, 'member', ?, ?, ?)`,
  ).run(
    String(tgUser.id),
    tgUser.username || null,
    tgUser.first_name || null,
    memberCode,
    now.toISOString(),
    until.toISOString(),
    isAdmin,
  );

  return getByTelegramId(tgUser.id);
}

function getById(id) {
  return db.prepare(`SELECT * FROM users WHERE id = ?`).get(id);
}

function isAdmin(telegramId) {
  return config.adminIds.includes(String(telegramId));
}

function registerShirtPurchase(userId) {
  const user = getById(userId);
  const shirtsPurchased = user.shirts_purchased + 1;
  const bonusUnlocked = shirtsPurchased >= config.bonusThreshold ? 1 : user.bonus_unlocked;
  db.prepare(`UPDATE users SET shirts_purchased = ?, bonus_unlocked = ? WHERE id = ?`).run(
    shirtsPurchased,
    bonusUnlocked,
    userId,
  );
  return getById(userId);
}

module.exports = {
  getByTelegramId,
  getOrCreate,
  getById,
  isAdmin,
  registerShirtPurchase,
};
