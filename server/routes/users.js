const express = require('express');
const { getDb } = require('../database');
const { sessionAuth } = require('../middleware/sessionAuth');

const router = express.Router();

function validateUsername(username) {
  if (!username || username.length < 2 || username.length > 24) {
    return 'Username must be 2–24 characters.';
  }
  if (!/^[a-zA-Z0-9_\- ]+$/.test(username)) {
    return 'Username can only contain letters, numbers, spaces, hyphens, and underscores.';
  }
  return null;
}

function requireSelf(req, res) {
  if (req.userId !== req.params.id) {
    res.status(403).json({ error: 'Forbidden' });
    return false;
  }
  return true;
}

router.get('/:id', sessionAuth, async (req, res, next) => {
  try {
    const db = getDb();
    const user = await db.getUser(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const sessions = await db.getSessions(user.id);
    const evaluations = await db.getEvaluationsForUser(user.id);
    const completed = sessions.filter((s) => s.status === 'completed');
    const scores = evaluations.map((e) => e.overall);

    const skills = {};
    const { SKILLS } = require('../services/aiService');
    for (const skill of SKILLS) {
      const vals = evaluations.map((e) => e[skill]);
      skills[skill] = vals.length
        ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
        : 0;
    }

    res.json({
      user,
      stats: {
        fathomsCompleted: completed.length,
        averageScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
        bestScore: scores.length ? Math.max(...scores) : 0,
        streak: user.streak,
        skills,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/settings', sessionAuth, async (req, res, next) => {
  try {
    if (!requireSelf(req, res)) return;
    const db = getDb();
    const user = await db.getUser(req.params.id);
    const settings = { ...user.settings, ...req.body };
    const updated = await db.updateUser(req.params.id, { settings });
    res.json({ user: updated });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/username', sessionAuth, async (req, res, next) => {
  try {
    if (!requireSelf(req, res)) return;
    const username = String(req.body.username || '').trim();
    const usernameError = validateUsername(username);
    if (usernameError) return res.status(400).json({ error: usernameError });

    const db = getDb();
    const existing = await db.getUserByUsername(username);
    if (existing && existing.id !== req.params.id) {
      return res.status(409).json({ error: 'That username is already taken.' });
    }

    const updated = await db.updateUser(req.params.id, { username });
    res.json({ user: updated });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/export', sessionAuth, async (req, res, next) => {
  try {
    if (!requireSelf(req, res)) return;
    const db = getDb();
    const data = await db.exportUserData(req.params.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/import', sessionAuth, async (req, res, next) => {
  try {
    if (!requireSelf(req, res)) return;
    const db = getDb();
    const result = await db.importUserData(req.params.id, req.body);
    res.json(result);
  } catch (err) {
    if (err.message === 'Invalid import data') {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

router.post('/:id/reset', sessionAuth, async (req, res, next) => {
  try {
    if (!requireSelf(req, res)) return;
    const db = getDb();
    const user = await db.resetUserData(req.params.id);
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', sessionAuth, async (req, res, next) => {
  try {
    if (!requireSelf(req, res)) return;
    const db = getDb();
    await db.deleteUser(req.params.id);
    res.clearCookie('fathoms_user');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
