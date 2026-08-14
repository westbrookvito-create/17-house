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

module.exports = {
  botToken: required('BOT_TOKEN'),
  adminIds,
  webappUrl: process.env.WEBAPP_URL || '',
  port: Number(process.env.PORT || 3000),
  clubChannelUrl: process.env.CLUB_CHANNEL_URL || '',
  clubName: process.env.CLUB_NAME || '17 House',
  bonusThreshold: Number(process.env.BONUS_THRESHOLD || 3),
  bonusPercent: Number(process.env.BONUS_PERCENT || 10),
  corsOrigin: (process.env.CORS_ORIGIN || '*').split(',').map((s) => s.trim()),
  dbPath: process.env.DB_PATH || require('path').join(__dirname, '..', 'data', '17house.db'),
};
