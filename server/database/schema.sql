-- Fathoms PostgreSQL Schema

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  email TEXT,
  password_hash TEXT,
  xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  streak INTEGER DEFAULT 0,
  best_streak INTEGER DEFAULT 0,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users (LOWER(username));

CREATE TABLE IF NOT EXISTS signup_registrations (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  ip_address TEXT NOT NULL,
  device_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signup_ip ON signup_registrations(ip_address);
CREATE INDEX IF NOT EXISTS idx_signup_device ON signup_registrations(device_id);

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

CREATE TABLE IF NOT EXISTS topics (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  category TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  description TEXT,
  research_time INTEGER DEFAULT 300,
  sources JSONB DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  topic_id TEXT REFERENCES topics(id),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  research_duration INTEGER DEFAULT 0,
  speaking_duration INTEGER DEFAULT 0,
  attempt_number INTEGER DEFAULT 1,
  notes_length INTEGER DEFAULT 0,
  xp_earned INTEGER DEFAULT 0,
  status TEXT DEFAULT 'in_progress'
);

CREATE TABLE IF NOT EXISTS evaluations (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES sessions(id),
  overall INTEGER,
  speaking INTEGER,
  comprehension INTEGER,
  depth INTEGER,
  reasoning INTEGER,
  organization INTEGER,
  clarity INTEGER,
  vocabulary INTEGER,
  strengths JSONB DEFAULT '[]',
  improvements JSONB DEFAULT '[]',
  recommendation TEXT,
  is_demo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS achievements (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  requirement_type TEXT,
  requirement_value INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_achievements (
  user_id TEXT REFERENCES users(id),
  achievement_id TEXT REFERENCES achievements(id),
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_topic ON sessions(topic_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_session ON evaluations(session_id);
