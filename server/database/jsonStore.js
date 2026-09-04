const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = path.join(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'fallback.json');
const TEMP_FILE = path.join(DATA_DIR, 'fallback.json.tmp');

const DEFAULT_DATA = {
  users: [],
  topics: [],
  sessions: [],
  evaluations: [],
  achievements: [],
  user_achievements: [],
  signup_registrations: [],
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readData() {
  ensureDataDir();
  if (!fs.existsSync(DATA_FILE)) {
    writeData(DEFAULT_DATA);
    return { ...DEFAULT_DATA };
  }
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.warn('JSON database corrupted, resetting:', err.message);
    writeData(DEFAULT_DATA);
    return { ...DEFAULT_DATA };
  }
}

function writeData(data) {
  ensureDataDir();
  fs.writeFileSync(TEMP_FILE, JSON.stringify(data, null, 2));
  fs.renameSync(TEMP_FILE, DATA_FILE);
}

function createJsonStore() {
  return {
    type: 'json',

    async init() {
      readData();
      console.log('Using JSON fallback database at', DATA_FILE);
    },

    async query(table, filter = {}) {
      const data = readData();
      let rows = data[table] || [];
      if (Object.keys(filter).length) {
        rows = rows.filter((row) =>
          Object.entries(filter).every(([k, v]) => row[k] === v)
        );
      }
      return rows;
    },

    async findOne(table, filter) {
      const rows = await this.query(table, filter);
      return rows[0] || null;
    },

    async insert(table, row) {
      const data = readData();
      if (!data[table]) data[table] = [];
      data[table].push(row);
      writeData(data);
      return row;
    },

    async update(table, filter, updates) {
      const data = readData();
      const rows = data[table] || [];
      let updated = null;
      for (let i = 0; i < rows.length; i++) {
        const match = Object.entries(filter).every(([k, v]) => rows[i][k] === v);
        if (match) {
          rows[i] = { ...rows[i], ...updates };
          updated = rows[i];
          break;
        }
      }
      writeData(data);
      return updated;
    },

    async upsert(table, filter, row) {
      const existing = await this.findOne(table, filter);
      if (existing) {
        return this.update(table, filter, row);
      }
      return this.insert(table, row);
    },

    async count(table, filter = {}) {
      const rows = await this.query(table, filter);
      return rows.length;
    },

    async replaceTable(table, rows) {
      const data = readData();
      data[table] = rows;
      writeData(data);
    },

    async getAll() {
      return readData();
    },

    async setAll(newData) {
      writeData(newData);
    },

    generateId() {
      return uuidv4();
    },
  };
}

module.exports = { createJsonStore, DATA_FILE };
