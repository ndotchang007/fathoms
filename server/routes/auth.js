const express = require('express');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');
const { checkSignupLimits, recordSignup } = require('../utils/signupLimits');

const router = express.Router();

const DEFAULT_SETTINGS = {
  researchTimer: 300,
  speakingTimer: 60,
  soundEffects: true,
  reducedMotion: false,
  showNotesDuringSpeech: false,
  theme: 'dark',
};

const BCRYPT_ROUNDS = 10;

function validateUsername(username) {
  if (!username || username.length < 2 || username.length > 24) {
    return 'Username must be 2–24 characters.';
  }
  if (!/^[a-zA-Z0-9_\- ]+$/.test(username)) {
    return 'Username can only contain letters, numbers, spaces, hyphens, and underscores.';
  }
  return null;
}

function validatePassword(password) {
  if (!password || password.length < 6) {
    return 'Password must be at least 6 characters.';
  }
  if (password.length > 128) {
    return 'Password must be 128 characters or fewer.';
  }
  return null;
}

function setSessionCookie(res, userId) {
  res.cookie('fathoms_user', userId, {
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    level: user.level,
    xp: user.xp,
    settings: user.settings,
  };
}

router.post('/register', async (req, res, next) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');

    const usernameError = validateUsername(username);
    if (usernameError) return res.status(400).json({ error: usernameError });

    const passwordError = validatePassword(password);
    if (passwordError) return res.status(400).json({ error: passwordError });

    const db = getDb();
    const limitCheck = await checkSignupLimits(req, res, db);
    if (limitCheck.blocked) {
      return res.status(limitCheck.status).json({
        error: limitCheck.error,
        code: limitCheck.code,
      });
    }

    const existing = await db.getUserByUsername(username);
    if (existing) {
      return res.status(409).json({ error: 'That username is already taken.' });
    }

    const settings = { ...DEFAULT_SETTINGS };
    if (req.body.focusArea) {
      settings.focusArea = String(req.body.focusArea);
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await db.createUser({
      id: uuidv4(),
      username,
      email: null,
      password_hash: passwordHash,
      xp: 0,
      level: 1,
      streak: 0,
      best_streak: 0,
      settings,
      created_at: new Date().toISOString(),
    });

    await recordSignup(req, res, db, user.id, limitCheck);
    setSessionCookie(res, user.id);

    res.status(201).json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const db = getDb();
    const user = await db.getUserByUsername(username);
    if (!user || !user.password_hash) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    setSessionCookie(res, user.id);
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.get('/me', async (req, res, next) => {
  try {
    const userId = req.cookies?.fathoms_user;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });
    const db = getDb();
    const user = await db.getUser(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('fathoms_user');
  res.json({ ok: true });
});

module.exports = router;
