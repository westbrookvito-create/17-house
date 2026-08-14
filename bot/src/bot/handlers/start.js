const users = require('../../models/users');
const config = require('../../config');
const { openAppKeyboard } = require('../keyboards');

function register(bot) {
  bot.start((ctx) => {
    const user = users.getOrCreate(ctx.from);

    const text =
      `<b>Добро пожаловать в ${config.clubName}</b>\n\n` +
      `Закрытый клуб по интересам. Привилегии в ресторанах. Мерч. Жизнь в стиле.\n\n` +
      `Ваша карта участника: <b>#${user.member_code}</b>\n\n` +
      `Нажмите кнопку ниже, чтобы открыть приложение клуба.`;

    return ctx.replyWithHTML(text, openAppKeyboard());
  });

  bot.help((ctx) =>
    ctx.reply(
      'Команды:\n/start — открыть приветствие и приложение клуба\n/help — эта справка' +
        (users.isAdmin(ctx.from.id) ? '\n/admin — панель администратора' : ''),
    ),
  );
}

module.exports = { register };
