const express = require('express');
const { getDb } = require('../database');
const { sessionAuth } = require('../middleware/sessionAuth');
const { getStatsData } = require('../services/statsService');

const router = express.Router();

router.get('/completed', async (req, res, next) => {
  try {
    const db = getDb();
    const fathomsCompleted = await db.getTotalCompletedSessions();
    res.json({ fathomsCompleted });
  } catch (err) {
    next(err);
  }
});

router.get('/:userId', sessionAuth, async (req, res, next) => {
  try {
    const db = getDb();
    const data = await getStatsData(db, req.params.userId);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
