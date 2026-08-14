const db = require('../db');
const config = require('../config');

const STATUS_DAYS = 365;

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
  const isAdmin = config.adminIds.includes(String(tgUser.id)) ? 1 : 0;

  // member_code — простой порядковый номер регистрации (1, 2, 3, ...),
  // временно совпадает с telegram_id до вставки, затем заменяется на id строки.
  const info = db
    .prepare(
      `INSERT INTO users (telegram_id, username, first_name, member_code, status, joined_at, status_until, is_admin)
       VALUES (?, ?, ?, ?, 'member', ?, ?, ?)`,
    )
    .run(
      String(tgUser.id),
      tgUser.username || null,
      tgUser.first_name || null,
      'pending',
      now.toISOString(),
      until.toISOString(),
      isAdmin,
    );

  const memberCode = String(info.lastInsertRowid);
  db.prepare(`UPDATE users SET member_code = ? WHERE id = ?`).run(memberCode, info.lastInsertRowid);

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
