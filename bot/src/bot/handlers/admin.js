const { Markup } = require('telegraf');
const config = require('../../config');
const productsModel = require('../../models/products');
const ordersModel = require('../../models/orders');
const usersModel = require('../../models/users');
const { adminMenuKeyboard } = require('../keyboards');
const { formatOrderDetails } = require('../../api/routes/orders');
const { buildOrdersCsv } = require('../../utils/exportOrders');

// Простая in-memory машина состояний для пошаговых диалогов админа
// (добавление / редактирование товара). Ключ — telegram user id.
const sessions = new Map();

function isAdminCtx(ctx) {
  return usersModel.isAdmin(ctx.from.id);
}

const PHOTO_SIZE_HINT =
  '📐 Рекомендуемый размер фото: квадратное или 4:5, от 1200×1200 px (JPEG/PNG, до 5 МБ). ' +
  'Можно прислать несколько фото подряд для этого цвета.';

function formatColorsLine(colors) {
  if (!colors.length) return '—';
  return colors.map((c) => `${c.name || 'без названия'} (${c.photos.length} фото)`).join(', ');
}

function renderProductText(p) {
  return (
    `<b>${p.name}</b>${p.active ? '' : ' (скрыт)'}\n` +
    `${p.description || ''}\n\n` +
    `Цена: ${p.price} ₽\n` +
    `Размеры: ${p.sizes.join(', ') || '—'}\n` +
    `Цвета: ${formatColorsLine(p.colors)}`
  );
}

function renderDraftPreview(data) {
  return (
    `<b>Предпросмотр нового товара</b>\n\n` +
    `<b>${data.name}</b>\n` +
    `${data.description || ''}\n\n` +
    `Цена: ${data.price} ₽\n` +
    `Размеры: ${data.sizes.join(', ') || '—'}\n` +
    `Цвета: ${formatColorsLine(data.colors)}`
  );
}

function broadcastConfirmKeyboard(total) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(`📤 Отправить всем (${total})`, 'broadcast:send')],
    [Markup.button.callback('❌ Отменить', 'broadcast:cancel')],
  ]).reply_markup;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const STATUS_LABELS = {
  pending: '⏳ Ожидает оплаты',
  paid: '✅ Оплачен',
  shipped: '📦 Отправлен',
  received: '📬 Получен',
  cancelled: '❌ Отменён',
};

const STATUS_FILTERS = [
  ['all', 'Все'],
  ['pending', '⏳ Ожидают оплаты'],
  ['paid', '✅ Оплачены'],
  ['shipped', '📦 Отправлены'],
  ['received', '📬 Получены'],
  ['cancelled', '❌ Отменены'],
];

const DELIVERY_FILTERS = [
  ['all', 'Все способы'],
  ['yandex', 'Яндекс Доставка'],
  ['cdek', 'СДЭК'],
];

const USERS_PAGE_SIZE = 20;

function renderUserLine(u) {
  const name = u.username ? `@${u.username}` : u.first_name || 'Без имени';
  const badges = [`👕${u.shirts_purchased}`];
  if (u.bonus_unlocked) badges.push('🎁');
  if (u.is_admin) badges.push('👑');
  return `#${u.member_code} — ${name} (id ${u.telegram_id}) — ${badges.join(' ')}`;
}

function usersPageKeyboard(prefix, offset, total) {
  const nav = [];
  if (offset > 0) nav.push(Markup.button.callback('⬅️ Назад', `${prefix}:${Math.max(0, offset - USERS_PAGE_SIZE)}`));
  if (offset + USERS_PAGE_SIZE < total) nav.push(Markup.button.callback('Вперёд ➡️', `${prefix}:${offset + USERS_PAGE_SIZE}`));
  const rows = [];
  if (nav.length) rows.push(nav);
  rows.push([Markup.button.callback('⬅️ В админ-панель', 'admin:menu')]);
  return Markup.inlineKeyboard(rows).reply_markup;
}

function renderOrderText(order, user) {
  const displayName = user?.username ? `@${user.username}` : user?.first_name || `id${order.userId}`;
  return (
    `🧾 <b>Заказ #${order.id}</b> — ${STATUS_LABELS[order.status] || order.status}\n` +
    `От: ${displayName}\n\n` +
    formatOrderDetails(order)
  );
}

// Какие действия доступны из текущего статуса заказа — админ всегда видит
// полную карточку заказа, кнопки просто меняются по мере продвижения статуса.
function orderActionsKeyboard(order) {
  const rows = [];
  if (order.status === 'pending') {
    rows.push([
      Markup.button.callback('✅ Подтвердить оплату', `confirm_order:${order.id}`),
      Markup.button.callback('❌ Отменить', `cancel_order:${order.id}`),
    ]);
  } else if (order.status === 'paid') {
    rows.push([Markup.button.callback('📦 Отметить отправленным', `ship_order:${order.id}`)]);
  } else if (order.status === 'shipped') {
    rows.push([Markup.button.callback('📬 Отметить полученным', `receive_order:${order.id}`)]);
  }
  return { inline_keyboard: rows };
}

function productEditKeyboard(p) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✏️ Название', `product:edit_name:${p.id}`),
      Markup.button.callback('✏️ Цена', `product:edit_price:${p.id}`),
    ],
    [
      Markup.button.callback('✏️ Описание', `product:edit_description:${p.id}`),
      Markup.button.callback('✏️ Размеры', `product:edit_sizes:${p.id}`),
    ],
    [Markup.button.callback('🎨 Цвета', `product:edit_colors:${p.id}`)],
    [Markup.button.callback(p.active ? '🚫 Скрыть' : '✅ Показать', `product:toggle:${p.id}`)],
    [Markup.button.callback('🗑 Удалить', `product:delete_confirm:${p.id}`)],
    [Markup.button.callback('⬅️ К списку товаров', 'admin:list_products')],
  ]).reply_markup;
}

async function applyFieldEdit(ctx, session, text) {
  const { productId, field } = session;
  let value = text;

  if (field === 'price') {
    value = parseInt(text.replace(/\D/g, ''), 10);
    if (!value) {
      await ctx.reply('Цена должна быть числом, например 1490. Попробуйте ещё раз.');
      return false;
    }
  }
  if (field === 'sizes') {
    value = text
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const product = productsModel.updateField(productId, field, value);
  await ctx.replyWithHTML(`Обновлено.\n\n${renderProductText(product)}`, {
    reply_markup: productEditKeyboard(product),
  });
  return true;
}

function register(bot) {
  bot.command('admin', (ctx) => {
    if (!isAdminCtx(ctx)) return;
    sessions.delete(ctx.from.id);
    ctx.reply(`Админ-панель ${config.clubName}`, adminMenuKeyboard());
  });

  bot.command('cancel', (ctx) => {
    if (!isAdminCtx(ctx)) return;
    if (sessions.delete(ctx.from.id)) ctx.reply('Действие отменено.');
  });

  // Начинает (или продолжает) цикл добавления цветов: спрашивает название
  // следующего цвета. Общая функция для сценариев добавления нового товара
  // и полной замены цветов существующего — оба используют одинаковый цикл
  // название → фото → /nextcolor|/done.
  function askColorName(ctx, session) {
    session.step = 'color_name';
    session.currentColor = null;
    sessions.set(ctx.from.id, session);
    return ctx.reply(
      session.data.colors.length === 0
        ? 'Введите название первого цвета (например: Navy):'
        : 'Цвет добавлен ✅ Введите название следующего цвета, либо отправьте /done, если цвета закончились:',
    );
  }

  bot.command('nextcolor', async (ctx) => {
    if (!isAdminCtx(ctx)) return;
    const session = sessions.get(ctx.from.id);
    if (!session || session.step !== 'color_photos') return;
    if (!session.currentColor || !session.currentColor.photos.length) {
      return ctx.reply('Добавьте хотя бы одно фото для этого цвета перед тем, как перейти к следующему.');
    }
    session.data.colors.push(session.currentColor);
    return askColorName(ctx, session);
  });

  bot.command('done', async (ctx) => {
    if (!isAdminCtx(ctx)) return;
    const session = sessions.get(ctx.from.id);
    if (!session) return;
    if (session.step !== 'color_photos') return;

    const colors = [...session.data.colors];
    if (session.currentColor && session.currentColor.photos.length) {
      colors.push(session.currentColor);
    }
    if (!colors.length) {
      return ctx.reply('Добавьте хотя бы один цвет с фото перед завершением.');
    }
    session.data.colors = colors;

    if (session.editingExisting) {
      const product = productsModel.updateField(session.productId, 'colors', session.data.colors);
      sessions.delete(ctx.from.id);
      return ctx.replyWithHTML(`Цвета товара «${product.name}» обновлены.`, {
        reply_markup: productEditKeyboard(product),
      });
    }

    session.step = 'confirm';
    sessions.set(ctx.from.id, session);
    return ctx.replyWithHTML(renderDraftPreview(session.data), {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('✅ Опубликовать', 'addproduct:publish')],
        [Markup.button.callback('❌ Отменить', 'addproduct:cancel')],
      ]).reply_markup,
    });
  });

  // --- Admin menu actions -------------------------------------------------

  bot.action('admin:add_product', (ctx) => {
    if (!isAdminCtx(ctx)) return ctx.answerCbQuery();
    sessions.set(ctx.from.id, { step: 'name', data: { colors: [] } });
    ctx.answerCbQuery();
    return ctx.reply('Введите название товара (например: House Every Weekend Tee). Цвета добавите на следующих шагах:');
  });

  bot.action('admin:list_products', async (ctx) => {
    if (!isAdminCtx(ctx)) return ctx.answerCbQuery();
    await ctx.answerCbQuery();
    const list = productsModel.listAll();
    if (!list.length) return ctx.reply('Товаров пока нет. Нажмите «Добавить товар».', adminMenuKeyboard());
    const rows = list.map((p) => [
      Markup.button.callback(`${p.active ? '🟢' : '⚪️'} ${p.name} — ${p.price}₽`, `product:view:${p.id}`),
    ]);
    return ctx.reply('Товары клуба:', Markup.inlineKeyboard(rows));
  });

  bot.action('admin:broadcast', (ctx) => {
    if (!isAdminCtx(ctx)) return ctx.answerCbQuery();
    sessions.set(ctx.from.id, { step: 'broadcast_content', data: {} });
    ctx.answerCbQuery();
    return ctx.reply(
      'Пришлите текст рассылки, или фото с подписью (подпись не обязательна) — уйдёт всем пользователям бота.\n\n' +
        'Отменить — /cancel.',
    );
  });

  bot.action('broadcast:send', async (ctx) => {
    if (!isAdminCtx(ctx)) return ctx.answerCbQuery();
    const session = sessions.get(ctx.from.id);
    if (!session || session.step !== 'broadcast_confirm') return ctx.answerCbQuery();
    await ctx.answerCbQuery('Отправляю…');
    await ctx.editMessageReplyMarkup(undefined).catch(() => {});

    const { text, photoFileId } = session.data;
    sessions.delete(ctx.from.id);

    const recipients = usersModel.listAll();
    let sent = 0;
    let failed = 0;
    for (const u of recipients) {
      try {
        if (photoFileId) {
          // eslint-disable-next-line no-await-in-loop
          await ctx.telegram.sendPhoto(u.telegram_id, photoFileId, text ? { caption: text } : {});
        } else {
          // eslint-disable-next-line no-await-in-loop
          await ctx.telegram.sendMessage(u.telegram_id, text);
        }
        sent++;
      } catch (err) {
        failed++;
        console.error('[broadcast] failed to send to', u.telegram_id, err.message);
      }
      // eslint-disable-next-line no-await-in-loop
      await sleep(35); // не упираемся в лимиты Telegram при рассылке многим пользователям
    }

    return ctx.reply(
      `✅ Рассылка завершена: отправлено ${sent} из ${recipients.length}` +
        (failed ? `, не доставлено ${failed} (пользователь заблокировал бота и т.п.)` : '') +
        '.',
    );
  });

  bot.action('broadcast:cancel', (ctx) => {
    if (!isAdminCtx(ctx)) return ctx.answerCbQuery();
    sessions.delete(ctx.from.id);
    ctx.answerCbQuery('Отменено');
    return ctx.reply('Рассылка отменена.');
  });

  bot.action('admin:menu', (ctx) => {
    if (!isAdminCtx(ctx)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    return ctx.reply(`Админ-панель ${config.clubName}`, adminMenuKeyboard());
  });

  bot.action(/^admin:list_users(?::(\d+))?$/, async (ctx) => {
    if (!isAdminCtx(ctx)) return ctx.answerCbQuery();
    await ctx.answerCbQuery();
    const offset = Number(ctx.match[1] || 0);
    const all = usersModel.listAll();
    if (!all.length) return ctx.reply('Пользователей пока нет.');
    const page = all.slice(offset, offset + USERS_PAGE_SIZE);
    const text =
      `👥 <b>Все пользователи</b> (${offset + 1}–${offset + page.length} из ${all.length}):\n\n` +
      page.map(renderUserLine).join('\n');
    return ctx.replyWithHTML(text, { reply_markup: usersPageKeyboard('admin:list_users', offset, all.length) });
  });

  bot.action(/^admin:list_members(?::(\d+))?$/, async (ctx) => {
    if (!isAdminCtx(ctx)) return ctx.answerCbQuery();
    await ctx.answerCbQuery();
    const offset = Number(ctx.match[1] || 0);
    const all = usersModel.listMembers();
    if (!all.length) return ctx.reply('В клубе пока нет участников (никто не купил футболку).');
    const page = all.slice(offset, offset + USERS_PAGE_SIZE);
    const text =
      `🏅 <b>Участники клуба</b> (${offset + 1}–${offset + page.length} из ${all.length}):\n\n` +
      page.map(renderUserLine).join('\n');
    return ctx.replyWithHTML(text, { reply_markup: usersPageKeyboard('admin:list_members', offset, all.length) });
  });

  bot.action('admin:stats_month', async (ctx) => {
    if (!isAdminCtx(ctx)) return ctx.answerCbQuery();
    await ctx.answerCbQuery();
    const s = ordersModel.monthStats();
    const text =
      `📊 <b>Статистика продаж за ${s.monthLabel}</b>\n\n` +
      `Всего заказов: ${s.totalOrders}\n` +
      `✅ Оплачено: ${s.paidOrders}\n` +
      `⏳ Ожидают оплаты: ${s.pendingOrders}\n` +
      `❌ Отменено: ${s.cancelledOrders}\n\n` +
      `💰 Выручка (по оплаченным): ${s.revenue} ₽`;
    return ctx.replyWithHTML(text, {
      reply_markup: Markup.inlineKeyboard([[Markup.button.callback('⬅️ В админ-панель', 'admin:menu')]]).reply_markup,
    });
  });

  bot.action('admin:export_orders', async (ctx) => {
    if (!isAdminCtx(ctx)) return ctx.answerCbQuery();
    await ctx.answerCbQuery();
    const orders = ordersModel.listFiltered({});
    if (!orders.length) return ctx.reply('Заказов пока нет — экспортировать нечего.');
    const csv = buildOrdersCsv(orders, usersModel);
    const filename = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
    return ctx.replyWithDocument({ source: Buffer.from(csv, 'utf8'), filename });
  });

  bot.action('admin:list_orders', (ctx) => {
    if (!isAdminCtx(ctx)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    const rows = STATUS_FILTERS.map(([value, label]) => [Markup.button.callback(label, `orders:status:${value}`)]);
    return ctx.reply('Все заказы клуба. Сначала выберите статус:', Markup.inlineKeyboard(rows));
  });

  bot.action(/^orders:status:(all|pending|paid|shipped|received|cancelled)$/, (ctx) => {
    if (!isAdminCtx(ctx)) return ctx.answerCbQuery();
    const status = ctx.match[1];
    ctx.answerCbQuery();
    const rows = DELIVERY_FILTERS.map(([value, label]) => [
      Markup.button.callback(label, `orders:show:${status}:${value}`),
    ]);
    return ctx.reply('Теперь способ доставки:', Markup.inlineKeyboard(rows));
  });

  bot.action(/^orders:show:(all|pending|paid|shipped|received|cancelled):(all|yandex|cdek)$/, async (ctx) => {
    if (!isAdminCtx(ctx)) return ctx.answerCbQuery();
    const [, status, deliveryMethod] = ctx.match;
    await ctx.answerCbQuery();
    const list = ordersModel.listFiltered({ status, deliveryMethod });
    if (!list.length) return ctx.reply('Заказов по этому фильтру не найдено.');
    await ctx.reply(`Найдено заказов: ${list.length}`);
    for (const order of list) {
      const user = usersModel.getById(order.userId);
      // eslint-disable-next-line no-await-in-loop
      await ctx.replyWithHTML(renderOrderText(order, user), { reply_markup: orderActionsKeyboard(order) });
    }
  });

  // --- Product view / edit -------------------------------------------------

  bot.action(/^product:view:(\d+)$/, async (ctx) => {
    if (!isAdminCtx(ctx)) return ctx.answerCbQuery();
    const product = productsModel.getById(Number(ctx.match[1]));
    await ctx.answerCbQuery();
    if (!product) return ctx.reply('Товар не найден.');
    return ctx.replyWithHTML(renderProductText(product), { reply_markup: productEditKeyboard(product) });
  });

  const editableFields = ['name', 'description', 'price', 'sizes'];
  for (const field of editableFields) {
    bot.action(new RegExp(`^product:edit_${field}:(\\d+)$`), (ctx) => {
      if (!isAdminCtx(ctx)) return ctx.answerCbQuery();
      const productId = Number(ctx.match[1]);
      sessions.set(ctx.from.id, { step: 'edit_field', productId, field });
      ctx.answerCbQuery();
      const prompts = {
        name: 'Введите новое название:',
        description: 'Введите новое описание:',
        price: 'Введите новую цену (число, ₽):',
        sizes: 'Введите размеры через запятую, например: S, M, L, XL',
      };
      return ctx.reply(prompts[field]);
    });
  }

  bot.action(/^product:edit_colors:(\d+)$/, (ctx) => {
    if (!isAdminCtx(ctx)) return ctx.answerCbQuery();
    const productId = Number(ctx.match[1]);
    sessions.set(ctx.from.id, {
      step: 'color_name',
      productId,
      editingExisting: true,
      data: { colors: [] },
      currentColor: null,
    });
    ctx.answerCbQuery();
    return ctx.reply('Это полностью заменит текущие цвета и фото товара. Введите название первого цвета:');
  });

  bot.action(/^product:toggle:(\d+)$/, async (ctx) => {
    if (!isAdminCtx(ctx)) return ctx.answerCbQuery();
    const product = productsModel.toggleActive(Number(ctx.match[1]));
    await ctx.answerCbQuery(product.active ? 'Товар показан в каталоге' : 'Товар скрыт из каталога');
    return ctx.editMessageText(renderProductText(product), {
      parse_mode: 'HTML',
      reply_markup: productEditKeyboard(product),
    });
  });

  bot.action(/^product:delete_confirm:(\d+)$/, (ctx) => {
    if (!isAdminCtx(ctx)) return ctx.answerCbQuery();
    const id = Number(ctx.match[1]);
    ctx.answerCbQuery();
    return ctx.reply('Удалить товар без возможности восстановления?', {
      reply_markup: Markup.inlineKeyboard([
        [
          Markup.button.callback('🗑 Да, удалить', `product:delete:${id}`),
          Markup.button.callback('Отмена', `product:view:${id}`),
        ],
      ]).reply_markup,
    });
  });

  bot.action(/^product:delete:(\d+)$/, async (ctx) => {
    if (!isAdminCtx(ctx)) return ctx.answerCbQuery();
    productsModel.remove(Number(ctx.match[1]));
    await ctx.answerCbQuery('Удалено');
    return ctx.editMessageText('🗑 Товар удалён.');
  });

  // --- Add-product publish/cancel ------------------------------------------

  bot.action('addproduct:publish', async (ctx) => {
    if (!isAdminCtx(ctx)) return ctx.answerCbQuery();
    const session = sessions.get(ctx.from.id);
    if (!session || session.step !== 'confirm') return ctx.answerCbQuery();
    const product = productsModel.create(session.data);
    sessions.delete(ctx.from.id);
    // Сразу убираем кнопки с превью, чтобы повторный тап по "Опубликовать"
    // не выглядел рабочим — на всякий случай, основная защита от дублей на
    // уровне БД (products.create игнорирует повторы по имени за 10 секунд).
    await ctx.editMessageReplyMarkup(undefined).catch(() => {});
    await ctx.answerCbQuery('Опубликовано');
    return ctx.replyWithHTML(`✅ Товар «${product.name}» опубликован в каталоге.`);
  });

  bot.action('addproduct:cancel', (ctx) => {
    if (!isAdminCtx(ctx)) return ctx.answerCbQuery();
    sessions.delete(ctx.from.id);
    ctx.answerCbQuery('Отменено');
    return ctx.reply('Добавление товара отменено.');
  });

  // --- Orders confirm/cancel (also triggered from order-created notifications) --

  // Карточка заказа в чате всегда переписывается на актуальную (полные детали +
  // новый статус + доступные дальше кнопки), а не стирается коротким текстом —
  // иначе адрес ПВЗ и реквизиты пропадали бы из вида сразу после подтверждения.
  async function refreshOrderMessage(ctx, order, user) {
    await ctx
      .editMessageText(renderOrderText(order, user), {
        parse_mode: 'HTML',
        reply_markup: orderActionsKeyboard(order),
      })
      .catch(() => {});
  }

  bot.action(/^confirm_order:(\d+)$/, async (ctx) => {
    if (!isAdminCtx(ctx)) return ctx.answerCbQuery();
    const id = Number(ctx.match[1]);
    const existing = ordersModel.getById(id);
    if (!existing) return ctx.answerCbQuery('Заказ не найден');
    if (existing.status !== 'pending') return ctx.answerCbQuery('Уже обработан');

    const order = ordersModel.setStatus(id, 'paid');
    const user = usersModel.registerShirtPurchase(order.userId);
    await ctx.answerCbQuery('Оплата подтверждена');
    await refreshOrderMessage(ctx, order, user);

    const justUnlocked = user.bonus_unlocked && user.shirts_purchased === config.bonusThreshold;
    const bonusNote = justUnlocked
      ? `\n\n🎁 Поздравляем! Вам разблокирована скидка ${config.bonusPercent}% на будущие заказы.`
      : '';

    return ctx.telegram.sendMessage(
      user.telegram_id,
      `✅ Ваш заказ #${id} «${order.productName}» оплачен и принят в работу.${bonusNote}`,
    );
  });

  bot.action(/^cancel_order:(\d+)$/, async (ctx) => {
    if (!isAdminCtx(ctx)) return ctx.answerCbQuery();
    const id = Number(ctx.match[1]);
    const existing = ordersModel.getById(id);
    if (!existing) return ctx.answerCbQuery('Заказ не найден');
    if (existing.status !== 'pending') return ctx.answerCbQuery('Уже обработан');

    const order = ordersModel.setStatus(id, 'cancelled');
    await ctx.answerCbQuery('Заказ отменён');
    const user = usersModel.getById(order.userId);
    await refreshOrderMessage(ctx, order, user);

    return ctx.telegram.sendMessage(
      user.telegram_id,
      `❌ Ваш заказ #${id} «${order.productName}» отменён. Если это ошибка — напишите нам в клубе.`,
    );
  });

  bot.action(/^ship_order:(\d+)$/, async (ctx) => {
    if (!isAdminCtx(ctx)) return ctx.answerCbQuery();
    const id = Number(ctx.match[1]);
    const existing = ordersModel.getById(id);
    if (!existing) return ctx.answerCbQuery('Заказ не найден');
    if (existing.status !== 'paid') return ctx.answerCbQuery('Сначала подтвердите оплату');

    const order = ordersModel.setStatus(id, 'shipped');
    await ctx.answerCbQuery('Отмечено как отправлено');
    const user = usersModel.getById(order.userId);
    await refreshOrderMessage(ctx, order, user);

    return ctx.telegram.sendMessage(user.telegram_id, `📦 Ваш заказ #${id} «${order.productName}» отправлен.`);
  });

  bot.action(/^receive_order:(\d+)$/, async (ctx) => {
    if (!isAdminCtx(ctx)) return ctx.answerCbQuery();
    const id = Number(ctx.match[1]);
    const existing = ordersModel.getById(id);
    if (!existing) return ctx.answerCbQuery('Заказ не найден');
    if (existing.status !== 'shipped') return ctx.answerCbQuery('Заказ ещё не отправлен');

    const order = ordersModel.setStatus(id, 'received');
    await ctx.answerCbQuery('Отмечено как получено');
    const user = usersModel.getById(order.userId);
    await refreshOrderMessage(ctx, order, user);

    return ctx.telegram.sendMessage(
      user.telegram_id,
      `📬 Заказ #${id} «${order.productName}» отмечен как полученный. Спасибо за покупку!`,
    );
  });

  // --- Multi-step dialog input (text / photo) -------------------------------

  bot.on('photo', async (ctx, next) => {
    if (!isAdminCtx(ctx)) return next();
    const session = sessions.get(ctx.from.id);
    if (!session) return next();

    if (session.step === 'broadcast_content') {
      const photos = ctx.message.photo;
      const fileId = photos[photos.length - 1].file_id;
      session.data = { photoFileId: fileId, text: ctx.message.caption || '' };
      session.step = 'broadcast_confirm';
      sessions.set(ctx.from.id, session);
      const total = usersModel.listAll().length;
      return ctx.replyWithPhoto(fileId, {
        caption: session.data.text || undefined,
        reply_markup: broadcastConfirmKeyboard(total),
      });
    }

    if (session.step !== 'color_photos' || !session.currentColor) return next();

    const photos = ctx.message.photo;
    const fileId = photos[photos.length - 1].file_id;
    session.currentColor.photos.push(fileId);
    sessions.set(ctx.from.id, session);
    return ctx.reply(
      `Фото добавлено (${session.currentColor.photos.length}) для цвета «${session.currentColor.name}». ` +
        'Пришлите ещё, или /nextcolor — следующий цвет, или /done — закончить.',
    );
  });

  bot.on('text', async (ctx, next) => {
    if (!isAdminCtx(ctx)) return next();
    const session = sessions.get(ctx.from.id);
    if (!session) return next();

    const text = ctx.message.text.trim();
    if (text.startsWith('/')) return next(); // не перехватываем другие команды в середине диалога

    switch (session.step) {
      case 'broadcast_content': {
        session.data = { text, photoFileId: null };
        session.step = 'broadcast_confirm';
        sessions.set(ctx.from.id, session);
        const total = usersModel.listAll().length;
        return ctx.reply(`Предпросмотр рассылки:\n\n${text}`, { reply_markup: broadcastConfirmKeyboard(total) });
      }

      case 'name':
        session.data.name = text;
        session.step = 'description';
        sessions.set(ctx.from.id, session);
        return ctx.reply('Введите описание товара:');

      case 'description':
        session.data.description = text;
        session.step = 'price';
        sessions.set(ctx.from.id, session);
        return ctx.reply('Введите цену в рублях (число):');

      case 'price': {
        const price = parseInt(text.replace(/\D/g, ''), 10);
        if (!price) return ctx.reply('Введите цену числом, например 1490.');
        session.data.price = price;
        session.step = 'sizes';
        sessions.set(ctx.from.id, session);
        return ctx.reply('Введите размеры через запятую, например: S, M, L, XL');
      }

      case 'sizes':
        session.data.sizes = text
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        session.data.colors = [];
        sessions.set(ctx.from.id, session);
        return askColorName(ctx, session);

      case 'color_name':
        session.currentColor = { name: text, photos: [] };
        session.step = 'color_photos';
        sessions.set(ctx.from.id, session);
        return ctx.reply(
          `Пришлите фото для цвета «${text}». Когда закончите — /nextcolor (если есть ещё цвета) ` +
            `или /done (если цветов больше нет).\n\n${PHOTO_SIZE_HINT}`,
        );

      case 'edit_field': {
        const ok = await applyFieldEdit(ctx, session, text);
        if (ok) sessions.delete(ctx.from.id);
        return;
      }

      default:
        return next();
    }
  });
}

module.exports = { register };
