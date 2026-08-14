// Full backend regression check — exercises the real Telegraf update
// dispatcher (not hand-simulated handlers) plus the Express API, against a
// throwaway SQLite database. Run with `npm test`.
//
// Covers: user registration + member codes, admin product wizard (create,
// edit, hide/show, delete), the full order lifecycle (create → notify admin
// → confirm/cancel → notify buyer), club-card purchase gating, bonus
// threshold + discount, idempotent order confirmation, and the
// contact-manager message relay.

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

async function main() {
  console.log('== /start creates user + issues member card ==');
  await sendText(USER_ID, '/start');
  const user = usersModel.getByTelegramId(USER_ID);
  assert.ok(user, 'user should be created on /start');
  assert.strictEqual(user.member_code, String(user.id), 'member_code should equal sequential row id');
  console.log('  OK member_code =', user.member_code);

  console.log('== non-admin /admin is ignored ==');
  const before = apiCalls.length;
  await sendText(USER_ID, '/admin');
  assert.strictEqual(apiCalls.length, before, 'non-admin should get no response to /admin');
  console.log('  OK');

  console.log('== admin /admin opens panel ==');
  await sendText(ADMIN_ID, '/admin');
  assert.ok(lastMessageTo(ADMIN_ID).includes('Админ-панель'));
  console.log('  OK');

  console.log('== admin adds a product with 2 colors ==');
  await sendCallback(ADMIN_ID, 'admin:add_product');
  await sendText(ADMIN_ID, 'House Every Weekend Tee');
  await sendText(ADMIN_ID, 'Плотный хлопок, вышитая эмблема.');
  await sendText(ADMIN_ID, '3200');
  await sendText(ADMIN_ID, 'S, M, L, XL');
  await sendPhoto(ADMIN_ID, 'fileNavy');
  await sendText(ADMIN_ID, 'Navy');
  await sendPhoto(ADMIN_ID, 'fileBeige');
  await sendText(ADMIN_ID, 'Beige');
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
  assert.strictEqual(product.colors[0].fileId, 'fileNavy_large');
  console.log(
    '  OK product created:',
    product.id,
    product.name,
    product.colors.map((c) => c.name),
  );

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
  await sendPhoto(ADMIN_ID, 'fileTemp');
  await sendText(ADMIN_ID, 'Black');
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

  console.log('== club-card hasPurchased starts false ==');
  let cc = await api('/api/profile/club-card', { headers: authHeaders(USER_ID) });
  assert.strictEqual(cc.body.hasPurchased, false);
  assert.strictEqual(cc.body.memberCode, user.member_code);
  console.log('  OK hasPurchased=false, memberCode=', cc.body.memberCode);

  console.log('== invalid order rejected (bad size) ==');
  const badOrder = await api('/api/orders', {
    method: 'POST',
    headers: authHeaders(USER_ID),
    body: JSON.stringify({ productId: product.id, color: 'Navy', size: 'XXXXL' }),
  });
  assert.strictEqual(badOrder.status, 400);
  console.log('  OK 400 invalid_size');

  console.log('== place 3 real orders and confirm each via admin action ==');
  for (let i = 0; i < 3; i++) {
    const created = await api('/api/orders', {
      method: 'POST',
      headers: authHeaders(USER_ID),
      body: JSON.stringify({ productId: product.id, color: 'Navy', size: 'M' }),
    });
    assert.strictEqual(created.status, 200);
    const orderId = created.body.order.id;
    assert.strictEqual(created.body.order.status, 'pending');

    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 30)); // let the fire-and-forget admin notification run
    const notifyText = lastMessageTo(ADMIN_ID);
    assert.ok(notifyText && notifyText.includes(`заказ #${orderId}`), 'admin should be notified of new order');

    // eslint-disable-next-line no-await-in-loop
    await sendCallback(ADMIN_ID, `confirm_order:${orderId}`);
    assert.strictEqual(ordersModel.getById(orderId).status, 'paid');
    const buyerNotice = lastMessageTo(USER_ID);
    assert.ok(buyerNotice.includes('оплачен'), 'buyer should get paid confirmation');
    if (i === 0) assert.ok(buyerNotice.includes('первая покупка'), 'first purchase note expected');
    if (i === 2) assert.ok(buyerNotice.includes('разблокирована'), 'bonus unlock note expected on 3rd');
  }
  console.log('  OK 3 orders placed + confirmed, notifications correct');

  console.log('== club-card hasPurchased flips true after first purchase ==');
  cc = await api('/api/profile/club-card', { headers: authHeaders(USER_ID) });
  assert.strictEqual(cc.body.hasPurchased, true);
  console.log('  OK hasPurchased=true');

  console.log('== bonus unlocked after 3rd purchase, discount applied on next order ==');
  const bonus = await api('/api/profile/bonus', { headers: authHeaders(USER_ID) });
  assert.strictEqual(bonus.body.unlocked, true);
  assert.strictEqual(bonus.body.shirtsPurchased, 3);

  const discounted = await api('/api/orders', {
    method: 'POST',
    headers: authHeaders(USER_ID),
    body: JSON.stringify({ productId: product.id, color: 'Beige', size: 'L' }),
  });
  assert.strictEqual(discounted.body.order.discountPercent, 10);
  assert.strictEqual(discounted.body.order.basePrice, 2990);
  assert.strictEqual(discounted.body.order.price, Math.round(2990 * 0.9));
  console.log('  OK discounted order price =', discounted.body.order.price);

  console.log('== admin can cancel a pending order ==');
  const toCancel = await api('/api/orders', {
    method: 'POST',
    headers: authHeaders(USER2_ID),
    body: JSON.stringify({ productId: product.id, color: 'Navy', size: 'S' }),
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
