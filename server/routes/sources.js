const express = require('express');
const { fetchArticle } = require('../services/wikipediaService');

const router = express.Router();

router.get('/article', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const context = String(req.query.context || '').trim().slice(0, 200);
    if (!q || q.length > 200) {
      return res.status(400).json({ error: 'Query required (max 200 characters)' });
    }
    const article = await fetchArticle(q, context);
    res.json({ article });
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ error: err.message || 'Article not found' });
    }
    next(err);
  }
});

module.exports = router;
