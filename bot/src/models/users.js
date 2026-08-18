const db = require('../db');
const config = require('../config');

const STATUS_DAYS = 365;
const MEMBER_CODE_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const MEMBER_CODE_LENGTH = 6;

function getByTelegramId(telegramId) {
  return db.prepare(`SELECT * FROM users WHERE telegram_id = ?`).get(String(telegramId));
}

// Персональный код участника — случайные буквы, а не порядковый номер, чтобы
// его нельзя было угадать или использовать для оценки числа участников клуба.
function generateMemberCode() {
  let code = '';
  for (let i = 0; i < MEMBER_CODE_LENGTH; i++) {
    code += MEMBER_CODE_LETTERS[Math.floor(Math.random() * MEMBER_CODE_LETTERS.length)];
  }
  return code;
}

function uniqueMemberCode() {
  let code;
  do {
    code = generateMemberCode();
  } while (db.prepare(`SELECT 1 FROM users WHERE member_code = ?`).get(code));
  return code;
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

  db.prepare(
    `INSERT INTO users (telegram_id, username, first_name, member_code, status, joined_at, status_until, is_admin)
     VALUES (?, ?, ?, ?, 'member', ?, ?, ?)`,
  ).run(
    String(tgUser.id),
    tgUser.username || null,
    tgUser.first_name || null,
    uniqueMemberCode(),
    now.toISOString(),
    until.toISOString(),
    isAdmin,
  );

  return getByTelegramId(tgUser.id);
}

function getById(id) {
  return db.prepare(`SELECT * FROM users WHERE id = ?`).get(id);
}

function listAll() {
  return db.prepare(`SELECT * FROM users ORDER BY id DESC`).all();
}

// Участники клуба — те, кто хотя бы раз купил футболку (тот же критерий,
// что открывает визитку клуба и доступ в закрытый канал).
function listMembers() {
  return db.prepare(`SELECT * FROM users WHERE shirts_purchased >= 1 ORDER BY id DESC`).all();
}

function isAdmin(telegramId) {
  return config.adminIds.includes(String(telegramId));
}

function acceptPrivacy(userId) {
  db.prepare(`UPDATE users SET privacy_accepted = 1 WHERE id = ?`).run(userId);
  return getById(userId);
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
  listAll,
  listMembers,
  isAdmin,
  acceptPrivacy,
  registerShirtPurchase,
};
