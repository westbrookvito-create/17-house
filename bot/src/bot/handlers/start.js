const users = require('../../models/users');
const config = require('../../config');
const { openAppKeyboard } = require('../keyboards');

function register(bot) {
  bot.start(async (ctx) => {
    const user = users.getOrCreate(ctx.from);

    const text =
      `<b>Добро пожаловать в ${config.clubName}</b>\n\n` +
      `Закрытый клуб по интересам. Привилегии в ресторанах. Мерч. Жизнь в стиле.\n\n` +
      `Ваша карта участника: <b>#${user.member_code}</b>\n\n` +
      `Нажмите кнопку ниже, чтобы открыть приложение клуба.`;

    // Фото берётся прямо с задеплоенного мини-аппа (webapp/public/hero.jpg),
    // а не хранится отдельной копией в боте — так они не могут разъехаться.
    if (config.webappUrl) {
      try {
        return await ctx.replyWithPhoto(`${config.webappUrl}/hero.jpg`, {
          caption: text,
          parse_mode: 'HTML',
          ...openAppKeyboard(),
        });
      } catch (err) {
        console.error('[start] failed to send hero photo, falling back to text-only', err.message);
      }
    }

    return ctx.replyWithHTML(text, openAppKeyboard());
  });

  bot.help((ctx) =>
    ctx.reply(
      'Команды:\n/start — открыть приветствие и приложение клуба\n/help — эта справка' +
        (users.isAdmin(ctx.from.id) ? '\n/admin — панель администратора' : ''),
    ),
  );

  // Любое обычное сообщение от участника (не команда, не от админа) пересылаем
  // менеджеру клуба — так работает кнопка «Связаться с менеджером» в мини-аппе.
  bot.on('text', async (ctx) => {
    if (users.isAdmin(ctx.from.id)) return;
    if (ctx.message.text.trim().startsWith('/')) return;

    const user = users.getOrCreate(ctx.from);

    for (const adminId of config.adminIds) {
      // eslint-disable-next-line no-await-in-loop
      await ctx.telegram
        .forwardMessage(adminId, ctx.chat.id, ctx.message.message_id)
        .catch((err) => console.error('[start] forward to admin failed', err.message));
    }

    return ctx.reply(
      `Сообщение передано менеджеру ${config.clubName} (карта #${user.member_code}). Мы ответим здесь в ближайшее время.`,
    );
  });
}

module.exports = { register };
