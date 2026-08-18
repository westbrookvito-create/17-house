const express = require('express');
const { requireTelegramAuth } = require('../middleware/auth');
const config = require('../../config');

const router = express.Router();
router.use(requireTelegramAuth);

function serializeUser(user) {
  return {
    id: user.id,
    firstName: user.first_name,
    username: user.username,
    memberCode: user.member_code,
    status: user.status,
    joinedAt: user.joined_at,
    statusUntil: user.status_until,
    shirtsPurchased: user.shirts_purchased,
    bonusUnlocked: !!user.bonus_unlocked,
  };
}

router.get('/', (req, res) => {
  res.json({ user: serializeUser(req.dbUser) });
});

router.get('/bonus', (req, res) => {
  const u = req.dbUser;
  const remaining = Math.max(0, config.bonusThreshold - u.shirts_purchased);
  res.json({
    shirtsPurchased: u.shirts_purchased,
    threshold: config.bonusThreshold,
    percent: config.bonusPercent,
    unlocked: !!u.bonus_unlocked,
    remaining,
  });
});

module.exports = router;
