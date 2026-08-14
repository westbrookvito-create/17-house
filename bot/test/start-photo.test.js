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

async function main() {
  console.log('== /start sends the hero photo with the welcome caption when WEBAPP_URL is set ==');
  await sendStart(111);
  const photoCall = calls.find((c) => c.method === 'sendPhoto');
  assert.ok(photoCall, 'expected a sendPhoto call');
  assert.strictEqual(photoCall.payload.photo, 'https://example-club.netlify.app/hero.jpg');
  assert.ok(photoCall.payload.caption.includes('Добро пожаловать'));
  assert.ok(photoCall.payload.reply_markup, 'the Open App button must still be attached');
  assert.ok(!calls.some((c) => c.method === 'sendMessage'), 'should not also send a plain text message');
  console.log('  OK hero photo sent with caption + keyboard');

  console.log('== falls back to a text-only message if sending the photo fails ==');
  failSendPhoto = true;
  calls.length = 0;
  await sendStart(222);
  assert.ok(calls.some((c) => c.method === 'sendPhoto'), 'should still have attempted the photo');
  const textCall = calls.find((c) => c.method === 'sendMessage');
  assert.ok(textCall, 'expected a fallback sendMessage after the photo failed');
  assert.ok(textCall.payload.text.includes('Добро пожаловать'));
  console.log('  OK falls back to text when the photo send throws');

  for (const ext of ['', '-wal', '-shm']) fs.rmSync(dbPath + ext, { force: true });
  console.log('\nALL START-PHOTO CHECKS PASSED');
}

main().catch((err) => {
  console.error('START-PHOTO TEST FAILED:', err);
  for (const ext of ['', '-wal', '-shm']) fs.rmSync(dbPath + ext, { force: true });
  process.exit(1);
});
