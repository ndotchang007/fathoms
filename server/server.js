const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const config = require('./config');
const { initDatabase } = require('./database');
const { seed } = require('./database/seed');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const topicRoutes = require('./routes/topics');
const sourceRoutes = require('./routes/sources');
const sessionRoutes = require('./routes/sessions');
const statsRoutes = require('./routes/stats');
const achievementRoutes = require('./routes/achievements');
const dashboardRoutes = require('./routes/dashboard');
const pageRoutes = require('./routes/pages');

async function start() {
  await initDatabase();
  await seed();

  const app = express();

  app.set('trust proxy', 1);
  app.use(express.json());
  app.use(cookieParser(config.sessionSecret));
  app.use(require('./middleware/deviceCookie'));
  app.use(pageRoutes);

  // Keep the service worker fresh so updates propagate quickly
  app.get('/sw.js', (req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.set('Service-Worker-Allowed', '/');
    res.type('application/javascript');
    res.sendFile(path.join(__dirname, '../public/sw.js'));
  });

  app.get('/manifest.webmanifest', (req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.type('application/manifest+json');
    res.sendFile(path.join(__dirname, '../public/manifest.webmanifest'));
  });

  app.use(express.static(path.join(__dirname, '../public')));

  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/topics', topicRoutes);
  app.use('/api/sources', sourceRoutes);
  app.use('/api/sessions', sessionRoutes);
  app.use('/api/stats', statsRoutes);
  app.use('/api/achievements', achievementRoutes);
  app.use('/api/dashboard', dashboardRoutes);

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use(errorHandler);

  app.listen(config.port, () => {
    console.log(`Fathoms running at http://localhost:${config.port}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
