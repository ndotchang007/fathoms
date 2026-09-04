const express = require('express');
const { getDb } = require('../database');
const { sessionAuth } = require('../middleware/sessionAuth');
const { getDashboardData } = require('../services/statsService');

const router = express.Router();

router.get('/:userId', sessionAuth, async (req, res, next) => {
  try {
    const db = getDb();
    const data = await getDashboardData(db, req.params.userId);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
