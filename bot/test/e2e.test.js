// Full backend regression check — exercises the real Telegraf update
// dispatcher (not hand-simulated handlers) plus the Express API, against a
// throwaway SQLite database. Run with `npm test`.
//
// Covers: user registration + member codes, admin product wizard (create,
// edit, hide/show, delete), the full order lifecycle (create → notify admin
// → confirm/cancel → notify buyer), bonus threshold + discount, receipt
// upload, idempotent order confirmation, and the contact-manager message
// relay.

process.env.BOT_TOKEN = 'test:token';
process.env.ADMIN_IDS = '999999';
process.env.CORS_ORIGIN = '*';
process.env.DEV_ALLOW_INSECURE = '1';
process.env.BONUS_THRESHOLD = '3';
process.env.BONUS_PERCENT = '10';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const dbPath = path.join(os.tmpdir(), `17house-e2e-${Date.now()}.db`);
process.env.DB_PATH = dbPath;

const ADMIN_ID = 999999;
const USER_ID = 555555;
const USER2_ID = 666666;

const bot = require('../src/bot');
const usersModel = require('../src/models/users');
const productsModel = require('../src/models/products');
const ordersModel = require('../src/models/orders');
const { createServer } = require('../src/api/server');
const config = require('../src/config');

function deliveryFields(overrides = {}) {
  return {
    deliveryMethod: 'cdek',
    recipientName: 'Иван Иванов',
    phone: '+7 900 000 00 00',
    pvzAddress: 'Москва, ул. Тестовая, д. 1, ПВЗ СДЭК',
    color: 'Navy',
    ...overrides,
  };
}

// Telegraf creates a *new* Telegram client instance per incoming update
// (see Telegraf#handleUpdate), so patching bot.telegram alone isn't enough —
// patch the shared prototype so every instance is intercepted, and no real
// network call ever leaves the process.
const ApiClient = require('../node_modules/telegraf/lib/core/network/client.js').default;
const apiCalls = [];
ApiClient.prototype.callApi = async function callApi(method, payload) {
  apiCalls.push({ method, payload });
  switch (method) {
    case 'getMe':
      return { id: 0, is_bot: true, first_name: '17 House Bot', username: 'house17_test_bot' };
    case 'sendMessage':
      return { message_id: apiCalls.length, chat: { id: payload.chat_id }, date: 0, text: payload.text || '' };
    case 'forwardMessage':
      return { message_id: apiCalls.length, chat: { id: payload.chat_id }, date: 0 };
    case 'answerCallbackQuery':
      return true;
    case 'editMessageText':
      return { message_id: 1, chat: { id: 1 }, date: 0, text: payload.text || '' };
    case 'getFile':
      return { file_id: payload.file_id, file_unique_id: 'x', file_path: 'photos/fake.jpg' };
    case 'sendDocument':
      return { message_id: apiCalls.length, chat: { id: payload.chat_id }, date: 0, document: { file_id: 'doc' } };
    default:
      return {};
  }
};

let updateId = 1;
let messageId = 1;

function baseFrom(id, opts = {}) {
  return { id, is_bot: false, first_name: opts.first_name || 'Test', username: opts.username, language_code: 'ru' };
}

async function sendText(fromId, text, opts = {}) {
  const message = {
    message_id: messageId++,
    from: baseFrom(fromId, opts),
    chat: { id: fromId, type: 'private' },
    date: Math.floor(Date.now() / 1000),
    text,
  };
  if (text.startsWith('/')) {
    const len = text.includes(' ') ? text.indexOf(' ') : text.length;
    message.entities = [{ offset: 0, length: len, type: 'bot_command' }];
  }
  await bot.handleUpdate({ update_id: updateId++, message });
}

async function sendPhoto(fromId, fileId, opts = {}) {
  const message = {
    message_id: messageId++,
    from: baseFrom(fromId, opts),
    chat: { id: fromId, type: 'private' },
    date: Math.floor(Date.now() / 1000),
    photo: [
      { file_id: `${fileId}_small`, file_unique_id: 'a', width: 90, height: 90 },
      { file_id: `${fileId}_large`, file_unique_id: 'b', width: 800, height: 800 },
    ],
  };
  if (opts.caption) message.caption = opts.caption;
  await bot.handleUpdate({ update_id: updateId++, message });
}

async function sendCallback(fromId, data, opts = {}) {
  const callback_query = {
    id: String(updateId),
    from: baseFrom(fromId, opts),
    message: {
      message_id: messageId++,
      chat: { id: fromId, type: 'private' },
      date: Math.floor(Date.now() / 1000),
      text: 'placeholder',
    },
    chat_instance: 'x',
    data,
  };
  await bot.handleUpdate({ update_id: updateId++, callback_query });
}

function lastMessageTo(chatId) {
  // config.adminIds are strings (parsed from ADMIN_IDS), ctx.chat.id here is
  // numeric — Telegram accepts either, so compare as strings.
  const calls = apiCalls.filter((c) => c.method === 'sendMessage' && String(c.payload.chat_id) === String(chatId));
  return calls[calls.length - 1]?.payload.text;
}

function sentTextsSince(sinceIndex, chatId) {
  return apiCalls
    .slice(sinceIndex)
    .filter((c) => c.method === 'sendMessage' && String(c.payload.chat_id) === String(chatId))
    .map((c) => c.payload.text);
}

function lastEditedTextTo(chatId) {
  const calls = apiCalls.filter(
    (c) => c.method === 'editMessageText' && String(c.payload.chat_id) === String(chatId),
  );
  return calls[calls.length - 1]?.payload.text;
}

async function main() {
  console.log('== /start creates user + issues member card ==');
  await sendText(USER_ID, '/start');
  const user = usersModel.getByTelegramId(USER_ID);
  assert.ok(user, 'user should be created on /start');
  assert.ok(/^[A-Z]{6}$/.test(user.member_code), 'member_code should be 6 random uppercase letters');
  console.log('  OK member_code =', user.member_code);

  console.log('== admin is notified when a new user registers ==');
  const newUserNotice = lastMessageTo(ADMIN_ID);
  assert.ok(newUserNotice && newUserNotice.includes('Новый участник'), 'admin should be notified of the new user');
  assert.ok(newUserNotice.includes(String(USER_ID)), 'notification should include the telegram id');
  assert.ok(newUserNotice.includes(user.member_code), 'notification should include the member code');
  console.log('  OK admin notified of new registration');

  console.log('== a returning user does not trigger another registration notice ==');
  const beforeReturn = apiCalls.filter((c) => c.method === 'sendMessage' && String(c.payload.chat_id) === String(ADMIN_ID)).length;
  await sendText(USER_ID, '/start');
  const afterReturn = apiCalls.filter((c) => c.method === 'sendMessage' && String(c.payload.chat_id) === String(ADMIN_ID)).length;
  assert.strictEqual(afterReturn, beforeReturn, 'returning user must not renotify admin');
  console.log('  OK no duplicate notice for a returning user');

  console.log('== non-admin /admin is ignored ==');
  const before = apiCalls.length;
  await sendText(USER_ID, '/admin');
  assert.strictEqual(apiCalls.length, before, 'non-admin should get no response to /admin');
  console.log('  OK');

  console.log('== admin /admin opens panel ==');
  await sendText(ADMIN_ID, '/admin');
  assert.ok(lastMessageTo(ADMIN_ID).includes('Админ-панель'));
  console.log('  OK');

  console.log('== admin adds a product with two colors, each with its own photos ==');
  await sendCallback(ADMIN_ID, 'admin:add_product');
  await sendText(ADMIN_ID, 'House Every Weekend Tee');
  await sendText(ADMIN_ID, 'Плотный хлопок, вышитая эмблема.');
  await sendText(ADMIN_ID, '3200');
  await sendText(ADMIN_ID, 'S, M, L, XL');
  await sendText(ADMIN_ID, 'Navy');
  await sendPhoto(ADMIN_ID, 'fileNavy1');
  await sendPhoto(ADMIN_ID, 'fileNavy2');
  await sendText(ADMIN_ID, '/nextcolor');
  await sendText(ADMIN_ID, 'Beige');
  await sendPhoto(ADMIN_ID, 'fileBeige1');
  await sendText(ADMIN_ID, '/done');
  assert.ok(lastMessageTo(ADMIN_ID).includes('Предпросмотр'), 'should show preview before publish');
  await sendCallback(ADMIN_ID, 'addproduct:publish');
  assert.ok(lastMessageTo(ADMIN_ID).includes('опубликован'));

  const products = productsModel.listActive();
  assert.strictEqual(products.length, 1);
  const product = products[0];
  assert.strictEqual(product.name, 'House Every Weekend Tee');
  assert.strictEqual(product.price, 3200);
  assert.deepStrictEqual(product.sizes, ['S', 'M', 'L', 'XL']);
  assert.strictEqual(product.colors.length, 2);
  assert.strictEqual(product.colors[0].name, 'Navy');
  assert.deepStrictEqual(product.colors[0].photos, ['fileNavy1_large', 'fileNavy2_large']);
  assert.strictEqual(product.colors[1].name, 'Beige');
  assert.deepStrictEqual(product.colors[1].photos, ['fileBeige1_large']);
  console.log('  OK product created:', product.id, product.name, '2 colors (Navy, Beige)');

  console.log('== creating a product twice with the same name within 10s does not duplicate it ==');
  const beforeCount = productsModel.listAll().length;
  const dupeAttempt = productsModel.create({
    name: 'House Every Weekend Tee',
    description: 'Плотный хлопок, вышитая эмблема.',
    price: 3200,
    sizes: ['S', 'M', 'L', 'XL'],
    colors: product.colors,
  });
  assert.strictEqual(productsModel.listAll().length, beforeCount, 'no new row should be inserted');
  assert.strictEqual(dupeAttempt.id, product.id, 'duplicate create() should return the existing product');
  console.log('  OK duplicate create() within the guard window is a no-op');

  console.log('== admin edits price ==');
  await sendCallback(ADMIN_ID, `product:edit_price:${product.id}`);
  await sendText(ADMIN_ID, '2990');
  const updated = productsModel.getById(product.id);
  assert.strictEqual(updated.price, 2990);
  console.log('  OK new price =', updated.price);

  console.log('== admin toggles visibility off/on ==');
  await sendCallback(ADMIN_ID, `product:toggle:${product.id}`);
  assert.strictEqual(productsModel.getById(product.id).active, false);
  assert.strictEqual(productsModel.listActive().length, 0, 'hidden product should not be active-listed');
  await sendCallback(ADMIN_ID, `product:toggle:${product.id}`);
  assert.strictEqual(productsModel.getById(product.id).active, true);
  console.log('  OK toggle works, active catalog respects it');

  console.log('== admin creates + deletes a throwaway product ==');
  await sendCallback(ADMIN_ID, 'admin:add_product');
  await sendText(ADMIN_ID, 'Temp Product');
  await sendText(ADMIN_ID, 'temp');
  await sendText(ADMIN_ID, '100');
  await sendText(ADMIN_ID, 'M');
  await sendText(ADMIN_ID, 'Default');
  await sendPhoto(ADMIN_ID, 'fileTemp');
  await sendText(ADMIN_ID, '/done');
  await sendCallback(ADMIN_ID, 'addproduct:publish');
  const temp = productsModel.listAll().find((p) => p.name === 'Temp Product');
  assert.ok(temp);
  await sendCallback(ADMIN_ID, `product:delete_confirm:${temp.id}`);
  await sendCallback(ADMIN_ID, `product:delete:${temp.id}`);
  assert.strictEqual(productsModel.getById(temp.id), null);
  console.log('  OK delete works');

  // --- REST API used by the Mini App ---
  const app = createServer();
  const server = app.listen(0);
  const port = server.address().port;

  async function api(reqPath, opts = {}) {
    const res = await fetch(`http://127.0.0.1:${port}${reqPath}`, opts);
    let body = null;
    try {
      body = await res.json();
    } catch {
      /* no body */
    }
    return { status: res.status, body };
  }

  function authHeaders(id) {
    return { 'X-Debug-User-Id': String(id), 'Content-Type': 'application/json' };
  }

  console.log('== unauthenticated request is rejected ==');
  const unauth = await api('/api/products');
  assert.strictEqual(unauth.status, 401);
  console.log('  OK 401 without auth');

  console.log('== bonus starts locked, 0 shirts purchased ==');
  let bonusCheck = await api('/api/profile/bonus', { headers: authHeaders(USER_ID) });
  assert.strictEqual(bonusCheck.body.unlocked, false);
  assert.strictEqual(bonusCheck.body.shirtsPurchased, 0);
  console.log('  OK unlocked=false, shirtsPurchased=0');

  console.log('== Яндекс Доставка does not require ФИО, СДЭК does ==');
  const yandexNoName = await api('/api/orders', {
    method: 'POST',
    headers: authHeaders(USER_ID),
    body: JSON.stringify({
      productId: product.id,
      size: 'M',
      color: 'Navy',
      deliveryMethod: 'yandex',
      phone: '+7 900 000 00 00',
      pvzAddress: 'Москва, ПВЗ Яндекс',
    }),
  });
  assert.strictEqual(yandexNoName.status, 200, 'Yandex delivery should not require recipientName');
  assert.strictEqual(yandexNoName.body.order.recipientName, null);
  console.log('  OK yandex order created without ФИО');

  const cdekNoName = await api('/api/orders', {
    method: 'POST',
    headers: authHeaders(USER_ID),
    body: JSON.stringify({
      productId: product.id,
      size: 'M',
      color: 'Navy',
      deliveryMethod: 'cdek',
      phone: '+7 900 000 00 00',
      pvzAddress: 'Москва, ПВЗ СДЭК',
    }),
  });
  assert.strictEqual(cdekNoName.status, 400, 'СДЭК should still require recipientName');
  assert.strictEqual(cdekNoName.body.error, 'missing_delivery_details');
  console.log('  OK cdek order without ФИО is rejected');

  console.log('== invalid order rejected (bad size) ==');
  const badOrder = await api('/api/orders', {
    method: 'POST',
    headers: authHeaders(USER_ID),
    body: JSON.stringify({ productId: product.id, size: 'XXXXL', ...deliveryFields() }),
  });
  assert.strictEqual(badOrder.status, 400);
  console.log('  OK 400 invalid_size');

  console.log('== invalid order rejected (bad delivery method) ==');
  const badDelivery = await api('/api/orders', {
    method: 'POST',
    headers: authHeaders(USER_ID),
    body: JSON.stringify({
      productId: product.id,
      size: 'M',
      ...deliveryFields({ deliveryMethod: 'pigeon-post' }),
    }),
  });
  assert.strictEqual(badDelivery.status, 400);
  assert.strictEqual(badDelivery.body.error, 'invalid_delivery_method');
  console.log('  OK 400 invalid_delivery_method');

  console.log('== invalid order rejected (missing recipient details) ==');
  const missingDetails = await api('/api/orders', {
    method: 'POST',
    headers: authHeaders(USER_ID),
    body: JSON.stringify({
      productId: product.id,
      size: 'M',
      ...deliveryFields({ pvzAddress: '   ' }),
    }),
  });
  assert.strictEqual(missingDetails.status, 400);
  assert.strictEqual(missingDetails.body.error, 'missing_delivery_details');
  console.log('  OK 400 missing_delivery_details');

  console.log('== invalid order rejected (unknown color) ==');
  const badColor = await api('/api/orders', {
    method: 'POST',
    headers: authHeaders(USER_ID),
    body: JSON.stringify({ productId: product.id, size: 'M', ...deliveryFields({ color: 'Purple' }) }),
  });
  assert.strictEqual(badColor.status, 400);
  assert.strictEqual(badColor.body.error, 'invalid_color');
  console.log('  OK 400 invalid_color');

  console.log('== place 3 real orders and confirm each via admin action ==');
  const validRequisiteKeys = config.paymentRequisites.map((r) => `${r.name}|${r.phone}|${r.bank}`);
  const paidOrderIds = [];
  for (let i = 0; i < 3; i++) {
    const created = await api('/api/orders', {
      method: 'POST',
      headers: authHeaders(USER_ID),
      body: JSON.stringify({
        productId: product.id,
        size: 'M',
        ...deliveryFields({ deliveryMethod: i % 2 === 0 ? 'cdek' : 'yandex' }),
      }),
    });
    const isYandex = i % 2 === 1;
    assert.strictEqual(created.status, 200);
    const orderId = created.body.order.id;
    assert.strictEqual(created.body.order.status, 'pending');
    assert.strictEqual(created.body.order.color, 'Navy');
    assert.strictEqual(created.body.order.recipientName, isYandex ? null : 'Иван Иванов');
    assert.strictEqual(created.body.order.pvzAddress, 'Москва, ул. Тестовая, д. 1, ПВЗ СДЭК');
    const { payment } = created.body.order;
    assert.ok(
      validRequisiteKeys.includes(`${payment.name}|${payment.phone}|${payment.bank}`),
      'assigned payment requisite must be one of the configured 3',
    );

    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 30)); // let the fire-and-forget admin notification run
    const notifyText = lastMessageTo(ADMIN_ID);
    assert.ok(notifyText && notifyText.includes(`заказ #${orderId}`), 'admin should be notified of new order');
    assert.ok(notifyText.includes('Цвет: Navy'), 'admin notification must include the chosen color');
    if (isYandex) {
      assert.ok(!notifyText.includes('ФИО получателя:'), 'yandex order notification should omit ФИО entirely');
    } else {
      assert.ok(notifyText.includes('ФИО получателя: Иван Иванов'), 'admin notification must include recipient name');
    }
    assert.ok(notifyText.includes('Телефон: +7 900 000 00 00'), 'admin notification must include phone');
    assert.ok(notifyText.includes('Адрес ПВЗ:'), 'admin notification must include pickup address');
    assert.ok(notifyText.includes(payment.phone), 'admin notification must include the assigned payment requisite');

    // eslint-disable-next-line no-await-in-loop
    await sendCallback(ADMIN_ID, `confirm_order:${orderId}`);
    assert.strictEqual(ordersModel.getById(orderId).status, 'paid');
    const buyerNotice = lastMessageTo(USER_ID);
    assert.ok(buyerNotice.includes('оплачен'), 'buyer should get paid confirmation');
    if (i === 2) assert.ok(buyerNotice.includes('разблокирована'), 'bonus unlock note expected on 3rd');
    paidOrderIds.push(orderId);
  }
  console.log('  OK 3 orders placed + confirmed, notifications include delivery + payment info');

  console.log('== confirming an order keeps its full details visible (does not wipe them) ==');
  const confirmedEditText = lastEditedTextTo(ADMIN_ID);
  assert.ok(confirmedEditText.includes('✅ Оплачен'), 'edited message should show the new status label');
  assert.ok(confirmedEditText.includes('ФИО получателя: Иван Иванов'), 'recipient name must stay visible');
  assert.ok(confirmedEditText.includes('Адрес ПВЗ:'), 'pickup address must stay visible');
  console.log('  OK order details preserved after status change');

  console.log('== admin advances an order through shipped -> received, with guards ==');
  const trackedOrderId = paidOrderIds[0];
  await sendCallback(ADMIN_ID, `receive_order:${trackedOrderId}`);
  assert.strictEqual(
    ordersModel.getById(trackedOrderId).status,
    'paid',
    'cannot mark received before shipped',
  );

  await sendCallback(ADMIN_ID, `ship_order:${trackedOrderId}`);
  assert.strictEqual(ordersModel.getById(trackedOrderId).status, 'shipped');
  assert.ok(lastMessageTo(USER_ID).includes('отправлен'), 'buyer should be notified of shipping');
  const editedAfterShip = lastEditedTextTo(ADMIN_ID);
  assert.ok(editedAfterShip.includes('📦 Отправлен'));
  assert.ok(editedAfterShip.includes('Адрес ПВЗ:'), 'shipped card must still show pickup address');

  await sendCallback(ADMIN_ID, `ship_order:${trackedOrderId}`);
  assert.strictEqual(ordersModel.getById(trackedOrderId).status, 'shipped', 'double-ship must be a no-op');

  await sendCallback(ADMIN_ID, `receive_order:${trackedOrderId}`);
  assert.strictEqual(ordersModel.getById(trackedOrderId).status, 'received');
  assert.ok(lastMessageTo(USER_ID).includes('получен'), 'buyer should be notified of delivery');
  assert.ok(lastEditedTextTo(ADMIN_ID).includes('📬 Получен'));
  console.log('  OK shipped -> received flow works, skipping a step is blocked');

  console.log('== bonus unlocked after 3rd purchase, discount applied on next order ==');
  const bonus = await api('/api/profile/bonus', { headers: authHeaders(USER_ID) });
  assert.strictEqual(bonus.body.unlocked, true);
  assert.strictEqual(bonus.body.shirtsPurchased, 3);

  const discounted = await api('/api/orders', {
    method: 'POST',
    headers: authHeaders(USER_ID),
    body: JSON.stringify({ productId: product.id, size: 'L', ...deliveryFields() }),
  });
  assert.strictEqual(discounted.body.order.discountPercent, 10);
  assert.strictEqual(discounted.body.order.basePrice, 2990);
  assert.strictEqual(discounted.body.order.price, Math.round(2990 * 0.9));
  console.log('  OK discounted order price =', discounted.body.order.price);

  console.log('== admin can cancel a pending order ==');
  const toCancel = await api('/api/orders', {
    method: 'POST',
    headers: authHeaders(USER2_ID),
    body: JSON.stringify({ productId: product.id, size: 'S', ...deliveryFields() }),
  });
  const cancelId = toCancel.body.order.id;
  await new Promise((r) => setTimeout(r, 30));
  await sendCallback(ADMIN_ID, `cancel_order:${cancelId}`);
  assert.strictEqual(ordersModel.getById(cancelId).status, 'cancelled');
  assert.ok(lastMessageTo(USER2_ID).includes('отменён'));
  console.log('  OK cancel flow works');

  console.log('== double-confirm does not duplicate buyer notification ==');
  await sendCallback(ADMIN_ID, `confirm_order:${discounted.body.order.id}`);
  assert.strictEqual(ordersModel.getById(discounted.body.order.id).status, 'paid');
  const sendCountBefore = apiCalls.filter((c) => c.method === 'sendMessage').length;
  await sendCallback(ADMIN_ID, `confirm_order:${discounted.body.order.id}`);
  const sendCountAfter = apiCalls.filter((c) => c.method === 'sendMessage').length;
  assert.strictEqual(sendCountAfter, sendCountBefore, 're-confirming a paid order must not send another message');
  console.log('  OK idempotent');

  console.log('== admin can browse the complete order history with status + delivery filters ==');
  await sendCallback(ADMIN_ID, 'admin:list_orders');
  assert.ok(lastMessageTo(ADMIN_ID).includes('Все заказы клуба'));

  await sendCallback(ADMIN_ID, 'orders:status:all');
  assert.ok(lastMessageTo(ADMIN_ID).includes('способ доставки'));

  async function assertFilterCount(status, deliveryMethod) {
    const expected = ordersModel.listFiltered({ status, deliveryMethod }).length;
    const sinceIndex = apiCalls.length;
    await sendCallback(ADMIN_ID, `orders:show:${status}:${deliveryMethod}`);
    const texts = sentTextsSince(sinceIndex, ADMIN_ID);
    assert.ok(
      texts.some((t) => t.includes(`Найдено заказов: ${expected}`)),
      `expected a "Найдено заказов: ${expected}" summary for status=${status} delivery=${deliveryMethod}`,
    );
    // every order that should match the filter must actually appear in the sent cards
    assert.strictEqual(texts.length, expected + (expected > 0 ? 1 : 0));
    return expected;
  }

  const totalOrders = await assertFilterCount('all', 'all');
  assert.ok(totalOrders >= 5, 'every order ever placed in this test should be counted');

  const cancelledCount = await assertFilterCount('cancelled', 'all');
  assert.strictEqual(cancelledCount, 1, 'exactly the earlier cancelled order should match this filter');

  const receivedCount = await assertFilterCount('received', 'all');
  assert.strictEqual(receivedCount, 1, 'exactly the order taken through ship -> receive should match');

  const cdekPaidCount = await assertFilterCount('paid', 'cdek');
  const yandexPaidCount = await assertFilterCount('paid', 'yandex');
  assert.notStrictEqual(cdekPaidCount, yandexPaidCount, 'delivery-method filter should actually narrow results');
  console.log('  OK filter menu returns correct counts for every status + delivery combination');

  console.log('== receipt upload forwards the photo to admins ==');
  const receiptOrderId = paidOrderIds[0];
  const tinyPngBase64 =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  const receiptRes = await api(`/api/orders/${receiptOrderId}/receipt`, {
    method: 'POST',
    headers: authHeaders(USER_ID),
    body: JSON.stringify({ imageBase64: tinyPngBase64 }),
  });
  assert.strictEqual(receiptRes.status, 200);
  const receiptPhotoCall = apiCalls.filter((c) => c.method === 'sendPhoto').slice(-1)[0];
  assert.ok(receiptPhotoCall, 'expected a sendPhoto call forwarding the receipt');
  assert.strictEqual(String(receiptPhotoCall.payload.chat_id), String(ADMIN_ID));
  assert.ok(receiptPhotoCall.payload.caption.includes(`#${receiptOrderId}`), 'caption should reference the order id');
  console.log('  OK receipt forwarded to admin with order caption');

  console.log('== receipt upload rejects invalid image data ==');
  const badReceipt = await api(`/api/orders/${receiptOrderId}/receipt`, {
    method: 'POST',
    headers: authHeaders(USER_ID),
    body: JSON.stringify({ imageBase64: 'not-an-image' }),
  });
  assert.strictEqual(badReceipt.status, 400);
  assert.strictEqual(badReceipt.body.error, 'invalid_receipt_image');
  console.log('  OK invalid receipt image rejected');

  console.log("== receipt upload rejects another user's order ==");
  const wrongUserReceipt = await api(`/api/orders/${receiptOrderId}/receipt`, {
    method: 'POST',
    headers: authHeaders(USER2_ID),
    body: JSON.stringify({ imageBase64: tinyPngBase64 }),
  });
  assert.strictEqual(wrongUserReceipt.status, 404);
  console.log('  OK cross-user receipt upload rejected');

  console.log('== admin can list all users ==');
  await sendCallback(ADMIN_ID, 'admin:list_users');
  const usersText = lastMessageTo(ADMIN_ID);
  assert.ok(usersText.includes('Все пользователи'));
  assert.ok(usersText.includes(user.member_code), 'the registered user should appear in the list');
  console.log('  OK users list shown');

  console.log('== admin can list club members (bought at least once) ==');
  await sendCallback(ADMIN_ID, 'admin:list_members');
  const membersText = lastMessageTo(ADMIN_ID);
  assert.ok(membersText.includes('Участники клуба'));
  assert.ok(membersText.includes(user.member_code), 'the buyer should be listed as a club member');
  console.log('  OK members list shown');

  console.log('== admin can view this month\'s sales stats ==');
  await sendCallback(ADMIN_ID, 'admin:stats_month');
  const statsText = lastMessageTo(ADMIN_ID);
  assert.ok(statsText.includes('Статистика продаж'));
  assert.ok(statsText.includes('Выручка'));
  console.log('  OK month stats shown');

  console.log('== admin can export all orders as CSV ==');
  const beforeExport = apiCalls.length;
  await sendCallback(ADMIN_ID, 'admin:export_orders');
  const exportCall = apiCalls.slice(beforeExport).find((c) => c.method === 'sendDocument');
  assert.ok(exportCall, 'expected a sendDocument call');
  assert.ok(/^orders-\d{4}-\d{2}-\d{2}\.csv$/.test(exportCall.payload.document.filename), 'filename should be dated orders-YYYY-MM-DD.csv');
  const csvText = exportCall.payload.document.source.toString('utf8');
  assert.ok(csvText.includes('ID,Дата создания,Статус,Товар'), 'CSV should start with the expected header row');
  assert.ok(csvText.includes('House Every Weekend Tee'), 'CSV should include the product name from a real order');
  assert.ok(csvText.includes(user.member_code), "CSV should include the buyer's member code");
  console.log('  OK CSV export contains header + real order rows');

  console.log('== admin can broadcast a text message to all users ==');
  await sendCallback(ADMIN_ID, 'admin:broadcast');
  await sendText(ADMIN_ID, 'Внимание! Новая коллекция уже в каталоге.');
  assert.ok(lastMessageTo(ADMIN_ID).includes('Предпросмотр рассылки'));
  const allUsersCount = usersModel.listAll().length;
  const beforeBroadcastMsgs = apiCalls.filter((c) => c.method === 'sendMessage').length;
  await sendCallback(ADMIN_ID, 'broadcast:send');
  const afterBroadcastMsgs = apiCalls.filter((c) => c.method === 'sendMessage').length;
  assert.strictEqual(
    afterBroadcastMsgs - beforeBroadcastMsgs,
    allUsersCount + 1,
    'should message every registered user plus the admin completion summary',
  );
  assert.ok(lastMessageTo(ADMIN_ID).includes('Рассылка завершена'));
  assert.ok(lastMessageTo(USER_ID).includes('Новая коллекция'));
  console.log('  OK broadcast text reached', allUsersCount, 'users');

  console.log('== admin can broadcast a photo with caption to all users ==');
  await sendCallback(ADMIN_ID, 'admin:broadcast');
  await sendPhoto(ADMIN_ID, 'broadcastPic', { caption: 'Скидка недели -15%' });
  const beforeBroadcastPhotos = apiCalls.filter((c) => c.method === 'sendPhoto').length;
  await sendCallback(ADMIN_ID, 'broadcast:send');
  const afterBroadcastPhotos = apiCalls.filter((c) => c.method === 'sendPhoto').length;
  assert.strictEqual(
    afterBroadcastPhotos - beforeBroadcastPhotos,
    allUsersCount,
    'photo broadcast should reach every registered user',
  );
  assert.ok(lastMessageTo(ADMIN_ID).includes('Рассылка завершена'));
  console.log('  OK broadcast photo reached', allUsersCount, 'users');

  console.log('== contact-manager relay forwards plain text to admin ==');
  const beforeForward = apiCalls.filter((c) => c.method === 'forwardMessage').length;
  await sendText(USER2_ID, 'Здравствуйте, вопрос по заказу');
  const afterForward = apiCalls.filter((c) => c.method === 'forwardMessage').length;
  assert.strictEqual(afterForward, beforeForward + 1);
  assert.ok(lastMessageTo(USER2_ID).includes('передано менеджеру'));
  console.log('  OK message forwarded + user acknowledged');

  console.log('== hidden product excluded from /api/products ==');
  await sendCallback(ADMIN_ID, `product:toggle:${product.id}`);
  const catalogHidden = await api('/api/products', { headers: authHeaders(USER_ID) });
  assert.strictEqual(catalogHidden.body.products.length, 0);
  await sendCallback(ADMIN_ID, `product:toggle:${product.id}`);
  const catalogShown = await api('/api/products', { headers: authHeaders(USER_ID) });
  assert.strictEqual(catalogShown.body.products.length, 1);
  console.log('  OK hide/show reflected in public catalog');

  console.log('== catalog exposes multiple photo URLs directly on the product ==');
  assert.deepStrictEqual(catalogShown.body.products[0].imageUrls, [
    '/api/products/image/fileNavy1_large',
    '/api/products/image/fileNavy2_large',
  ]);
  console.log('  OK imageUrls array present on the product itself');

  console.log('== catalog exposes per-color photo galleries for the swatch picker ==');
  assert.deepStrictEqual(catalogShown.body.products[0].colors, [
    { name: 'Navy', photos: ['/api/products/image/fileNavy1_large', '/api/products/image/fileNavy2_large'] },
    { name: 'Beige', photos: ['/api/products/image/fileBeige1_large'] },
  ]);
  console.log('  OK colors array present with per-color photo URLs');

  server.close();
  console.log('\nALL E2E CHECKS PASSED');
}

main()
  .then(() => {
    for (const ext of ['', '-wal', '-shm']) fs.rmSync(dbPath + ext, { force: true });
    process.exit(0);
  })
  .catch((err) => {
    console.error('E2E TEST FAILED:', err);
    for (const ext of ['', '-wal', '-shm']) fs.rmSync(dbPath + ext, { force: true });
    process.exit(1);
  });
