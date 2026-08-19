const { Markup } = require('telegraf');
const users = require('../../models/users');
const config = require('../../config');
const { openAppKeyboard } = require('../keyboards');

function privacyKeyboard() {
  return Markup.inlineKeyboard([Markup.button.callback('✅ Согласен', 'privacy:accept')]);
}

function register(bot) {
  const privacyText =
    `🔒 <b>Политика конфиденциальности</b>\n\n` +
    `Используя бота ${config.clubName}, вы соглашаетесь на обработку персональных данных: Telegram ID, имя, ` +
    `username, а также данные для доставки заказов (ФИО, телефон, адрес). Эта информация используется только ` +
    `для работы клуба и не передаётся третьим лицам, кроме случаев, необходимых для доставки заказа.\n\n` +
    `Чтобы продолжить, нажмите кнопку ниже.`;

  // Приветствие с фото/кнопкой — общая логика для /start и для момента,
  // когда пользователь только что принял согласие на обработку данных.
  async function sendWelcome(ctx, user) {
    const text =
      `<b>Добро пожаловать в ${config.clubName}</b>\n\n` +
      `Закрытый клуб по интересам. Привилегии в ресторанах. Мерч. Жизнь в стиле.\n\n` +
      `Ваша карта участника: <b>#${user.member_code}</b>\n\n` +
      `Нажмите кнопку ниже, чтобы открыть приложение клуба.`;

    // Фото берётся прямо с задеплоенного мини-аппа (webapp/public/hero.jpg),
    // а не хранится отдельной копией в боте — так они не могут разъехаться.
    if (!config.webappUrl) {
      console.warn('[start] WEBAPP_URL is not set — sending welcome without hero photo/app button');
      return ctx.replyWithHTML(text, openAppKeyboard());
    }

    try {
      return await ctx.replyWithPhoto(`${config.webappUrl}/hero.jpg`, {
        caption: text,
        parse_mode: 'HTML',
        ...openAppKeyboard(),
      });
    } catch (err) {
      console.error(
        `[start] failed to send hero photo from ${config.webappUrl}/hero.jpg, falling back to text-only:`,
        err.message,
      );
      return ctx.replyWithHTML(text, openAppKeyboard());
    }
  }

  // Уведомляет админов о новом участнике сразу при первом /start.
  async function notifyAdminsNewUser(ctx, user) {
    const displayName = user.username ? `@${user.username}` : user.first_name || `id${user.telegram_id}`;
    const text =
      `🆕 <b>Новый участник</b>\n` +
      `Имя: ${displayName}\n` +
      `Telegram ID: ${user.telegram_id}\n` +
      `Карта: #${user.member_code}`;
    for (const adminId of config.adminIds) {
      // eslint-disable-next-line no-await-in-loop
      await ctx.telegram
        .sendMessage(adminId, text, { parse_mode: 'HTML' })
        .catch((err) => console.error('[start] new user notify failed', err.message));
    }
  }

  bot.start(async (ctx) => {
    const isNew = !users.getByTelegramId(ctx.from.id);
    const user = users.getOrCreate(ctx.from);
    if (isNew) await notifyAdminsNewUser(ctx, user);
    if (!user.privacy_accepted) {
      return ctx.replyWithHTML(privacyText, privacyKeyboard());
    }
    return sendWelcome(ctx, user);
  });

  bot.action('privacy:accept', async (ctx) => {
    const user = users.getOrCreate(ctx.from);
    const updated = users.acceptPrivacy(user.id);
    await ctx.answerCbQuery('Спасибо!');
    await ctx.editMessageReplyMarkup(undefined).catch(() => {});
    return sendWelcome(ctx, updated);
  });

  const sizeChartCaption =
    `📏 <b>Таблица размеров ${config.clubName}</b>\n\n` +
    `Сравните замеры на фото со своими — если между двумя размерами, берите больше: крой свободный. ` +
    `Остались вопросы — жмите «Связаться с менеджером» в приложении клуба.`;

  // Таблица размеров — те же 2 картинки, что и hero.jpg, отдаются прямо
  // с задеплоенного мини-аппа (webapp/public/size-chart-1.jpg, size-chart-2.jpg).
  // Подпись Telegram показывает под первым фото в группе.
  async function sendSizeChart(ctx) {
    if (!config.webappUrl) {
      return ctx.reply('Таблица размеров временно недоступна.');
    }
    try {
      return await ctx.replyWithMediaGroup([
        { type: 'photo', media: `${config.webappUrl}/size-chart-1.jpg`, caption: sizeChartCaption, parse_mode: 'HTML' },
        { type: 'photo', media: `${config.webappUrl}/size-chart-2.jpg` },
      ]);
    } catch (err) {
      console.error('[start] failed to send size chart', err.message);
      return ctx.reply('Не удалось отправить таблицу размеров, попробуйте позже.');
    }
  }

  bot.action('size_chart', async (ctx) => {
    await ctx.answerCbQuery();
    return sendSizeChart(ctx);
  });

  bot.command('size', (ctx) => sendSizeChart(ctx));

  bot.help((ctx) =>
    ctx.reply(
      'Команды:\n/start — открыть приветствие и приложение клуба\n/size — таблица размеров\n/help — эта справка' +
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
