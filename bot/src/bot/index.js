const bot = require('./instance');
const start = require('./handlers/start');
const admin = require('./handlers/admin');

// Порядок важен: у admin.js есть catch-all обработчики text/photo для
// пошаговых диалогов, поэтому конкретные команды регистрируем первыми.
admin.register(bot);
start.register(bot);

bot.catch((err, ctx) => {
  console.error(`[bot] error while handling update ${ctx.updateType}`, err);
});

module.exports = bot;
