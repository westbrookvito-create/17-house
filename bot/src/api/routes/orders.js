const express = require('express');
const { requireTelegramAuth } = require('../middleware/auth');
const productsModel = require('../../models/products');
const ordersModel = require('../../models/orders');
const config = require('../../config');
const bot = require('../../bot/instance');

const router = express.Router();
router.use(requireTelegramAuth);

const DELIVERY_METHODS = Object.keys(config.deliveryMethods);

function pickPaymentRequisite() {
  const list = config.paymentRequisites;
  return list[Math.floor(Math.random() * list.length)];
}

router.get('/', (req, res) => {
  res.json({ orders: ordersModel.listByUser(req.dbUser.id) });
});

router.post('/', async (req, res) => {
  const { productId, size, color, deliveryMethod, recipientName, phone, pvzAddress } = req.body || {};
  const product = productsModel.getById(Number(productId));

  if (!product || !product.active) {
    return res.status(404).json({ error: 'product_not_found' });
  }
  if (product.sizes.length && !product.sizes.includes(size)) {
    return res.status(400).json({ error: 'invalid_size' });
  }
  const requiresColor = product.colors.some((c) => c.name);
  if (requiresColor && !product.colors.some((c) => c.name === color)) {
    return res.status(400).json({ error: 'invalid_color' });
  }
  if (!DELIVERY_METHODS.includes(deliveryMethod)) {
    return res.status(400).json({ error: 'invalid_delivery_method' });
  }
  // Яндекс Доставка сама запрашивает получателя при оформлении, поэтому
  // ФИО не нужно; для остальных способов (например СДЭК) оно обязательно.
  const needsRecipientName = deliveryMethod !== 'yandex';
  if ((needsRecipientName && !recipientName?.trim()) || !phone?.trim() || !pvzAddress?.trim()) {
    return res.status(400).json({ error: 'missing_delivery_details' });
  }

  const user = req.dbUser;
  const discountPercent = user.bonus_unlocked ? config.bonusPercent : 0;
  const basePrice = product.price;
  const price = Math.round(basePrice * (1 - discountPercent / 100));
  const payment = pickPaymentRequisite();

  const order = ordersModel.create({
    userId: user.id,
    productId: product.id,
    productName: product.name,
    color: requiresColor ? color : null,
    size: size || null,
    basePrice,
    price,
    discountPercent,
    deliveryMethod,
    recipientName: needsRecipientName ? recipientName.trim() : null,
    phone: phone.trim(),
    pvzAddress: pvzAddress.trim(),
    payment,
  });

  res.json({ order });

  // Админ узнаёт о заказе только вместе с чеком (см. POST /:id/receipt ниже) —
  // так фото оплаты и информация о заказе всегда приходят одним сообщением,
  // а не отдельно и не рискуют разъехаться, если чек не отправится или задержится.
});

// Клиент прикладывает скриншот перевода после оплаты — это и есть момент,
// когда админ впервые узнаёт о заказе: чек уходит одним сообщением, фото
// сверху, вся информация о заказе — подписью под ним, с кнопками подтверждения.
router.post('/:id/receipt', async (req, res) => {
  const order = ordersModel.getById(Number(req.params.id));
  if (!order || order.userId !== req.dbUser.id) {
    return res.status(404).json({ error: 'order_not_found' });
  }

  const { imageBase64 } = req.body || {};
  const match = /^data:image\/(png|jpe?g|webp);base64,(.+)$/.exec(imageBase64 || '');
  if (!match) {
    return res.status(400).json({ error: 'invalid_receipt_image' });
  }

  const buffer = Buffer.from(match[2], 'base64');
  const user = req.dbUser;
  const { text, reply_markup } = buildOrderNotification(order, user);

  try {
    for (const adminId of config.adminIds) {
      // eslint-disable-next-line no-await-in-loop
      await bot.telegram.sendPhoto(adminId, { source: buffer }, { caption: text, parse_mode: 'HTML', reply_markup });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[orders] receipt forward failed', err.message);
    res.status(502).json({ error: 'receipt_forward_failed' });
  }
});

function formatOrderDetails(order) {
  const discountLine = order.discountPercent
    ? `\n🎁 Скидка участника: ${order.discountPercent}% (${order.basePrice} → ${order.price} ₽)`
    : '';
  const deliveryLabel = config.deliveryMethods[order.deliveryMethod] || order.deliveryMethod || '—';

  return (
    `Товар: ${order.productName}\n` +
    (order.color ? `Цвет: ${order.color}\n` : '') +
    `Размер: ${order.size || '—'}\n` +
    `Сумма: ${order.price} ₽${discountLine}\n\n` +
    `🚚 Доставка: ${deliveryLabel}\n` +
    (order.recipientName ? `ФИО получателя: ${order.recipientName}\n` : '') +
    `Телефон: ${order.phone}\n` +
    `Адрес ПВЗ: ${order.pvzAddress}\n\n` +
    `💳 Реквизиты, показанные клиенту:\n` +
    `${order.payment.phone} — ${order.payment.name}, ${order.payment.bank}`
  );
}

function buildOrderNotification(order, user) {
  const displayName = user.username ? `@${user.username}` : user.first_name || `id${user.telegram_id}`;

  const text =
    `🧾 <b>Новый заказ #${order.id}</b>\n` +
    `От: ${displayName} (карта #${user.member_code})\n\n` +
    `${formatOrderDetails(order)}\n\n` +
    `Ожидает оплаты.`;

  return {
    text,
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Подтвердить оплату', callback_data: `confirm_order:${order.id}` },
          { text: '❌ Отменить', callback_data: `cancel_order:${order.id}` },
        ],
      ],
    },
  };
}

module.exports = router;
module.exports.formatOrderDetails = formatOrderDetails;
