const express = require('express');
const path = require('path');

const router = express.Router();
const publicDir = path.join(__dirname, '../../public');

const PAGES = {
  '/practice': 'practice.html',
  '/stats': 'stats.html',
  '/profile': 'profile.html',
  '/settings': 'settings.html',
  '/login': 'login.html',
  '/init': 'init.html',
  '/about': 'about.html',
  '/app': 'app.html',
};

router.get('/dashboard', (req, res) => {
  res.redirect(301, '/stats');
});

router.get('/dashboard.html', (req, res) => {
  res.redirect(301, '/stats');
});

router.get('/achievements', (req, res) => {
  res.redirect(301, '/profile#trophy-case');
});

router.get('/achievements.html', (req, res) => {
  res.redirect(301, '/profile#trophy-case');
});

Object.entries(PAGES).forEach(([route, file]) => {
  router.get(route, (req, res) => {
    res.sendFile(path.join(publicDir, file));
  });
});

const HTML_REDIRECTS = Object.fromEntries(
  Object.entries(PAGES).map(([route, file]) => [`/${file}`, route])
);

Object.entries(HTML_REDIRECTS).forEach(([from, to]) => {
  router.get(from, (req, res) => {
    const query = Object.keys(req.query).length
      ? `?${new URLSearchParams(req.query).toString()}`
      : '';
    res.redirect(301, to + query);
  });
});

module.exports = router;
