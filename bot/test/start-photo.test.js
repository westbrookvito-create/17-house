// Отдельный файл, а не часть e2e.test.js: WEBAPP_URL читается один раз при
// require('../src/config'), так что его нужно выставить до первого импорта
// бота — с общим набором тестов это бы конфликтовало с их окружением.

process.env.BOT_TOKEN = 'test:token';
process.env.ADMIN_IDS = '1';
process.env.CORS_ORIGIN = '*';
process.env.WEBAPP_URL = 'https://example-club.netlify.app';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const dbPath = path.join(os.tmpdir(), `17house-start-photo-${Date.now()}.db`);
process.env.DB_PATH = dbPath;

const bot = require('../src/bot');

const ApiClient = require('../node_modules/telegraf/lib/core/network/client.js').default;
const calls = [];
let failSendPhoto = false;

ApiClient.prototype.callApi = async function callApi(method, payload) {
  calls.push({ method, payload });
  if (method === 'getMe') return { id: 0, is_bot: true, first_name: 'Bot', username: 'bot' };
  if (method === 'sendPhoto' && failSendPhoto) throw new Error('simulated Telegram failure');
  if (method === 'sendPhoto') return { message_id: calls.length, chat: { id: payload.chat_id }, date: 0 };
  if (method === 'sendMediaGroup') {
    return payload.media.map((m, i) => ({ message_id: calls.length + i, chat: { id: payload.chat_id }, date: 0 }));
  }
  if (method === 'answerCallbackQuery') return true;
  return { message_id: calls.length, chat: { id: payload.chat_id }, date: 0, text: payload.text || '' };
};

async function sendStart(fromId) {
  await bot.handleUpdate({
    update_id: calls.length + 1,
    message: {
      message_id: calls.length + 1,
      from: { id: fromId, is_bot: false, first_name: 'Test' },
      chat: { id: fromId, type: 'private' },
      date: Math.floor(Date.now() / 1000),
      text: '/start',
      entities: [{ offset: 0, length: 6, type: 'bot_command' }],
    },
  });
}

async function sendCommand(fromId, text) {
  const len = text.includes(' ') ? text.indexOf(' ') : text.length;
  await bot.handleUpdate({
    update_id: calls.length + 1,
    message: {
      message_id: calls.length + 1,
      from: { id: fromId, is_bot: false, first_name: 'Test' },
      chat: { id: fromId, type: 'private' },
      date: Math.floor(Date.now() / 1000),
      text,
      entities: [{ offset: 0, length: len, type: 'bot_command' }],
    },
  });
}

async function sendCallback(fromId, data) {
  await bot.handleUpdate({
    update_id: calls.length + 1,
    callback_query: {
      id: String(calls.length + 1),
      from: { id: fromId, is_bot: false, first_name: 'Test' },
      message: {
        message_id: calls.length + 1,
        chat: { id: fromId, type: 'private' },
        date: Math.floor(Date.now() / 1000),
        text: 'placeholder',
      },
      chat_instance: 'x',
      data,
    },
  });
}

async function main() {
  console.log('== first /start asks for privacy consent before anything else ==');
  await sendStart(111);
  // Filter to the registering user's own chat — a new-user admin notice (sent to
  // a different chat_id, ADMIN_IDS='1') may also land in `calls` at this point.
  const consentCall = calls.find((c) => c.method === 'sendMessage' && c.payload.chat_id === 111);
  assert.ok(consentCall, 'expected a consent sendMessage call');
  assert.ok(consentCall.payload.text.includes('обработку персональных данных'));
  const consentButtons = consentCall.payload.reply_markup.inline_keyboard.flat();
  assert.ok(consentButtons.some((b) => b.callback_data === 'privacy:accept'));
  assert.ok(!calls.some((c) => c.method === 'sendPhoto'), 'no hero photo before consent is accepted');
  console.log('  OK consent message shown first, no welcome photo yet');

  console.log('== accepting consent immediately sends the hero photo with the welcome caption ==');
  calls.length = 0;
  await sendCallback(111, 'privacy:accept');
  const photoCall = calls.find((c) => c.method === 'sendPhoto');
  assert.ok(photoCall, 'expected a sendPhoto call');
  assert.strictEqual(photoCall.payload.photo, 'https://example-club.netlify.app/hero.jpg');
  assert.ok(photoCall.payload.caption.includes('Добро пожаловать'));
  assert.ok(photoCall.payload.reply_markup, 'the Open App button must still be attached');
  console.log('  OK hero photo sent with caption + keyboard right after accepting');

  console.log('== returning (already consented) user gets the welcome directly on /start ==');
  calls.length = 0;
  await sendStart(111);
  const secondPhotoCall = calls.find((c) => c.method === 'sendPhoto');
  assert.ok(secondPhotoCall, 'consent should not be asked again for a returning user');
  assert.ok(!calls.some((c) => c.method === 'sendMessage' && c.payload.text.includes('обработку персональных')));
  console.log('  OK no repeat consent prompt for a returning user');

  console.log('== falls back to a text-only message if sending the photo fails ==');
  failSendPhoto = true;
  calls.length = 0;
  await sendStart(222);
  await sendCallback(222, 'privacy:accept');
  assert.ok(calls.some((c) => c.method === 'sendPhoto'), 'should still have attempted the photo');
  const textCall = calls.find((c) => c.method === 'sendMessage' && c.payload.text.includes('Добро пожаловать'));
  assert.ok(textCall, 'expected a fallback sendMessage after the photo failed');
  console.log('  OK falls back to text when the photo send throws');

  console.log('== welcome message attaches an "Узнать размер" button ==');
  const startPhotoCall = calls.find((c) => c.method === 'sendPhoto');
  const buttons = startPhotoCall.payload.reply_markup.inline_keyboard.flat();
  assert.ok(
    buttons.some((b) => b.text.includes('Узнать размер') && b.callback_data === 'size_chart'),
    'Open App keyboard must include the size chart button',
  );
  console.log('  OK size chart button present');

  console.log('== "Узнать размер" button sends 2 size chart photos ==');
  calls.length = 0;
  await sendCallback(333, 'size_chart');
  const mediaGroupCall = calls.find((c) => c.method === 'sendMediaGroup');
  assert.ok(mediaGroupCall, 'expected a sendMediaGroup call');
  assert.strictEqual(mediaGroupCall.payload.media.length, 2);
  assert.strictEqual(mediaGroupCall.payload.media[0].media, 'https://example-club.netlify.app/size-chart-1.jpg');
  assert.strictEqual(mediaGroupCall.payload.media[1].media, 'https://example-club.netlify.app/size-chart-2.jpg');
  console.log('  OK 2 size chart photos sent via callback button');

  console.log('== /size command also sends the size chart ==');
  calls.length = 0;
  await sendCommand(444, '/size');
  const mediaGroupCall2 = calls.find((c) => c.method === 'sendMediaGroup');
  assert.ok(mediaGroupCall2, 'expected a sendMediaGroup call from /size command');
  assert.strictEqual(mediaGroupCall2.payload.media.length, 2);
  console.log('  OK /size command works too');

  for (const ext of ['', '-wal', '-shm']) fs.rmSync(dbPath + ext, { force: true });
  console.log('\nALL START-PHOTO CHECKS PASSED');
}

main().catch((err) => {
  console.error('START-PHOTO TEST FAILED:', err);
  for (const ext of ['', '-wal', '-shm']) fs.rmSync(dbPath + ext, { force: true });
  process.exit(1);
});
