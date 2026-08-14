const { Markup } = require('telegraf');
const config = require('../config');

function openAppKeyboard() {
  if (!config.webappUrl) {
    return Markup.inlineKeyboard([]);
  }
  return Markup.inlineKeyboard([Markup.button.webApp('🏛 Открыть 17 House', config.webappUrl)]);
}

function adminMenuKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('➕ Добавить товар', 'admin:add_product')],
    [Markup.button.callback('📦 Товары', 'admin:list_products')],
    [Markup.button.callback('🧾 Заказы', 'admin:list_orders')],
  ]);
}

module.exports = { openAppKeyboard, adminMenuKeyboard };
