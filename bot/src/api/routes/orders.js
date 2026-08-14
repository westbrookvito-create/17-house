const express = require('express');
const { requireTelegramAuth } = require('../middleware/auth');
const productsModel = require('../../models/products');
const ordersModel = require('../../models/orders');
const config = require('../../config');
const bot = require('../../bot/instance');

const router = express.Router();
router.use(requireTelegramAuth);

router.get('/', (req, res) => {
  res.json({ orders: ordersModel.listByUser(req.dbUser.id) });
});

router.post('/', async (req, res) => {
  const { productId, color, size } = req.body || {};
  const product = productsModel.getById(Number(productId));

  if (!product || !product.active) {
    return res.status(404).json({ error: 'product_not_found' });
  }
  if (product.sizes.length && !product.sizes.includes(size)) {
    return res.status(400).json({ error: 'invalid_size' });
  }
  if (product.colors.length && !product.colors.some((c) => c.name === color)) {
    return res.status(400).json({ error: 'invalid_color' });
  }

  const user = req.dbUser;
  const discountPercent = user.bonus_unlocked ? config.bonusPercent : 0;
  const basePrice = product.price;
  const price = Math.round(basePrice * (1 - discountPercent / 100));

  const order = ordersModel.create({
    userId: user.id,
    productId: product.id,
    productName: product.name,
    color: color || null,
    size: size || null,
    basePrice,
    price,
    discountPercent,
  });

  res.json({ order });

  notifyAdmins(order, user).catch((err) => console.error('[orders] admin notify failed', err.message));
});

async function notifyAdmins(order, user) {
  const displayName = user.username ? `@${user.username}` : user.first_name || `id${user.telegram_id}`;
  const discountLine = order.discountPercent
    ? `\n🎁 Скидка участника: ${order.discountPercent}% (${order.basePrice} → ${order.price} ₽)`
    : '';

  const text =
    `🧾 <b>Новый заказ #${order.id}</b>\n` +
    `От: ${displayName} (карта #${user.member_code})\n` +
    `Товар: ${order.productName}\n` +
    `Цвет: ${order.color || '—'}, размер: ${order.size || '—'}\n` +
    `Сумма: ${order.price} ₽${discountLine}\n\n` +
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
