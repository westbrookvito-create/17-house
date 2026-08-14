const config = require('./config');
const bot = require('./bot');
const { createServer } = require('./api/server');

async function main() {
  const app = createServer();
  app.listen(config.port, () => {
    console.log(`[api] listening on port ${config.port}`);
  });

  await bot.launch();
  console.log(`[bot] ${config.clubName} bot started (long polling)`);

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

main().catch((err) => {
  console.error('[fatal] failed to start', err);
  process.exit(1);
});
