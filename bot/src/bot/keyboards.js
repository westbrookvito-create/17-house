const { Markup } = require('telegraf');
const config = require('../config');

function openAppKeyboard() {
  const rows = [];
  if (config.webappUrl) {
    rows.push([Markup.button.webApp('🏛 Открыть 17 House', config.webappUrl)]);
  }
  rows.push([Markup.button.callback('📏 Узнать размер', 'size_chart')]);
  return Markup.inlineKeyboard(rows);
}

function adminMenuKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('➕ Добавить товар', 'admin:add_product')],
    [Markup.button.callback('📦 Товары', 'admin:list_products')],
    [Markup.button.callback('🧾 Заказы', 'admin:list_orders')],
  ]);
}

module.exports = { openAppKeyboard, adminMenuKeyboard };
