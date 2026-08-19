const { Markup } = require('telegraf');
const config = require('../config');

const MANAGER_USERNAME = 'house17manager';

function openAppKeyboard() {
  const rows = [];
  if (config.webappUrl) {
    rows.push([Markup.button.webApp('🏛 Открыть 17 House', config.webappUrl)]);
  }
  rows.push([Markup.button.url('❓ Задать вопрос', `https://t.me/${MANAGER_USERNAME}`)]);
  return Markup.inlineKeyboard(rows);
}

function adminMenuKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('➕ Добавить товар', 'admin:add_product')],
    [Markup.button.callback('📦 Товары', 'admin:list_products')],
    [Markup.button.callback('🧾 Заказы', 'admin:list_orders')],
    [Markup.button.callback('📄 Экспорт заказов (CSV)', 'admin:export_orders')],
    [Markup.button.callback('📢 Рассылка всем', 'admin:broadcast')],
    [Markup.button.callback('👥 Все пользователи', 'admin:list_users')],
    [Markup.button.callback('🏅 Участники клуба', 'admin:list_members')],
    [Markup.button.callback('📊 Статистика за месяц', 'admin:stats_month')],
  ]);
}

module.exports = { openAppKeyboard, adminMenuKeyboard };
