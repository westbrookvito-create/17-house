const STATUS_LABELS_PLAIN = {
  pending: 'Ожидает оплаты',
  paid: 'Оплачен',
  shipped: 'Отправлен',
  received: 'Получен',
  cancelled: 'Отменён',
};

const HEADERS = [
  'ID',
  'Дата создания',
  'Статус',
  'Товар',
  'Цвет',
  'Размер',
  'Цена база',
  'Цена',
  'Скидка %',
  'Способ доставки',
  'Получатель',
  'Телефон',
  'Адрес ПВЗ',
  'Оплачен',
  'Отправлен',
  'Получен',
  'Участник',
  'Username',
  'Telegram ID',
  'Карта участника',
];

function csvEscape(value) {
  const str = value === null || value === undefined ? '' : String(value);
  if (/["\n,]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// CSV, а не настоящий .xlsx — открывается в Excel/Google Таблицах как
// обычная таблица без дополнительных зависимостей и без рисков, связанных
// с известными уязвимостями npm-пакетов для чтения/записи .xlsx.
function buildOrdersCsv(orders, usersModel) {
  const lines = [HEADERS.map(csvEscape).join(',')];

  for (const o of orders) {
    const user = usersModel.getById(o.userId);
    const row = [
      o.id,
      o.createdAt,
      STATUS_LABELS_PLAIN[o.status] || o.status,
      o.productName,
      o.color || '',
      o.size || '',
      o.basePrice,
      o.price,
      o.discountPercent,
      o.deliveryMethod || '',
      o.recipientName || '',
      o.phone || '',
      o.pvzAddress || '',
      o.paidAt || '',
      o.shippedAt || '',
      o.receivedAt || '',
      user ? user.first_name || '' : '',
      user && user.username ? `@${user.username}` : '',
      user ? user.telegram_id : '',
      user ? user.member_code : '',
    ];
    lines.push(row.map(csvEscape).join(','));
  }

  // BOM — чтобы Excel сразу распознал кодировку UTF-8 и кириллица не превратилась в кракозябры.
  return '﻿' + lines.join('\r\n');
}

module.exports = { buildOrdersCsv };
