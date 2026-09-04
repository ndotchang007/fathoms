require('dotenv').config();
const { initDatabase, getDb } = require('./index');
const { generateSeedData, generateTopics } = require('./seedData');
const { TOPIC_CATEGORIES } = require('./topicTemplates');

const TOPIC_CATALOG_VERSION = TOPIC_CATEGORIES.map((c) => c.id).join(',');

async function seed() {
  const db = await initDatabase();
  const seeded = await db.isSeeded();
  const topics = generateTopics();

  if (!seeded) {
    const data = generateSeedData();
    await db.seedAll(data);
    console.log(`Seeded ${data.topics.length} topics and ${data.achievements.length} achievements (no demo user).`);
    return;
  }

  const existing = await db.getTopics();
  const hasBulletSources = existing.some((t) => Array.isArray(t.sources?.[0]?.bullets) && t.sources[0].bullets.length > 0);
  const needsSync = existing.length !== topics.length
    || !existing.some((t) => t.category === 'must-know')
    || !hasBulletSources;

  if (needsSync) {
    await db.syncTopics(topics);
    console.log(`Synced ${topics.length} topics (catalog: ${TOPIC_CATALOG_VERSION}).`);
  } else {
    console.log('Database already seeded, skipping.');
  }
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}

module.exports = { seed };
