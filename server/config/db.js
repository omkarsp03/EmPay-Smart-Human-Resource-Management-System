/**
 * ==============================================================================
 * DATABASE MANAGER (PLAIN ENGLISH EXPLANATION)
 * ==============================================================================
 * Think of this file as the "Brain" of our app. 
 * 
 * Instead of asking a slow, traditional SQL database every single time a user clicks a button,
 * this file keeps a live, temporary copy of all data right here in the app's memory (RAM).
 * This makes the app incredibly fast!
 * 
 * However, RAM gets wiped if the server turns off. So, behind the scenes, this file 
 * acts as an automatic backup system. Whenever someone adds or changes data (like checking in),
 * this file quietly saves a copy to:
 *   1. A local text file (`app-state.json`)
 *   2. A local SQLite file (`app-state.db`)
 *   3. The main PostgreSQL Database
 * 
 * This guarantees speed for the user, but safety for the data!
 * ==============================================================================
 */

const { v4: uuidv4 } = require('uuid');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const COLLECTIONS = [
  'users',
  'attendance',
  'leaves',
  'leaveAllocations',
  'payroll',
  'notifications',
  'activityLogs',
];

// In-memory working set (controllers use this directly)
const db = {
  users: [],
  attendance: [],
  leaves: [],
  leaveAllocations: [],
  payroll: [],
  notifications: [],
  activityLogs: [],
};

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const DATA_FILE_PATH = process.env.DATA_FILE_PATH || path.join(__dirname, '../data/app-state.json');
const SQLITE_DB_PATH = process.env.SQLITE_DB_PATH || path.join(__dirname, '../data/app-state.db');
let pool = null;
let pgEnabled = false;
let sqliteDb = null;
let sqliteEnabled = true;
let persistTimer = null;
let persistInFlight = null;
let pendingAfterFlight = false;

const createPool = () => {
  if (!DATABASE_URL) return null;
  return new Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });
};

let nextId = null;

const generateId = () => {
  // On first run after server start, find the highest existing ID to prevent duplicates
  if (nextId === null) {
    let maxId = 100000; // Start IDs at a clean 6-digit number
    for (const collectionName of COLLECTIONS) {
      const collection = db[collectionName] || [];
      for (const doc of collection) {
        const numericId = parseInt(doc._id, 10);
        if (!isNaN(numericId) && numericId > maxId) {
          maxId = numericId;
        }
      }
    }
    nextId = maxId + 1;
  }

  const newId = nextId;
  nextId++;
  return newId; // Returns a simple integer like 100001
};

const replaceAllCollections = (snapshot) => {
  COLLECTIONS.forEach((c) => {
    db[c] = Array.isArray(snapshot?.[c]) ? snapshot[c] : [];
  });
};

const buildSnapshot = () => {
  const payload = {};
  COLLECTIONS.forEach((c) => {
    payload[c] = db[c];
  });
  return payload;
};

const loadFromFile = () => {
  try {
    if (!fs.existsSync(DATA_FILE_PATH)) return false;
    const raw = fs.readFileSync(DATA_FILE_PATH, 'utf8');
    if (!raw || !raw.trim()) return false;
    const parsed = JSON.parse(raw);
    replaceAllCollections(parsed);
    return true;
  } catch (error) {
    console.error('Failed to load state from file:', error.message);
    return false;
  }
};

const flushToFile = async () => {
  try {
    const dir = path.dirname(DATA_FILE_PATH);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(DATA_FILE_PATH, JSON.stringify(buildSnapshot(), null, 2), 'utf8');
  } catch (error) {
    console.error('File persist failed:', error.message);
  }
};

const openSqlite = async () => {
  if (!sqliteEnabled) return null;
  try {
    const dir = path.dirname(SQLITE_DB_PATH);
    await fs.promises.mkdir(dir, { recursive: true });
    return await new Promise((resolve, reject) => {
      const dbConn = new sqlite3.Database(SQLITE_DB_PATH, (err) => {
        if (err) return reject(err);
        resolve(dbConn);
      });
    });
  } catch (error) {
    console.error('Failed to open SQLite DB:', error.message);
    sqliteEnabled = false;
    return null;
  }
};

const sqliteRun = (sql, params = []) =>
  new Promise((resolve, reject) => {
    if (!sqliteDb) return resolve();
    sqliteDb.run(sql, params, function onRun(err) {
      if (err) return reject(err);
      resolve(this);
    });
  });

const sqliteGet = (sql, params = []) =>
  new Promise((resolve, reject) => {
    if (!sqliteDb) return resolve(null);
    sqliteDb.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });

const initSqlite = async () => {
  sqliteDb = await openSqlite();
  if (!sqliteDb) return false;
  await sqliteRun(`
    CREATE TABLE IF NOT EXISTS app_state (
      state_key TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  const row = await sqliteGet('SELECT payload FROM app_state WHERE state_key = ? LIMIT 1', ['main']);
  if (row?.payload) {
    try {
      const parsed = JSON.parse(row.payload);
      replaceAllCollections(parsed);
      return true;
    } catch {
      return false;
    }
  }
  return false;
};

const flushToSqlite = async () => {
  if (!sqliteEnabled || !sqliteDb) return;
  const payload = JSON.stringify(buildSnapshot());
  await sqliteRun(
    `INSERT INTO app_state (state_key, payload, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(state_key) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at`,
    ['main', payload, new Date().toISOString()]
  );
};

const flushToPostgres = async () => {
  if (!pgEnabled || !pool) return;
  const payload = buildSnapshot();

  await pool.query(
    `INSERT INTO app_state (state_key, payload, updated_at)
     VALUES ('main', $1::jsonb, NOW())
     ON CONFLICT (state_key)
     DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()`,
    [JSON.stringify(payload)]
  );
};

const queuePersist = () => {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    if (persistInFlight) {
      pendingAfterFlight = true;
      return;
    }
    persistInFlight = Promise.all([
      flushToPostgres().catch((err) => {
        console.error('PostgreSQL persist failed:', err.message);
      }),
      flushToSqlite().catch((err) => {
        console.error('SQLite persist failed:', err.message);
      }),
      flushToFile(),
    ])
      .finally(() => {
        persistInFlight = null;
        if (pendingAfterFlight) {
          pendingAfterFlight = false;
          queuePersist();
        }
      });
  }, 120);
};

const initDatabase = async () => {
  const fileLoaded = loadFromFile();
  const sqliteLoaded = await initSqlite();
  pool = createPool();
  if (!pool) {
    if (fileLoaded) {
      console.log(`Loaded state from file: ${DATA_FILE_PATH}`);
    }
    if (sqliteLoaded) {
      console.log(`Loaded state from SQLite: ${SQLITE_DB_PATH}`);
    }
    console.warn('DATABASE_URL not set: running in-memory only.');
    await Promise.all([flushToFile(), flushToSqlite()]);
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_state (
      state_key TEXT PRIMARY KEY,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const existing = await pool.query('SELECT payload FROM app_state WHERE state_key = $1 LIMIT 1', ['main']);
  if (existing.rows.length > 0) {
    replaceAllCollections(existing.rows[0].payload);
  } else {
    await pool.query(
      `INSERT INTO app_state (state_key, payload, updated_at)
       VALUES ('main', $1::jsonb, NOW())`,
      [JSON.stringify(db)]
    );
  }

  pgEnabled = true;
  await Promise.all([flushToFile(), flushToSqlite()]);
  console.log('PostgreSQL connected. Persistent storage enabled.');
};

const forcePersistNow = async () => {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  if (persistInFlight) {
    await persistInFlight;
  }
  await Promise.all([flushToPostgres(), flushToSqlite(), flushToFile()]);
};

const findById = (collection, id) => db[collection].find((item) => item._id === id);
const findByQuery = (collection, query) => {
  return db[collection].filter((item) => {
    return Object.entries(query).every(([key, value]) => {
      if (value === undefined || value === null) return true;
      if (typeof value === 'object' && value.$in) {
        return value.$in.includes(item[key]);
      }
      if (typeof value === 'object' && value.$gte && value.$lte) {
        return item[key] >= value.$gte && item[key] <= value.$lte;
      }
      if (typeof value === 'object' && value.$gte) {
        return item[key] >= value.$gte;
      }
      if (typeof value === 'object' && value.$lte) {
        return item[key] <= value.$lte;
      }
      if (typeof value === 'object' && value.$regex) {
        const regex = new RegExp(value.$regex, value.$options || '');
        return regex.test(item[key]);
      }
      return item[key] === value;
    });
  });
};

const insertOne = (collection, doc) => {
  const newDoc = {
    _id: generateId(),
    ...doc,
    createdAt: doc.createdAt || new Date().toISOString(),
  };
  db[collection].push(newDoc);
  queuePersist();
  return newDoc;
};

const updateOne = (collection, id, update) => {
  const index = db[collection].findIndex((item) => item._id === id);
  if (index === -1) return null;
  db[collection][index] = {
    ...db[collection][index],
    ...update,
    updatedAt: new Date().toISOString(),
  };
  queuePersist();
  return db[collection][index];
};

const deleteOne = (collection, id) => {
  const index = db[collection].findIndex((item) => item._id === id);
  if (index === -1) return false;
  db[collection].splice(index, 1);
  queuePersist();
  return true;
};

const count = (collection, query = {}) => {
  if (Object.keys(query).length === 0) return db[collection].length;
  return findByQuery(collection, query).length;
};

module.exports = {
  db,
  generateId,
  findById,
  findByQuery,
  insertOne,
  updateOne,
  deleteOne,
  count,
  initDatabase,
  forcePersistNow,
};
