const express = require('express');
const { getDb } = require('../database');
const { sessionAuth } = require('../middleware/sessionAuth');
const { evaluate } = require('../services/aiService');
const { calculateXpEarned, applyXp, getXpForLevel, getNextLevelXp, getLevelForXp } = require('../services/xpService');
const { checkAchievements } = require('../services/achievementService');

const router = express.Router();

router.post('/', sessionAuth, async (req, res, next) => {
  try {
    const db = getDb();
    const { topic_id, attempt_number = 1 } = req.body;
    if (!topic_id) return res.status(400).json({ error: 'topic_id required' });

    const topic = await db.getTopic(topic_id);
    if (!topic) return res.status(404).json({ error: 'Topic not found' });

    const session = await db.createSession({
      user_id: req.userId,
      topic_id,
      attempt_number,
    });

    res.status(201).json({ session, topic });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', sessionAuth, async (req, res, next) => {
  try {
    const db = getDb();
    const session = await db.getSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.user_id !== req.userId) return res.status(403).json({ error: 'Forbidden' });

    const updated = await db.updateSession(req.params.id, req.body);
    res.json({ session: updated });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/evaluate', sessionAuth, async (req, res, next) => {
  try {
    const db = getDb();
    const session = await db.getSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.user_id !== req.userId) return res.status(403).json({ error: 'Forbidden' });

    const topic = await db.getTopic(session.topic_id);
    const { research_duration, speaking_duration, notes_length, transcript } = req.body;

    let previousEvaluation = null;
    if (session.attempt_number > 1) {
      const priorSessions = await db.getSessions(req.userId, { topicId: session.topic_id });
      const prior = priorSessions.find(
        (s) => s.attempt_number === session.attempt_number - 1 && s.status === 'completed'
      );
      if (prior) previousEvaluation = await db.getEvaluation(prior.id);
    }

    const evaluation = await evaluate({
      topic,
      sessionId: session.id,
      attemptNumber: session.attempt_number,
      previousEvaluation,
      researchDuration: research_duration ?? session.research_duration,
      speakingDuration: speaking_duration ?? session.speaking_duration,
      notesLength: notes_length ?? session.notes_length,
      transcript,
    });

    const savedEval = await db.saveEvaluation({
      session_id: session.id,
      ...evaluation,
    });

    const previousOverall = previousEvaluation?.overall ?? null;
    const xpEarned = calculateXpEarned({ overall: evaluation.overall, previousOverall });
    const user = await db.getUser(req.userId);
    const previousXp = user.xp;
    const previousLevel = getLevelForXp(previousXp);
    const xpResult = applyXp(user.xp, xpEarned);

    const today = new Date().toISOString().split('T')[0];
    const lastActive = user.settings?.lastActiveDate;
    let streak = user.streak || 0;
    if (lastActive !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      streak = lastActive === yesterdayStr ? streak + 1 : 1;
    }

    await db.updateUser(req.userId, {
      xp: xpResult.newXp,
      level: xpResult.newLevel,
      streak,
      best_streak: Math.max(user.best_streak || 0, streak),
      settings: { ...user.settings, lastActiveDate: today },
    });

    await db.updateSession(session.id, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      research_duration: research_duration ?? session.research_duration,
      speaking_duration: speaking_duration ?? session.speaking_duration,
      notes_length: notes_length ?? session.notes_length,
      xp_earned: xpEarned,
    });

    const sessionCount = await db.getCompletedSessionCount(req.userId);
    const improvement = previousOverall !== null ? evaluation.overall - previousOverall : 0;
    const newAchievements = await checkAchievements(req.userId, {
      sessionCount,
      streak,
      evaluation,
      improvement,
    });

    if (newAchievements.length) {
      const bonusXp = newAchievements.length * 100;
      const bonusResult = applyXp(xpResult.newXp, bonusXp);
      await db.updateUser(req.userId, { xp: bonusResult.newXp, level: bonusResult.newLevel });
      xpResult.newXp = bonusResult.newXp;
      xpResult.newLevel = bonusResult.newLevel;
      xpResult.xpEarned = xpEarned + bonusXp;
    } else {
      xpResult.xpEarned = xpEarned;
    }

    const topicAttempts = await db.getSessions(req.userId, { topicId: session.topic_id });
    const attemptHistory = [];
    for (const s of topicAttempts.sort((a, b) => a.attempt_number - b.attempt_number)) {
      const ev = s.id === session.id ? savedEval : await db.getEvaluation(s.id);
      if (ev) attemptHistory.push({ attempt: s.attempt_number, score: ev.overall });
    }

    res.json({
      evaluation: {
        ...savedEval,
        assessment: evaluation.assessment,
        deliveryScored: evaluation.deliveryScored,
        label: evaluation.label,
      },
      xp: {
        ...xpResult,
        previousXp,
        previousXpForCurrentLevel: getXpForLevel(previousLevel),
        previousXpForNextLevel: getNextLevelXp(previousLevel),
        xpForCurrentLevel: xpResult.xpForCurrentLevel ?? getXpForLevel(xpResult.newLevel),
        xpForNextLevel: xpResult.xpForNextLevel ?? getNextLevelXp(xpResult.newLevel),
      },
      attemptHistory,
      newAchievements,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/report-feedback', sessionAuth, async (req, res, next) => {
  try {
    const db = getDb();
    const session = await db.getSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.user_id !== req.userId) return res.status(403).json({ error: 'Forbidden' });

    const { feedback_type, content, reason } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'content required' });
    if (!reason?.trim()) return res.status(400).json({ error: 'reason required' });

    const report = {
      id: require('uuid').v4(),
      session_id: session.id,
      user_id: req.userId,
      feedback_type: feedback_type || 'general',
      content: content.trim(),
      reason: reason?.trim() || '',
      created_at: new Date().toISOString(),
    };

    console.log('[feedback-report]', JSON.stringify(report));

    const fs = require('fs');
    const path = require('path');
    const reportsPath = path.join(__dirname, '../../data/feedback-reports.json');
    let reports = [];
    try {
      if (fs.existsSync(reportsPath)) {
        reports = JSON.parse(fs.readFileSync(reportsPath, 'utf8'));
      }
    } catch {}
    reports.push(report);
    fs.writeFileSync(reportsPath, JSON.stringify(reports, null, 2));

    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/', sessionAuth, async (req, res, next) => {
  try {
    const db = getDb();
    const options = {};
    if (req.query.limit) options.limit = parseInt(req.query.limit, 10);
    if (req.query.topic_id) options.topicId = req.query.topic_id;

    const sessions = await db.getSessions(req.userId, options);
    const topics = await db.getTopics();
    const topicMap = Object.fromEntries(topics.map((t) => [t.id, t]));

    const results = [];
    for (const s of sessions) {
      const ev = await db.getEvaluation(s.id);
      results.push({
        ...s,
        topic: topicMap[s.topic_id],
        evaluation: ev,
      });
    }

    res.json({ sessions: results });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
