const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

function createPostgresStore(databaseUrl) {
  const isSupabase =
    databaseUrl.includes('supabase.co') || databaseUrl.includes('supabase.com');
  const pool = new Pool({
    connectionString: databaseUrl,
    ...(isSupabase ? { ssl: { rejectUnauthorized: false } } : {}),
  });

  return {
    type: 'postgres',
    pool,

    async init() {
      const schema = fs.readFileSync(
        path.join(__dirname, 'schema.sql'),
        'utf8'
      );
      await pool.query(schema);
      console.log('Connected to PostgreSQL');
    },

    async query(sql, params = []) {
      const result = await pool.query(sql, params);
      return result.rows;
    },

    async queryOne(sql, params = []) {
      const rows = await this.query(sql, params);
      return rows[0] || null;
    },

    async close() {
      await pool.end();
    },
  };
}

module.exports = { createPostgresStore };
