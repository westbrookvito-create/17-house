const express = require('express');
const cors = require('cors');
const config = require('../config');
const productsRouter = require('./routes/products');
const profileRouter = require('./routes/profile');
const ordersRouter = require('./routes/orders');

function createServer() {
  const app = express();

  app.use(
    cors({
      origin: config.corsOrigin.includes('*') ? true : config.corsOrigin,
    }),
  );
  app.use(express.json());

  app.get('/health', (req, res) => res.json({ ok: true, club: config.clubName }));

  app.use('/api/products', productsRouter);
  app.use('/api/profile', profileRouter);
  app.use('/api/orders', ordersRouter);

  app.use((err, req, res, next) => {
    console.error('[api] unhandled error', err);
    res.status(500).json({ error: 'internal_error' });
  });

  return app;
}

module.exports = { createServer };
