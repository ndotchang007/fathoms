const express = require('express');
const { getDb } = require('../database');
const { sessionAuth } = require('../middleware/sessionAuth');

const router = express.Router();

router.get('/', sessionAuth, async (req, res, next) => {
  try {
    const db = getDb();
    const achievements = await db.getUserAchievements(req.userId);
    res.json({ achievements });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
