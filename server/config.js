require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  databaseUrl: process.env.DATABASE_URL || '',
  sessionSecret: process.env.SESSION_SECRET || 'fathoms-dev-secret',
  useJsonFallback: process.env.USE_JSON_FALLBACK === 'true' || !process.env.DATABASE_URL,
  claudeApiKey: process.env.CLAUDE_API_KEY || '',
};
