const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const { createJsonStore } = require('./jsonStore');
const { createPostgresStore } = require('./postgres');

let db = null;

function mapUser(row) {
  if (!row) return null;
  return {
    ...row,
    settings: typeof row.settings === 'string' ? JSON.parse(row.settings) : row.settings || {},
  };
}

function mapTopic(row) {
  if (!row) return null;
  return {
    ...row,
    sources: typeof row.sources === 'string' ? JSON.parse(row.sources) : row.sources || [],
  };
}

function mapEvaluation(row) {
  if (!row) return null;
  return {
    ...row,
    strengths: typeof row.strengths === 'string' ? JSON.parse(row.strengths) : row.strengths || [],
    improvements: typeof row.improvements === 'string' ? JSON.parse(row.improvements) : row.improvements || [],
  };
}

function createJsonAdapter(store) {
  return {
    type: 'json',
    store,

    async init() {
      await store.init();
    },

    async getUser(id) {
      return mapUser(await store.findOne('users', { id }));
    },

    async getUserByUsername(username) {
      const users = await store.query('users');
      const needle = String(username || '').trim().toLowerCase();
      const row = users.find((u) => String(u.username || '').toLowerCase() === needle);
      return mapUser(row || null);
    },

    async createUser(user) {
      await store.insert('users', user);
      return mapUser(user);
    },

    async countSignupsByIp(ip) {
      const rows = await store.query('signup_registrations', { ip_address: ip });
      return rows.length;
    },

    async countSignupsByDevice(deviceId) {
      const rows = await store.query('signup_registrations', { device_id: deviceId });
      return rows.length;
    },

    async recordSignup(data) {
      await store.insert('signup_registrations', data);
      return data;
    },

    async updateUser(id, updates) {
      return mapUser(await store.update('users', { id }, updates));
    },

    async getTopics() {
      return (await store.query('topics')).map(mapTopic);
    },

    async getTopic(id) {
      return mapTopic(await store.findOne('topics', { id }));
    },

    async getRandomTopic(excludeId, category) {
      let topics = await store.query('topics');
      if (category) topics = topics.filter((t) => t.category === category);
      if (excludeId) topics = topics.filter((t) => t.id !== excludeId);
      if (!topics.length) return null;
      return mapTopic(topics[Math.floor(Math.random() * topics.length)]);
    },

    async syncTopics(topics) {
      await store.replaceTable('topics', topics);
    },

    async createSession(data) {
      const session = {
        id: uuidv4(),
        started_at: new Date().toISOString(),
        completed_at: null,
        research_duration: 0,
        speaking_duration: 0,
        notes_length: 0,
        xp_earned: 0,
        status: 'in_progress',
        ...data,
      };
      await store.insert('sessions', session);
      return session;
    },

    async getSession(id) {
      return store.findOne('sessions', { id });
    },

    async updateSession(id, updates) {
      return store.update('sessions', { id }, updates);
    },

    async getSessions(userId, options = {}) {
      let sessions = await store.query('sessions', { user_id: userId });
      sessions = sessions.filter((s) => s.status === 'completed' || options.includeInProgress);
      if (options.topicId) {
        sessions = sessions.filter((s) => s.topic_id === options.topicId);
      }
      sessions.sort((a, b) => new Date(b.started_at) - new Date(a.started_at));
      if (options.limit) sessions = sessions.slice(0, options.limit);
      return sessions;
    },

    async getCompletedSessionCount(userId) {
      const sessions = await store.query('sessions', { user_id: userId, status: 'completed' });
      return sessions.length;
    },

    async getTotalCompletedSessions() {
      const sessions = await store.query('sessions', { status: 'completed' });
      return sessions.length;
    },

    async saveEvaluation(data) {
      const evaluation = {
        id: uuidv4(),
        created_at: new Date().toISOString(),
        ...data,
        is_demo: data.isDemo ?? data.is_demo ?? true,
      };
      await store.insert('evaluations', evaluation);
      return mapEvaluation(evaluation);
    },

    async getEvaluation(sessionId) {
      return mapEvaluation(await store.findOne('evaluations', { session_id: sessionId }));
    },

    async getEvaluationsForUser(userId) {
      const sessions = await store.query('sessions', { user_id: userId, status: 'completed' });
      const sessionIds = new Set(sessions.map((s) => s.id));
      const evaluations = await store.query('evaluations');
      return evaluations.filter((e) => sessionIds.has(e.session_id)).map(mapEvaluation);
    },

    async getAchievements() {
      return store.query('achievements');
    },

    async getUserAchievements(userId) {
      const uas = await store.query('user_achievements', { user_id: userId });
      const achievements = await store.query('achievements');
      return achievements.map((a) => {
        const ua = uas.find((u) => u.achievement_id === a.id);
        return { ...a, unlocked: !!ua, unlocked_at: ua?.unlocked_at || null };
      });
    },

    async unlockAchievement(userId, achievementId) {
      const existing = await store.findOne('user_achievements', {
        user_id: userId,
        achievement_id: achievementId,
      });
      if (existing) return existing;
      const ua = {
        user_id: userId,
        achievement_id: achievementId,
        unlocked_at: new Date().toISOString(),
      };
      await store.insert('user_achievements', ua);
      return ua;
    },

    async isSeeded() {
      const topics = await store.query('topics');
      return topics.length > 0;
    },

    async seedAll(data) {
      await store.setAll(data);
    },

    async getAllData() {
      return store.getAll();
    },

    async exportUserData(userId) {
      const user = await this.getUser(userId);
      if (!user) throw new Error('User not found');
      const sessions = await this.getSessions(userId, { includeInProgress: true });
      const evaluations = await this.getEvaluationsForUser(userId);
      const achievements = await this.getUserAchievements(userId);
      const { password_hash, ...safeUser } = user;
      return {
        version: 1,
        exportedAt: new Date().toISOString(),
        user: safeUser,
        sessions,
        evaluations,
        achievements: achievements.filter((a) => a.unlocked).map((a) => ({
          achievement_id: a.id,
          unlocked_at: a.unlocked_at,
        })),
      };
    },

    async resetUserData(userId) {
      const data = await store.getAll();
      const sessionIds = new Set(
        (data.sessions || []).filter((s) => s.user_id === userId).map((s) => s.id)
      );
      data.sessions = (data.sessions || []).filter((s) => s.user_id !== userId);
      data.evaluations = (data.evaluations || []).filter((e) => !sessionIds.has(e.session_id));
      data.user_achievements = (data.user_achievements || []).filter((ua) => ua.user_id !== userId);
      await store.setAll(data);
      return this.updateUser(userId, { xp: 0, level: 1, streak: 0, best_streak: 0 });
    },

    async deleteUser(userId) {
      await this.resetUserData(userId);
      const data = await store.getAll();
      data.users = (data.users || []).filter((u) => u.id !== userId);
      data.signup_registrations = (data.signup_registrations || []).filter((r) => r.user_id !== userId);
      await store.setAll(data);
      return true;
    },

    async importUserData(userId, payload) {
      if (!payload || typeof payload !== 'object') {
        throw new Error('Invalid import data');
      }

      const sessions = Array.isArray(payload.sessions) ? payload.sessions : [];
      const evaluations = Array.isArray(payload.evaluations) ? payload.evaluations : [];
      const achievements = Array.isArray(payload.achievements) ? payload.achievements : [];
      const importedUser = payload.user || {};

      const data = await store.getAll();
      const existingSessionIds = new Set((data.sessions || []).map((s) => s.id));

      for (const session of sessions) {
        const row = { ...session, user_id: userId };
        if (existingSessionIds.has(row.id)) {
          const idx = data.sessions.findIndex((s) => s.id === row.id);
          data.sessions[idx] = row;
        } else {
          data.sessions.push(row);
          existingSessionIds.add(row.id);
        }
      }

      const sessionIds = new Set(
        (data.sessions || []).filter((s) => s.user_id === userId).map((s) => s.id)
      );
      data.evaluations = (data.evaluations || []).filter(
        (e) => !sessionIds.has(e.session_id)
      );
      for (const evaluation of evaluations) {
        if (sessionIds.has(evaluation.session_id)) {
          data.evaluations.push(evaluation);
        }
      }

      data.user_achievements = (data.user_achievements || []).filter((ua) => ua.user_id !== userId);
      for (const ach of achievements) {
        if (ach.achievement_id) {
          data.user_achievements.push({
            user_id: userId,
            achievement_id: ach.achievement_id,
            unlocked_at: ach.unlocked_at || new Date().toISOString(),
          });
        }
      }

      await store.setAll(data);

      const updates = {};
      if (typeof importedUser.xp === 'number') updates.xp = importedUser.xp;
      if (typeof importedUser.level === 'number') updates.level = importedUser.level;
      if (typeof importedUser.streak === 'number') updates.streak = importedUser.streak;
      if (typeof importedUser.best_streak === 'number') updates.best_streak = importedUser.best_streak;
      if (importedUser.settings && typeof importedUser.settings === 'object') {
        const current = await this.getUser(userId);
        updates.settings = { ...current.settings, ...importedUser.settings };
      }

      const user = Object.keys(updates).length
        ? await this.updateUser(userId, updates)
        : await this.getUser(userId);

      return { user };
    },
  };
}

function createPostgresAdapter(pg) {
  return {
    type: 'postgres',
    pg,

    async init() {
      await pg.init();
    },

    async getUser(id) {
      const row = await pg.queryOne('SELECT * FROM users WHERE id = $1', [id]);
      return mapUser(row);
    },

    async getUserByUsername(username) {
      const row = await pg.queryOne(
        'SELECT * FROM users WHERE LOWER(username) = LOWER($1)',
        [String(username || '').trim()]
      );
      return mapUser(row);
    },

    async createUser(user) {
      const row = await pg.queryOne(
        `INSERT INTO users (id, username, email, password_hash, xp, level, streak, best_streak, settings, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [
          user.id, user.username, user.email, user.password_hash || null, user.xp || 0, user.level || 1,
          user.streak || 0, user.best_streak || 0,
          JSON.stringify(user.settings || {}), user.created_at || new Date().toISOString(),
        ]
      );
      return mapUser(row);
    },

    async countSignupsByIp(ip) {
      const row = await pg.queryOne(
        'SELECT COUNT(*)::int AS count FROM signup_registrations WHERE ip_address = $1',
        [ip]
      );
      return row?.count || 0;
    },

    async countSignupsByDevice(deviceId) {
      const row = await pg.queryOne(
        'SELECT COUNT(*)::int AS count FROM signup_registrations WHERE device_id = $1',
        [deviceId]
      );
      return row?.count || 0;
    },

    async recordSignup(data) {
      await pg.query(
        `INSERT INTO signup_registrations (id, user_id, ip_address, device_id, created_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [data.id, data.user_id, data.ip_address, data.device_id, data.created_at]
      );
      return data;
    },

    async updateUser(id, updates) {
      const fields = [];
      const values = [];
      let i = 1;
      for (const [key, val] of Object.entries(updates)) {
        fields.push(`${key} = $${i++}`);
        values.push(key === 'settings' ? JSON.stringify(val) : val);
      }
      values.push(id);
      const row = await pg.queryOne(
        `UPDATE users SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
        values
      );
      return mapUser(row);
    },

    async getTopics() {
      const rows = await pg.query('SELECT * FROM topics');
      return rows.map(mapTopic);
    },

    async getTopic(id) {
      const row = await pg.queryOne('SELECT * FROM topics WHERE id = $1', [id]);
      return mapTopic(row);
    },

    async getRandomTopic(excludeId, category) {
      const params = [];
      const conditions = [];
      if (category) {
        params.push(category);
        conditions.push(`category = $${params.length}`);
      }
      if (excludeId) {
        params.push(excludeId);
        conditions.push(`id != $${params.length}`);
      }
      const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
      const sql = `SELECT * FROM topics${where} ORDER BY RANDOM() LIMIT 1`;
      const row = await pg.queryOne(sql, params);
      return mapTopic(row);
    },

    async syncTopics(topics) {
      for (const topic of topics) {
        await pg.query(
          `INSERT INTO topics (id, title, prompt, category, difficulty, description, research_time, sources)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (id) DO UPDATE SET
             title = EXCLUDED.title,
             prompt = EXCLUDED.prompt,
             category = EXCLUDED.category,
             difficulty = EXCLUDED.difficulty,
             description = EXCLUDED.description,
             research_time = EXCLUDED.research_time,
             sources = EXCLUDED.sources`,
          [topic.id, topic.title, topic.prompt, topic.category, topic.difficulty, topic.description, topic.research_time, JSON.stringify(topic.sources)]
        );
      }
    },

    async createSession(data) {
      const id = uuidv4();
      const row = await pg.queryOne(
        `INSERT INTO sessions (id, user_id, topic_id, attempt_number, status, started_at)
         VALUES ($1, $2, $3, $4, 'in_progress', NOW()) RETURNING *`,
        [id, data.user_id, data.topic_id, data.attempt_number || 1]
      );
      return row;
    },

    async getSession(id) {
      return pg.queryOne('SELECT * FROM sessions WHERE id = $1', [id]);
    },

    async updateSession(id, updates) {
      const fields = [];
      const values = [];
      let i = 1;
      for (const [key, val] of Object.entries(updates)) {
        fields.push(`${key} = $${i++}`);
        values.push(val);
      }
      values.push(id);
      return pg.queryOne(
        `UPDATE sessions SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
        values
      );
    },

    async getSessions(userId, options = {}) {
      let sql = `SELECT * FROM sessions WHERE user_id = $1`;
      const params = [userId];
      if (!options.includeInProgress) {
        sql += ` AND status = 'completed'`;
      }
      if (options.topicId) {
        params.push(options.topicId);
        sql += ` AND topic_id = $${params.length}`;
      }
      sql += ' ORDER BY started_at DESC';
      if (options.limit) {
        params.push(options.limit);
        sql += ` LIMIT $${params.length}`;
      }
      return pg.query(sql, params);
    },

    async getCompletedSessionCount(userId) {
      const row = await pg.queryOne(
        `SELECT COUNT(*)::int AS count FROM sessions WHERE user_id = $1 AND status = 'completed'`,
        [userId]
      );
      return row?.count || 0;
    },

    async getTotalCompletedSessions() {
      const row = await pg.queryOne(
        `SELECT COUNT(*)::int AS count FROM sessions WHERE status = 'completed'`
      );
      return row?.count || 0;
    },

    async saveEvaluation(data) {
      const id = uuidv4();
      const isDemo = data.isDemo ?? data.is_demo ?? true;
      const row = await pg.queryOne(
        `INSERT INTO evaluations (id, session_id, overall, speaking, comprehension, depth, reasoning, organization, clarity, vocabulary, strengths, improvements, recommendation, is_demo)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
        [
          id, data.session_id, data.overall, data.speaking, data.comprehension,
          data.depth, data.reasoning, data.organization, data.clarity, data.vocabulary,
          JSON.stringify(data.strengths), JSON.stringify(data.improvements), data.recommendation,
          isDemo,
        ]
      );
      return mapEvaluation(row);
    },

    async getEvaluation(sessionId) {
      const row = await pg.queryOne('SELECT * FROM evaluations WHERE session_id = $1', [sessionId]);
      return mapEvaluation(row);
    },

    async getEvaluationsForUser(userId) {
      const rows = await pg.query(
        `SELECT e.* FROM evaluations e
         JOIN sessions s ON s.id = e.session_id
         WHERE s.user_id = $1 AND s.status = 'completed'
         ORDER BY e.created_at DESC`,
        [userId]
      );
      return rows.map(mapEvaluation);
    },

    async getAchievements() {
      return pg.query('SELECT * FROM achievements ORDER BY name');
    },

    async getUserAchievements(userId) {
      const achievements = await pg.query('SELECT * FROM achievements ORDER BY name');
      const unlocked = await pg.query(
        'SELECT * FROM user_achievements WHERE user_id = $1',
        [userId]
      );
      return achievements.map((a) => {
        const ua = unlocked.find((u) => u.achievement_id === a.id);
        return { ...a, unlocked: !!ua, unlocked_at: ua?.unlocked_at || null };
      });
    },

    async unlockAchievement(userId, achievementId) {
      const existing = await pg.queryOne(
        'SELECT * FROM user_achievements WHERE user_id = $1 AND achievement_id = $2',
        [userId, achievementId]
      );
      if (existing) return existing;
      return pg.queryOne(
        `INSERT INTO user_achievements (user_id, achievement_id) VALUES ($1, $2) RETURNING *`,
        [userId, achievementId]
      );
    },

    async isSeeded() {
      const row = await pg.queryOne('SELECT COUNT(*)::int AS count FROM topics');
      return (row?.count || 0) > 0;
    },

    async seedAll(data) {
      for (const user of data.users) {
        await pg.query(
          `INSERT INTO users (id, username, email, xp, level, streak, best_streak, settings, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`,
          [user.id, user.username, user.email, user.xp, user.level, user.streak, user.best_streak, JSON.stringify(user.settings), user.created_at]
        );
      }
      for (const topic of data.topics) {
        await pg.query(
          `INSERT INTO topics (id, title, prompt, category, difficulty, description, research_time, sources)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
          [topic.id, topic.title, topic.prompt, topic.category, topic.difficulty, topic.description, topic.research_time, JSON.stringify(topic.sources)]
        );
      }
      for (const achievement of data.achievements) {
        await pg.query(
          `INSERT INTO achievements (id, slug, name, description, requirement_type, requirement_value)
           VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING`,
          [achievement.id, achievement.slug, achievement.name, achievement.description, achievement.requirement_type, achievement.requirement_value]
        );
      }
      for (const session of data.sessions) {
        await pg.query(
          `INSERT INTO sessions (id, user_id, topic_id, started_at, completed_at, research_duration, speaking_duration, attempt_number, notes_length, xp_earned, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO NOTHING`,
          [session.id, session.user_id, session.topic_id, session.started_at, session.completed_at, session.research_duration, session.speaking_duration, session.attempt_number, session.notes_length, session.xp_earned, session.status]
        );
      }
      for (const evaluation of data.evaluations) {
        await pg.query(
          `INSERT INTO evaluations (id, session_id, overall, speaking, comprehension, depth, reasoning, organization, clarity, vocabulary, strengths, improvements, recommendation, is_demo, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,true,$14) ON CONFLICT (id) DO NOTHING`,
          [evaluation.id, evaluation.session_id, evaluation.overall, evaluation.speaking, evaluation.comprehension, evaluation.depth, evaluation.reasoning, evaluation.organization, evaluation.clarity, evaluation.vocabulary, JSON.stringify(evaluation.strengths), JSON.stringify(evaluation.improvements), evaluation.recommendation, evaluation.created_at]
        );
      }
      for (const ua of data.user_achievements) {
        await pg.query(
          `INSERT INTO user_achievements (user_id, achievement_id, unlocked_at) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
          [ua.user_id, ua.achievement_id, ua.unlocked_at]
        );
      }
    },

    async exportUserData(userId) {
      const user = await this.getUser(userId);
      if (!user) throw new Error('User not found');
      const sessions = await this.getSessions(userId, { includeInProgress: true });
      const evaluations = await this.getEvaluationsForUser(userId);
      const achievements = await this.getUserAchievements(userId);
      const { password_hash, ...safeUser } = user;
      return {
        version: 1,
        exportedAt: new Date().toISOString(),
        user: safeUser,
        sessions,
        evaluations,
        achievements: achievements.filter((a) => a.unlocked).map((a) => ({
          achievement_id: a.id,
          unlocked_at: a.unlocked_at,
        })),
      };
    },

    async resetUserData(userId) {
      await pg.query(
        `DELETE FROM evaluations WHERE session_id IN (SELECT id FROM sessions WHERE user_id = $1)`,
        [userId]
      );
      await pg.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
      await pg.query('DELETE FROM user_achievements WHERE user_id = $1', [userId]);
      return this.updateUser(userId, { xp: 0, level: 1, streak: 0, best_streak: 0 });
    },

    async deleteUser(userId) {
      await this.resetUserData(userId);
      await pg.query('DELETE FROM signup_registrations WHERE user_id = $1', [userId]);
      await pg.query('DELETE FROM users WHERE id = $1', [userId]);
      return true;
    },

    async importUserData(userId, payload) {
      if (!payload || typeof payload !== 'object') {
        throw new Error('Invalid import data');
      }

      const sessions = Array.isArray(payload.sessions) ? payload.sessions : [];
      const evaluations = Array.isArray(payload.evaluations) ? payload.evaluations : [];
      const achievements = Array.isArray(payload.achievements) ? payload.achievements : [];
      const importedUser = payload.user || {};

      for (const session of sessions) {
        await pg.query(
          `INSERT INTO sessions (id, user_id, topic_id, started_at, completed_at, research_duration, speaking_duration, attempt_number, notes_length, xp_earned, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT (id) DO UPDATE SET
             user_id = EXCLUDED.user_id,
             topic_id = EXCLUDED.topic_id,
             started_at = EXCLUDED.started_at,
             completed_at = EXCLUDED.completed_at,
             research_duration = EXCLUDED.research_duration,
             speaking_duration = EXCLUDED.speaking_duration,
             attempt_number = EXCLUDED.attempt_number,
             notes_length = EXCLUDED.notes_length,
             xp_earned = EXCLUDED.xp_earned,
             status = EXCLUDED.status`,
          [
            session.id, userId, session.topic_id, session.started_at, session.completed_at,
            session.research_duration || 0, session.speaking_duration || 0,
            session.attempt_number || 1, session.notes_length || 0,
            session.xp_earned || 0, session.status || 'completed',
          ]
        );
      }

      const userSessions = await pg.query('SELECT id FROM sessions WHERE user_id = $1', [userId]);
      const sessionIds = userSessions.map((s) => s.id);

      if (sessionIds.length) {
        await pg.query(
          'DELETE FROM evaluations WHERE session_id = ANY($1::text[])',
          [sessionIds]
        );
      }

      for (const evaluation of evaluations) {
        if (!sessionIds.includes(evaluation.session_id)) continue;
        await pg.query(
          `INSERT INTO evaluations (id, session_id, overall, speaking, comprehension, depth, reasoning, organization, clarity, vocabulary, strengths, improvements, recommendation, is_demo, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
           ON CONFLICT (id) DO NOTHING`,
          [
            evaluation.id, evaluation.session_id, evaluation.overall, evaluation.speaking,
            evaluation.comprehension, evaluation.depth, evaluation.reasoning,
            evaluation.organization, evaluation.clarity, evaluation.vocabulary,
            JSON.stringify(evaluation.strengths || []),
            JSON.stringify(evaluation.improvements || []),
            evaluation.recommendation, evaluation.is_demo !== false,
            evaluation.created_at || new Date().toISOString(),
          ]
        );
      }

      await pg.query('DELETE FROM user_achievements WHERE user_id = $1', [userId]);
      for (const ach of achievements) {
        if (!ach.achievement_id) continue;
        await pg.query(
          `INSERT INTO user_achievements (user_id, achievement_id, unlocked_at) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
          [userId, ach.achievement_id, ach.unlocked_at || new Date().toISOString()]
        );
      }

      const updates = {};
      if (typeof importedUser.xp === 'number') updates.xp = importedUser.xp;
      if (typeof importedUser.level === 'number') updates.level = importedUser.level;
      if (typeof importedUser.streak === 'number') updates.streak = importedUser.streak;
      if (typeof importedUser.best_streak === 'number') updates.best_streak = importedUser.best_streak;
      if (importedUser.settings && typeof importedUser.settings === 'object') {
        const current = await this.getUser(userId);
        updates.settings = { ...current.settings, ...importedUser.settings };
      }

      const user = Object.keys(updates).length
        ? await this.updateUser(userId, updates)
        : await this.getUser(userId);

      return { user };
    },
  };
}

async function initDatabase() {
  if (db) return db;

  const useJson = config.useJsonFallback;

  if (!useJson && config.databaseUrl) {
    try {
      const pg = createPostgresStore(config.databaseUrl);
      await pg.init();
      await pg.pool.query('SELECT 1');
      db = createPostgresAdapter(pg);
      return db;
    } catch (err) {
      console.warn('PostgreSQL unavailable, falling back to JSON:', err.message);
    }
  }

  const store = createJsonStore();
  db = createJsonAdapter(store);
  await db.init();
  return db;
}

function getDb() {
  if (!db) throw new Error('Database not initialized');
  return db;
}

module.exports = { initDatabase, getDb };
