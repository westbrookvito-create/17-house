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
  if (!recipientName?.trim() || !phone?.trim() || !pvzAddress?.trim()) {
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
    recipientName: recipientName.trim(),
    phone: phone.trim(),
    pvzAddress: pvzAddress.trim(),
    payment,
  });

  res.json({ order });

  notifyAdmins(order, user).catch((err) => console.error('[orders] admin notify failed', err.message));
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
    `ФИО получателя: ${order.recipientName}\n` +
    `Телефон: ${order.phone}\n` +
    `Адрес ПВЗ: ${order.pvzAddress}\n\n` +
    `💳 Реквизиты, показанные клиенту:\n` +
    `${order.payment.phone} — ${order.payment.name}, ${order.payment.bank}`
  );
}

async function notifyAdmins(order, user) {
  const displayName = user.username ? `@${user.username}` : user.first_name || `id${user.telegram_id}`;

  const text =
    `🧾 <b>Новый заказ #${order.id}</b>\n` +
    `От: ${displayName} (карта #${user.member_code})\n\n` +
    `${formatOrderDetails(order)}\n\n` +
    `Ожидает оплаты.`;

  for (const adminId of config.adminIds) {
    await bot.telegram.sendMessage(adminId, text, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Подтвердить оплату', callback_data: `confirm_order:${order.id}` },
            { text: '❌ Отменить', callback_data: `cancel_order:${order.id}` },
          ],
        ],
      },
    });
  }
}

module.exports = router;
module.exports.formatOrderDetails = formatOrderDetails;
