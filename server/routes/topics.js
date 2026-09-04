const express = require('express');
const { getDb } = require('../database');
const { TOPIC_CATEGORIES } = require('../database/topicTemplates');

const router = express.Router();

router.get('/categories', (_req, res) => {
  res.json({ categories: TOPIC_CATEGORIES });
});

router.get('/', async (req, res, next) => {
  try {
    const db = getDb();
    let topics = await db.getTopics();
    if (req.query.category) {
      topics = topics.filter((t) => t.category === req.query.category);
    }
    const preview = topics.map(({ id, title, category, difficulty }) => ({
      id, title, category, difficulty,
    }));
    res.json({ topics: preview });
  } catch (err) {
    next(err);
  }
});

router.get('/random', async (req, res, next) => {
  try {
    const db = getDb();
    const topic = await db.getRandomTopic(req.query.exclude, req.query.category);
    if (!topic) return res.status(404).json({ error: 'No topics available' });
    res.json({ topic });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const db = getDb();
    const topic = await db.getTopic(req.params.id);
    if (!topic) return res.status(404).json({ error: 'Topic not found' });
    res.json({ topic });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
