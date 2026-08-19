require('dotenv').config();

function required(name, fallback) {
  const v = process.env[name] ?? fallback;
  if (v === undefined) {
    console.error(`[config] Missing required env var: ${name}`);
    process.exit(1);
  }
  return v;
}

const adminIds = (process.env.ADMIN_IDS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const DEFAULT_PAYMENT_REQUISITES = [
  { name: 'Олег', phone: '+7 938 312 81 80', bank: 'Альфа банк' },
  { name: 'Виктория', phone: '+7 962 440 40 41', bank: 'Альфа банк' },
  { name: 'Мария', phone: '+7 906 464 56 88', bank: 'Альфа банк' },
];

function parsePaymentRequisites() {
  if (!process.env.PAYMENT_REQUISITES) return DEFAULT_PAYMENT_REQUISITES;
  try {
    const parsed = JSON.parse(process.env.PAYMENT_REQUISITES);
    if (Array.isArray(parsed) && parsed.length) return parsed;
  } catch (err) {
    console.error('[config] Failed to parse PAYMENT_REQUISITES, using defaults:', err.message);
  }
  return DEFAULT_PAYMENT_REQUISITES;
}

// Персональные статусы в профиле для конкретных Telegram ID — например,
// "Разработчик" красным вместо обычного "Member". Формат:
// SPECIAL_STATUSES={"111111111":{"label":"Разработчик","color":"#d96c6c"}}
// Пока переменная явно не задана, статус получает только первый admin id —
// его можно переопределить/расширить на нескольких админов через env var.
function parseSpecialStatuses() {
  if (process.env.SPECIAL_STATUSES) {
    try {
      return JSON.parse(process.env.SPECIAL_STATUSES);
    } catch (err) {
      console.error('[config] Failed to parse SPECIAL_STATUSES, ignoring:', err.message);
    }
  }
  return adminIds[0] ? { [adminIds[0]]: { label: 'Разработчик', color: '#d96c6c' } } : {};
}

module.exports = {
  botToken: required('BOT_TOKEN'),
  adminIds,
  webappUrl: process.env.WEBAPP_URL || '',
  port: Number(process.env.PORT || 3000),
  clubName: process.env.CLUB_NAME || '17 House',
  bonusThreshold: Number(process.env.BONUS_THRESHOLD || 3),
  bonusPercent: Number(process.env.BONUS_PERCENT || 10),
  corsOrigin: (process.env.CORS_ORIGIN || '*').split(',').map((s) => s.trim()),
  dbPath: process.env.DB_PATH || require('path').join(__dirname, '..', 'data', '17house.db'),
  paymentRequisites: parsePaymentRequisites(),
  specialStatuses: parseSpecialStatuses(),
  deliveryMethods: { yandex: 'Яндекс Доставка', cdek: 'СДЭК' },
};
