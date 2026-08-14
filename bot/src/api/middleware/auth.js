const { validateInitData } = require('../../utils/telegramAuth');
const users = require('../../models/users');

/**
 * Verifies the `X-Telegram-Init-Data` header sent by the Mini App on every request,
 * resolves (or creates) the matching local user row, and attaches it to req.dbUser.
 */
function requireTelegramAuth(req, res, next) {
  const initData = req.header('X-Telegram-Init-Data');
  const tgUser = validateInitData(initData);

  if (tgUser) {
    req.tgUser = tgUser;
    req.dbUser = users.getOrCreate(tgUser);
    return next();
  }

  // Только для локальной разработки вне Telegram: включается явно через
  // DEV_ALLOW_INSECURE=1, чтобы можно было открыть мини-апп в обычном браузере.
  if (process.env.DEV_ALLOW_INSECURE === '1') {
    const debugId = req.header('X-Debug-User-Id');
    if (debugId) {
      const fakeUser = { id: Number(debugId), first_name: 'Dev', username: 'dev_user' };
      req.tgUser = fakeUser;
      req.dbUser = users.getOrCreate(fakeUser);
      return next();
    }
  }

  return res.status(401).json({ error: 'invalid_init_data' });
}

module.exports = { requireTelegramAuth };
