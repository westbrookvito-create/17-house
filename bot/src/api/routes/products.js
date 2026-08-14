const express = require('express');
const products = require('../../models/products');
const bot = require('../../bot/instance');
const config = require('../../config');
const { requireTelegramAuth } = require('../middleware/auth');

const router = express.Router();

// Прокси для картинок, которые администратор прислал боту (Telegram file_id),
// чтобы мини-приложение могло отобразить их обычным <img src>.
router.get('/image/:fileId', async (req, res) => {
  try {
    const link = await bot.telegram.getFileLink(req.params.fileId);
    const upstream = await fetch(link.href);
    if (!upstream.ok || !upstream.body) return res.status(404).end();
    res.set('Content-Type', upstream.headers.get('content-type') || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.send(buffer);
  } catch (err) {
    console.error('[api/products/image] failed', err.message);
    res.status(404).end();
  }
});

router.get('/', requireTelegramAuth, (req, res) => {
  const list = products.listActive().map((p) => ({
    ...p,
    colors: p.colors.map((c) => ({
      ...c,
      imageUrl: c.fileId ? `/api/products/image/${c.fileId}` : c.imageUrl || null,
    })),
  }));
  res.json({ products: list, bonusThreshold: config.bonusThreshold, bonusPercent: config.bonusPercent });
});

module.exports = router;
