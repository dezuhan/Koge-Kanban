import express from 'express';
import Database from 'better-sqlite3';
import cors from 'cors';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import helmet from 'helmet';
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SERVER_VERSION = '3.0.0';
const UPDATE_URL = 'https://raw.githubusercontent.com/dezuhan/Koge-Kanban/refs/heads/main/server.js';

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'koge-kanban-secret-key-change-me';

/**
 * Middleware: authenticateToken
 * Verifies JWT token and attaches user to the request.
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Authentication required' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // React scripts might need unsafe-inline/eval in dev
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", process.env.OLLAMA_HOST || "http://127.0.0.1:11434"],
    },
  },
}));



// CORS Configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:11434'];
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '10mb' })); // Limit payload size

// Database Configuration
const PROJECT_ROOT = path.resolve(__dirname);
const DATA_DIR = path.join(PROJECT_ROOT, 'db');

// --- AUTO-MIGRATION LOGIC ---
const ROOT_DB = path.join(PROJECT_ROOT, 'kanban.db');
const NEW_DB = path.join(DATA_DIR, 'kanban.db');

if (fs.existsSync(ROOT_DB)) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  try {
    console.log(`[Migration] Found database at root. Moving to ${DATA_DIR}...`);
    // Check if new db already exists to avoid overwriting newer data
    if (!fs.existsSync(NEW_DB)) {
      fs.renameSync(ROOT_DB, NEW_DB);
      // Also try to move WAL/SHM files if they exist
      ['kanban.db-wal', 'kanban.db-shm', 'kanban.db-journal'].forEach(ext => {
        const rootExt = path.join(PROJECT_ROOT, ext);
        if (fs.existsSync(rootExt)) fs.renameSync(rootExt, path.join(DATA_DIR, ext));
      });
      console.log(`[Migration] Success. Database moved to ${NEW_DB}`);
    } else {
      console.log(`[Migration] Target database already exists in db/. Skipping move to avoid data loss.`);
    }
  } catch (err) {
    console.error(`[Migration] Failed to move root database:`, err);
  }
}
// --- END MIGRATION ---

if (!fs.existsSync(DATA_DIR)) {
  console.log(`Creating database directory at: ${DATA_DIR}`);
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = process.env.DB_PATH || NEW_DB;
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const TEMP_DIR = path.join(DATA_DIR, 'temp');

if (!fs.existsSync(BACKUP_DIR)) {
  console.log(`Creating backup directory at: ${BACKUP_DIR}`);
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

if (!fs.existsSync(TEMP_DIR)) {
  console.log(`Creating temp directory at: ${TEMP_DIR}`);
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// --- GLOBAL CLEANUP ---
/**
 * Deletes any leftover temporary files from previous restore attempts.
 */
function cleanupLeftoverTempFiles() {
  const results = { deleted: [], errors: [] };
  try {
    // 1. Clean up the dedicated TEMP_DIR
    if (fs.existsSync(TEMP_DIR)) {
      const tempFiles = fs.readdirSync(TEMP_DIR);
      tempFiles.forEach(file => {
        const fullPath = path.join(TEMP_DIR, file);
        try {
          fs.unlinkSync(fullPath);
          results.deleted.push(`temp/${file}`);
          console.log(`[Cleanup] Deleted temp file: ${file}`);
        } catch (e) {
          results.errors.push({ file: `temp/${file}`, error: e.message });
        }
      });
    }

    // 2. Clean up any legacy temp files in the DATA_DIR (db/)
    if (fs.existsSync(DATA_DIR)) {
      const files = fs.readdirSync(DATA_DIR);
      files.forEach(file => {
        if (file.startsWith('temp_restore_')) {
          const fullPath = path.join(DATA_DIR, file);
          try {
            fs.unlinkSync(fullPath);
            results.deleted.push(file);
            console.log(`[Cleanup] Deleted legacy temp file: ${file}`);
          } catch (e) {
            results.errors.push({ file, error: e.message });
          }
        }
      });
    }

    // Also clean up any orphaned sidecar files in the backups directory
    if (fs.existsSync(BACKUP_DIR)) {
      const backupFiles = fs.readdirSync(BACKUP_DIR);
      backupFiles.forEach(file => {
        if (file.endsWith('-wal') || file.endsWith('-shm') || file.endsWith('-journal')) {
          const fullPath = path.join(BACKUP_DIR, file);
          try {
            fs.unlinkSync(fullPath);
            results.deleted.push(`backups/${file}`);
            console.log(`[Cleanup] Deleted orphaned backup sidecar: ${file}`);
          } catch (e) {
            results.errors.push({ file: `backups/${file}`, error: e.message });
          }
        }
      });
    }
  } catch (err) {
    console.error("[Cleanup] Error during cleanup:", err);
  }
  return results;
}
cleanupLeftoverTempFiles();

// Endpoint to trigger cleanup manually
app.post('/api/cleanup/temp', authenticateToken, (req, res) => {
  const results = cleanupLeftoverTempFiles();
  res.json({
    success: true,
    message: `Cleanup completed. Deleted ${results.deleted.length} temp files.`,
    details: results
  });
});

/**
 * Self-Update Logic
 */
async function checkForUpdates() {
  if (process.env.AUTO_UPDATE === 'false') return;

  console.log(`[Updater] Checking for updates... (Current Version: ${SERVER_VERSION})`);
  try {
    const response = await fetch(UPDATE_URL);
    if (!response.ok) throw new Error(`Github returned ${response.status}`);

    const remoteCode = await response.text();
    const versionMatch = remoteCode.match(/const SERVER_VERSION = '([\d.]+)';/);

    if (versionMatch && versionMatch[1]) {
      const remoteVersion = versionMatch[1];

      if (remoteVersion !== SERVER_VERSION) {
        console.log(`[Updater] New version detected: ${remoteVersion}. Downloading...`);
        fs.writeFileSync(__filename, remoteCode);
        console.log(`[Updater] server.js updated successfully to v${remoteVersion}.`);
        console.log(`[Updater] PLEASE RESTART THE SERVER TO APPLY CHANGES.`);
        return { updated: true, version: remoteVersion };
      } else {
        console.log(`[Updater] Already up to date (v${SERVER_VERSION}).`);
      }
    }
  } catch (err) {
    console.error(`[Updater] Update check failed:`, err.message);
  }
  return { updated: false };
}

// Manual Update Trigger
app.post('/api/admin/update', authenticateToken, async (req, res) => {
  // Only allow if it's the first registered user or check for admin role if you add one later
  if (req.user.id !== 1) {
    return res.status(403).json({ error: 'Only administrators can trigger system updates.' });
  }

  const result = await checkForUpdates();
  res.json({ success: true, ...result });
});

// Run update check on startup (after 3 seconds)
setTimeout(checkForUpdates, 3000);

// Initialize the database
let db;

/**
 * Initializes the SQLite database and ensures the required table exists.
 */
function initializeDatabase() {
  try {
    db = new Database(DB_PATH, { timeout: 10000 }); // Add 10s timeout to handle busy states

    // Enable WAL mode for better concurrency
    db.pragma('journal_mode = WAL');

    db.prepare(`
      CREATE TABLE IF NOT EXISTS kv_store (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `).run();

    db.prepare(`
      CREATE TABLE IF NOT EXISTS trash_store (
        key TEXT PRIMARY KEY,
        value TEXT,
        deleted_at INTEGER
      )
    `).run();

    db.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        email TEXT UNIQUE,
        password TEXT,
        created_at INTEGER
      )
    `).run();

    // --- MULTI-USER MIGRATION ---
    const tableInfo = db.prepare("PRAGMA table_info(kv_store)").all();
    const hasUserId = tableInfo.some(col => col.name === 'user_id');

    if (!hasUserId) {
      console.log("[Migration] Adding user_id support (Isolation) to kv_store and trash_store...");
      try {
        db.transaction(() => {
          // 1. kv_store migration
          db.prepare("ALTER TABLE kv_store RENAME TO kv_store_old").run();
          db.prepare(`
            CREATE TABLE kv_store (
              user_id INTEGER,
              key TEXT,
              value TEXT,
              PRIMARY KEY (user_id, key)
            )
          `).run();
          // Assume legacy data belongs to the first user or ID 1
          db.prepare("INSERT OR IGNORE INTO kv_store (user_id, key, value) SELECT 1, key, value FROM kv_store_old").run();
          db.prepare("DROP TABLE kv_store_old").run();

          // 2. trash_store migration
          db.prepare("ALTER TABLE trash_store RENAME TO trash_store_old").run();
          db.prepare(`
            CREATE TABLE trash_store (
              user_id INTEGER,
              key TEXT,
              value TEXT,
              deleted_at INTEGER,
              PRIMARY KEY (user_id, key)
            )
          `).run();
          db.prepare("INSERT OR IGNORE INTO trash_store (user_id, key, value, deleted_at) SELECT 1, key, value, deleted_at FROM trash_store_old").run();
          db.prepare("DROP TABLE trash_store_old").run();
        })();
        console.log("[Migration] Successfully migrated to multi-user schema.");
      } catch (err) {
        console.error("[Migration] Error during table migration:", err);
      }
    }

    console.log(`SQLite database checked/created at: ${DB_PATH}`);
  } catch (err) {
    console.error("Database Initialization Error:", err);
    console.log("Please ensure the directory is writable.");
  }
}

// Initialize DB on startup
initializeDatabase();

/**
 * Shared Helper: internalPerformRestore
 * Logic to restore an item from trash_store to kv_store.
 */
const internalPerformRestore = (db, key, options = {}) => {
  const userId = options.userId;
  if (!db) throw new Error("Database not initialized");
  if (!key) throw new Error("Key is required for restoration");
  if (!userId) throw new Error("User authentication required for restoration");

  const item = db.prepare("SELECT value FROM trash_store WHERE user_id = ? AND key = ?").get(userId, key);
  if (!item) throw new Error(`Item "${key}" not found in trash.`);

  const valueStr = item.value;
  if (!valueStr) throw new Error(`Item "${key}" has no data.`);

  let valueObj;
  try {
    valueObj = JSON.parse(valueStr);
  } catch (e) {
    throw new Error(`Item "${key}" has invalid data format.`);
  }

  const { type, id: targetId } = options;

  // Helper inside so we don't have to pass db around too much
  const ensureProject = (project) => {
    if (!project || !project.id) return;
    const pk = 'kanban_projects';
    const pr = db.prepare("SELECT value FROM kv_store WHERE user_id = ? AND key = ?").get(userId, pk);
    let projects = [];
    try {
      projects = pr ? JSON.parse(pr.value) : [];
      if (!Array.isArray(projects)) projects = [];
    } catch (e) { projects = []; }

    if (!projects.find(p => p.id === project.id)) {
      projects.push(project);
      db.prepare("INSERT OR REPLACE INTO kv_store (user_id, key, value) VALUES (?, ?, ?)")
        .run(userId, pk, JSON.stringify(projects));
    }
  };

  const ensureColumn = (projectId, column) => {
    if (!projectId || !column || !column.id) return;
    const ck = `columns_${projectId}`;
    const cr = db.prepare("SELECT value FROM kv_store WHERE user_id = ? AND key = ?").get(userId, ck);
    let columns = [];
    try {
      columns = cr ? JSON.parse(cr.value) : [];
      if (!Array.isArray(columns)) columns = [];
    } catch (e) { columns = []; }

    if (!columns.find(c => c.id === column.id)) {
      columns.push(column);
      db.prepare("INSERT OR REPLACE INTO kv_store (user_id, key, value) VALUES (?, ?, ?)")
        .run(userId, ck, JSON.stringify(columns));
    }
  };

  // 1. Partial restore from bundle (Task or Column)
  if (type && targetId) {
    if (key.startsWith('board_bundle_') || key.startsWith('column_bundle_')) {
      const projectId = key.startsWith('board_bundle_') ? key.replace('board_bundle_', '') : valueObj._projectId;

      if (type === 'task') {
        ensureProject(key.startsWith('board_bundle_') ? valueObj.project : { id: projectId });
        const task = valueObj.tasks?.find(t => t.id === targetId);
        if (!task) throw new Error("Task not found in bundle");

        const tk = `tasks_${projectId}`;
        const tr = db.prepare("SELECT value FROM kv_store WHERE user_id = ? AND key = ?").get(userId, tk);
        let currentTasks = [];
        try {
          currentTasks = tr ? JSON.parse(tr.value) : [];
          if (!Array.isArray(currentTasks)) currentTasks = [];
        } catch (e) { currentTasks = []; }

        if (!currentTasks.find(t => t.id === targetId)) {
          currentTasks.push(task);
          db.prepare("INSERT OR REPLACE INTO kv_store (user_id, key, value) VALUES (?, ?, ?)").run(userId, tk, JSON.stringify(currentTasks));
        }
        return { success: true, message: `Task ${targetId} restored from bundle.` };
      }

      if (type === 'column' && key.startsWith('board_bundle_')) {
        const column = valueObj.columns?.find(c => c.id === targetId);
        if (!column) throw new Error("Column not found in bundle");
        ensureProject(valueObj.project);
        ensureColumn(projectId, column);

        // Also restore tasks for this column
        const tasksToRestore = valueObj.tasks?.filter(t => t.status === targetId) || [];
        const tk = `tasks_${projectId}`;
        const tr = db.prepare("SELECT value FROM kv_store WHERE user_id = ? AND key = ?").get(userId, tk);
        let currentTasks = [];
        try {
          currentTasks = tr ? JSON.parse(tr.value) : [];
          if (!Array.isArray(currentTasks)) currentTasks = [];
        } catch (e) { currentTasks = []; }

        tasksToRestore.forEach(t => {
          if (!currentTasks.find(ct => ct.id === t.id)) currentTasks.push(t);
        });
        db.prepare("INSERT OR REPLACE INTO kv_store (user_id, key, value) VALUES (?, ?, ?)").run(userId, tk, JSON.stringify(currentTasks));
        return { success: true, message: `Column ${targetId} and its tasks restored.` };
      }
    }
  }

  // 2. Full item restore
  if (key.startsWith('task:')) {
    const parts = key.split(':');
    if (parts.length === 3) {
      const projectId = parts[1];
      const pk = 'kanban_projects';
      const pr = db.prepare("SELECT value FROM kv_store WHERE user_id = ? AND key = ?").get(userId, pk);
      let projects = [];
      try {
        projects = pr ? JSON.parse(pr.value) : [];
      } catch (e) { }

      if (!projects || !projects.find(p => p.id === projectId)) {
        const bk = `board_bundle_${projectId}`;
        const bi = db.prepare("SELECT value FROM trash_store WHERE user_id = ? AND key = ?").get(userId, bk);
        if (bi) {
          try {
            ensureProject(JSON.parse(bi.value).project);
          } catch (e) {
            throw new Error("Failed to recover parent project from bundle.");
          }
        } else {
          throw new Error("Parent project is missing and no board bundle found in trash.");
        }
      }
      const tk = `tasks_${projectId}`;
      const tr = db.prepare("SELECT value FROM kv_store WHERE user_id = ? AND key = ?").get(userId, tk);
      let tasks = [];
      try {
        tasks = tr ? JSON.parse(tr.value) : [];
        if (!Array.isArray(tasks)) tasks = [];
      } catch (e) { tasks = []; }

      if (!tasks.find(t => t.id === valueObj.id)) {
        tasks.push(valueObj);
        db.prepare("INSERT OR REPLACE INTO kv_store (user_id, key, value) VALUES (?, ?, ?)").run(userId, tk, JSON.stringify(tasks));
      }
    }
  } else if (key.startsWith('project_info_')) {
    const pk = 'kanban_projects';
    const pr = db.prepare("SELECT value FROM kv_store WHERE user_id = ? AND key = ?").get(userId, pk);
    let projects = [];
    try {
      projects = pr ? JSON.parse(pr.value) : [];
      if (!Array.isArray(projects)) projects = [];
    } catch (e) { projects = []; }

    if (!projects.find(p => p.id === valueObj.id)) {
      projects.push(valueObj);
      db.prepare("INSERT OR REPLACE INTO kv_store (user_id, key, value) VALUES (?, ?, ?)").run(userId, pk, JSON.stringify(projects));
    }
  } else if (key.startsWith('board_bundle_')) {
    const { project, tasks, columns } = valueObj;
    if (!project) throw new Error("Invalid board bundle: missing project info");
    ensureProject(project);
    db.prepare("INSERT OR REPLACE INTO kv_store (user_id, key, value) VALUES (?, ?, ?)").run(userId, `tasks_${project.id}`, JSON.stringify(tasks || []));
    db.prepare("INSERT OR REPLACE INTO kv_store (user_id, key, value) VALUES (?, ?, ?)").run(userId, `columns_${project.id}`, JSON.stringify(columns || []));
  } else if (key.startsWith('column_bundle_')) {
    const { column, tasks, _projectId } = valueObj;
    if (!column || !_projectId) throw new Error("Invalid column bundle: missing data");

    const pk = 'kanban_projects';
    const pr = db.prepare("SELECT value FROM kv_store WHERE user_id = ? AND key = ?").get(userId, pk);
    let projects = [];
    try {
      projects = pr ? JSON.parse(pr.value) : [];
    } catch (e) { }

    if (!projects || !projects.find(p => p.id === _projectId)) {
      const bk = `board_bundle_${_projectId}`;
      const bi = db.prepare("SELECT value FROM trash_store WHERE user_id = ? AND key = ?").get(userId, bk);
      if (bi) ensureProject(JSON.parse(bi.value).project);
      else throw new Error("Parent project missing and no board bundle available.");
    }
    ensureColumn(_projectId, column);
    const tk = `tasks_${_projectId}`;
    const tr = db.prepare("SELECT value FROM kv_store WHERE user_id = ? AND key = ?").get(userId, tk);
    let currentTasks = [];
    try {
      currentTasks = tr ? JSON.parse(tr.value) : [];
      if (!Array.isArray(currentTasks)) currentTasks = [];
    } catch (e) { currentTasks = []; }

    const ids = new Set(currentTasks.map(t => t.id));
    (tasks || []).forEach(t => { if (!ids.has(t.id)) currentTasks.push(t); });
    db.prepare("INSERT OR REPLACE INTO kv_store (user_id, key, value) VALUES (?, ?, ?)").run(userId, tk, JSON.stringify(currentTasks));
  } else {
    // Generic KV restore
    db.prepare("INSERT OR REPLACE INTO kv_store (user_id, key, value) VALUES (?, ?, ?)").run(userId, key, valueStr);
  }

  // Clean up trash after successful restore
  db.prepare("DELETE FROM trash_store WHERE user_id = ? AND key = ?").run(userId, key);
  return { success: true };
};

// Health Check Endpoint (Public)
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    message: 'Koge-Kanban Server is running',
    version: SERVER_VERSION,
    database: db ? 'connected' : 'disconnected'
  });
});

// New Endpoint: Get all tasks from all projects for the authenticated user
app.get('/api/tasks/global', authenticateToken, (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database not initialized' });
  const userId = req.user.id;

  try {
    const rows = db.prepare("SELECT key, value FROM kv_store WHERE user_id = ? AND key LIKE 'tasks_%'").all(userId);

    // Flatten all task arrays into one single array AND inject projectId from the key
    const allTasks = rows.reduce((acc, row) => {
      try {
        const keyParts = row.key ? row.key.split('tasks_') : [];
        const projectId = keyParts.length > 1 ? keyParts[1] : null;

        const tasks = JSON.parse(row.value);

        if (Array.isArray(tasks)) {
          const tasksWithPid = tasks.map(t => ({
            ...t,
            _projectId: projectId
          }));
          return [...acc, ...tasksWithPid];
        }
        return acc;
      } catch (e) {
        console.error("Error parsing task row", e);
        return acc;
      }
    }, []);

    res.json(allTasks);
  } catch (error) {
    console.error(`Database global tasks error:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Generic GET endpoint
app.get('/api/data/:key', authenticateToken, (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database not initialized' });
  const userId = req.user.id;

  if (!req.params.key || req.params.key.length > 255) {
    return res.status(400).json({ error: 'Invalid key' });
  }

  try {
    const row = db.prepare("SELECT value FROM kv_store WHERE user_id = ? AND key = ?").get(userId, req.params.key);

    if (row) {
      res.json(JSON.parse(row.value));
    } else {
      res.json(null);
    }
  } catch (error) {
    console.error(`Database read error for key ${req.params.key}:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Generic POST endpoint
app.post('/api/data/:key', authenticateToken, (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database not initialized' });
  const userId = req.user.id;

  if (!req.params.key || req.params.key.length > 255) {
    return res.status(400).json({ error: 'Invalid key' });
  }

  try {
    const valueStr = JSON.stringify(req.body);

    db.prepare(
      "INSERT OR REPLACE INTO kv_store (user_id, key, value) VALUES (?, ?, ?)"
    ).run(userId, req.params.key, valueStr);

    res.json({ success: true });
  } catch (error) {
    console.error(`Database write error for key ${req.params.key}:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Generic DELETE endpoint (Now with Soft Delete)
app.delete('/api/data/:key', authenticateToken, (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database not initialized' });

  const key = req.params.key;
  const userId = req.user.id;
  const isPermanent = req.query.permanent === 'true';

  try {
    let affectedKeys = [];

    // 1. Identify keys to "delete"
    if (key.endsWith('*')) {
      const prefix = key.slice(0, -1);
      if (prefix.length < 3) {
        return res.status(400).json({ error: 'Wildcard prefix too short' });
      }
      const rows = db.prepare("SELECT key, value FROM kv_store WHERE user_id = ? AND key LIKE ?").all(userId, `${prefix}%`);
      affectedKeys = rows;
    } else {
      const row = db.prepare("SELECT key, value FROM kv_store WHERE user_id = ? AND key = ?").get(userId, key);
      if (row) affectedKeys = [row];
    }

    if (affectedKeys.length === 0) {
      return res.json({ success: true, message: `No keys matching '${key}' found.` });
    }

    // 2. Perform Delete (Soft or Permanent)
    const now = Date.now();
    const insertTrash = db.prepare("INSERT OR REPLACE INTO trash_store (user_id, key, value, deleted_at) VALUES (?, ?, ?, ?)");
    const deleteMain = db.prepare("DELETE FROM kv_store WHERE user_id = ? AND key = ?");

    const transaction = db.transaction((items) => {
      for (const item of items) {
        if (!isPermanent) {
          insertTrash.run(userId, item.key, item.value, now);
        }
        deleteMain.run(userId, item.key);
      }
    });

    transaction(affectedKeys);

    res.json({
      success: true,
      message: isPermanent ? `Permanently deleted ${affectedKeys.length} items.` : `Moved ${affectedKeys.length} items to Trash.`,
      count: affectedKeys.length
    });
  } catch (error) {
    console.error(`Database delete error for key ${req.params.key}:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/trash/item
 * Explicitly move an item to trash. Used for items that don't have a unique DB key
 * but should be recoverable (like individual tasks within a project list).
 */
app.post('/api/trash/item', authenticateToken, (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database not initialized' });

  const { key, value } = req.body;
  const userId = req.user.id;
  if (!key || !value) {
    return res.status(400).json({ error: 'Key and value are required' });
  }

  try {
    const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
    const now = Date.now();

    db.prepare(
      "INSERT OR REPLACE INTO trash_store (user_id, key, value, deleted_at) VALUES (?, ?, ?, ?)"
    ).run(userId, key, valueStr, now);

    res.json({ success: true, message: 'Item moved to trash.' });
  } catch (error) {
    console.error(`Database trash error for key ${key}:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Trash Management Endpoints ---

/**
 * GET /api/trash
 * Returns all items currently in the trash.
 */
app.get('/api/trash', authenticateToken, (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database not initialized' });
  const userId = req.user.id;
  try {
    const rows = db.prepare("SELECT key, value, deleted_at FROM trash_store WHERE user_id = ? ORDER BY deleted_at DESC").all(userId);
    const items = rows.map(r => ({
      key: r.key,
      value: JSON.parse(r.value),
      deletedAt: r.deleted_at
    }));
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch trash' });
  }
});

/**
 * POST /api/trash/restore/:key
 * Restores an item from trash back to the main store.
 */
app.post('/api/trash/restore/:key', authenticateToken, (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database not initialized' });
  const key = req.params.key;
  const userId = req.user.id;
  const options = req.body || {};

  try {
    const result = internalPerformRestore(db, key, { ...options, userId });
    res.json(result);
  } catch (error) {
    console.error(`Restore error for ${key}:`, error);
    res.status(500).json({ error: 'Failed to restore', details: error.message });
  }
});

/**
 * POST /api/trash/restore-bulk
 * Restores multiple items from trash.
 */
app.post('/api/trash/restore-bulk', authenticateToken, (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database not initialized' });
  const { keys } = req.body;
  const userId = req.user.id;
  if (!Array.isArray(keys)) return res.status(400).json({ error: 'Keys must be an array' });

  const results = { success: [], errors: [] };

  try {
    const transaction = db.transaction(() => {
      for (const key of keys) {
        try {
          internalPerformRestore(db, key, { userId });
          results.success.push(key);
        } catch (err) {
          results.errors.push({ key, error: err.message || 'Unknown error during item restoration' });
        }
      }
    });

    transaction();

    res.json({
      success: true,
      message: `Processed ${keys.length} items: ${results.success.length} succeeded, ${results.errors.length} failed.`,
      results
    });
  } catch (err) {
    console.error("Bulk restore system error:", err);
    res.status(500).json({
      error: 'Bulk restore transaction failed',
      details: err.message || 'A database or system error occurred.'
    });
  }
});

/**
 * DELETE /api/trash/permanent/:key
 * Permanently deletes an item from the trash.
 */
app.delete('/api/trash/permanent/:key', authenticateToken, (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database not initialized' });
  const key = req.params.key;
  const userId = req.user.id;
  try {
    let info;
    if (key === '__all__') {
      info = db.prepare("DELETE FROM trash_store WHERE user_id = ?").run(userId);
    } else {
      info = db.prepare("DELETE FROM trash_store WHERE user_id = ? AND key = ?").run(userId, key);
    }
    res.json({ success: true, deletedCount: info.changes });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete permanently' });
  }
});

// --- Authentication Endpoints ---

/**
 * POST /api/auth/register
 * Register a new user
 */
app.post('/api/auth/register', async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database not initialized' });
  const { username, email, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    // Check if user exists
    const existing = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
    if (existing) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const now = Date.now();

    const info = db.prepare(
      "INSERT INTO users (username, email, password, created_at) VALUES (?, ?, ?, ?)"
    ).run(username, email || '', hashedPassword, now);

    const token = jwt.sign({ id: info.lastInsertRowid, username }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      message: 'User registered successfully',
      token,
      user: { id: info.lastInsertRowid, username, email }
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: 'Registration failed', details: err.message });
  }
});

/**
 * POST /api/auth/login
 * Login existing user
 */
app.post('/api/auth/login', async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database not initialized' });
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      token,
      user: { id: user.id, username: user.username, email: user.email }
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: 'Login failed', details: err.message });
  }
});

/**
 * DELETE /api/auth/user/:id
 * Delete a user account (Simple version without token validation for now, but usually should be authenticated)
 */
app.delete('/api/auth/user/:id', authenticateToken, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database not initialized' });
  const id = req.params.id;
  const targetId = !isNaN(Number(id)) ? Number(id) : id;

  // Only allow deleting own account (unless we add admin logic later)
  if (req.user.id !== targetId) {
    return res.status(403).json({ error: 'You can only delete your own account.' });
  }

  try {
    console.log(`[Account] Attempting to delete user ID: ${targetId}`);
    const transaction = db.transaction(() => {
      // 1. Delete user record
      const info = db.prepare("DELETE FROM users WHERE id = ?").run(targetId);

      if (info.changes > 0) {
        // 2. Wipe ONLY this user's data from the connection (Isolation)
        db.prepare("DELETE FROM kv_store WHERE user_id = ?").run(targetId);
        db.prepare("DELETE FROM trash_store WHERE user_id = ?").run(targetId);
        console.log(`[Account] User ${targetId} data successfully wiped.`);
      }
      return info;
    });

    const info = transaction();

    if (info.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({
      success: true,
      message: 'Your account and all associated data have been permanently deleted.'
    });
  } catch (err) {
    console.error("Delete user and data error:", err);
    res.status(500).json({ error: 'Failed to delete account and data', details: err.message });
  }
});

// --- Data Management Endpoints ---

/**
 * POST /api/reset
 * Wipes all project-related data (projects, tasks, columns, trash) 
 * but preserves system settings and backups.
 */
app.post('/api/reset', authenticateToken, (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database not initialized' });
  const userId = req.user.id;
  const { includeBackups } = req.body;

  try {
    const transaction = db.transaction(() => {
      // Clear ONLY THIS user's data
      db.prepare("DELETE FROM kv_store WHERE user_id = ?").run(userId);
      db.prepare("DELETE FROM trash_store WHERE user_id = ?").run(userId);
    });

    transaction();

    let backupMessage = '';
    // Backups are user-isolated. 
    // If includeBackups is true, only delete backups belonging to this specific user.
    if (includeBackups) {
      if (fs.existsSync(BACKUP_DIR)) {
        const files = fs.readdirSync(BACKUP_DIR);
        const prefix = `user-${userId}-backup-`;
        for (const file of files) {
          if (file.startsWith(prefix)) {
            try {
              fs.unlinkSync(path.join(BACKUP_DIR, file));
            } catch (e) {
              console.error(`Failed to delete backup ${file}:`, e);
            }
          }
        }
        backupMessage = ' and all your backups were deleted';
      }
    }

    res.json({ success: true, message: `All your project data${backupMessage} has been wiped.` });
  } catch (err) {
    console.error("Reset error:", err);
    res.status(500).json({ error: 'Failed to reset data', details: err.message });
  }
});

// --- Backup Endpoints ---

/**
 * POST /api/backup
 * Creates a JSON export of the user's data.
 */
app.post('/api/backup', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupName = `user-${userId}-backup-${timestamp}.json`;
  const backupPath = path.join(BACKUP_DIR, backupName);

  try {
    if (!db) throw new Error("DB not initialized");

    const kvData = db.prepare("SELECT key, value FROM kv_store WHERE user_id = ?").all(userId);
    const trashData = db.prepare("SELECT key, value, deleted_at FROM trash_store WHERE user_id = ?").all(userId);

    const exportData = {
      version: '1.0.0',
      userId: userId,
      timestamp: Date.now(),
      data: {
        kv_store: kvData,
        trash_store: trashData
      }
    };

    fs.writeFileSync(backupPath, JSON.stringify(exportData, null, 2));
    res.json({ success: true, filename: backupName });
  } catch (err) {
    console.error("Backup failed:", err);
    res.status(500).json({ error: 'Backup failed', details: err.message });
  }
});

/**
 * GET /api/backups
 * Lists available backups for the authenticated user.
 */
app.get('/api/backups', authenticateToken, (req, res) => {
  const userId = req.user.id;
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith(`user-${userId}-backup-`) && f.endsWith('.json'))
      .map(f => {
        const stats = fs.statSync(path.join(BACKUP_DIR, f));
        return {
          filename: f,
          size: stats.size,
          createdAt: stats.mtimeMs
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt);
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list backups' });
  }
});

/**
 * DELETE /api/backups/:filename
 * Deletes a specific backup file belonging to the user.
 */
app.delete('/api/backups/:filename', authenticateToken, (req, res) => {
  const filename = req.params.filename;
  const userId = req.user.id;

  // Security: Prevent path traversal and enforce ownership
  if (!filename.startsWith(`user-${userId}-backup-`) || !filename.endsWith('.json') || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(403).json({ error: 'Invalid backup filename or ownership' });
  }

  const filePath = path.join(BACKUP_DIR, filename);

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Backup not found' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete backup', details: err.message });
  }
});

/**
 * POST /api/backups/restore
 * Restores the database from a backup file.
 */
app.post('/api/backups/restore', authenticateToken, async (req, res) => {
  const { filename } = req.body;
  const userId = req.user.id;

  if (!filename) return res.status(400).json({ error: 'Missing backup filename' });

  // Enforce ownership check
  if (!filename.startsWith(`user-${userId}-backup-`) || !filename.endsWith('.json') || filename.includes('..')) {
    return res.status(403).json({ error: 'Unauthorized restore attempt' });
  }

  const filePath = path.join(BACKUP_DIR, filename);

  try {
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Backup file not found' });

    const content = fs.readFileSync(filePath, 'utf-8');
    const backup = JSON.parse(content);

    // One more safety check on data content
    if (backup.userId && backup.userId !== userId) {
      return res.status(403).json({ error: 'Backup file does not belong to you' });
    }

    const { kv_store, trash_store } = backup.data || {};

    try {
      const restoreTransaction = db.transaction(() => {
        // Scoped Clear: Only delete THIS user's data
        db.prepare("DELETE FROM kv_store WHERE user_id = ?").run(userId);
        db.prepare("DELETE FROM trash_store WHERE user_id = ?").run(userId);

        // Scoped insertion
        const insertKV = db.prepare("INSERT INTO kv_store (user_id, key, value) VALUES (?, ?, ?)");
        if (kv_store) {
          for (const row of kv_store) {
            insertKV.run(userId, row.key, row.value);
          }
        }

        const insertTrash = db.prepare("INSERT INTO trash_store (user_id, key, value, deleted_at) VALUES (?, ?, ?, ?)");
        if (trash_store) {
          for (const row of trash_store) {
            insertTrash.run(userId, row.key, row.value, row.deleted_at);
          }
        }
      });

      restoreTransaction();
      res.json({ success: true, message: 'Your data has been restored successfully.' });
    } catch (err) {
      throw err;
    }
  } catch (err) {
    console.error("Restore failed:", err);
    res.status(500).json({ error: 'Failed to restore database', details: err.message });
  }
});

// Auto-backup Scheduler (Multi-User)
const runAutoBackup = async () => {
  if (!db) return;

  try {
    const users = db.prepare("SELECT id FROM users").all();

    for (const user of users) {
      const userId = user.id;
      const row = db.prepare("SELECT value FROM kv_store WHERE user_id = ? AND key = ?").get(userId, 'kanban_settings');
      if (!row) continue;

      const settings = JSON.parse(row.value);
      const intervalDays = parseInt(settings.autoBackupInterval);

      if (!intervalDays || intervalDays <= 0) continue;

      // Check last backup time for THIS user
      const files = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.startsWith(`user-${userId}-backup-`) && f.endsWith('-auto.json'));

      if (files.length > 0) {
        const stats = files.map(f => fs.statSync(path.join(BACKUP_DIR, f)));
        const latestBackup = Math.max(...stats.map(s => s.mtimeMs));
        const diffDays = (Date.now() - latestBackup) / (1000 * 60 * 60 * 24);

        if (diffDays < intervalDays) continue;
      }

      // Perform backup for this specific user (JSON Export)
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupName = `user-${userId}-backup-${timestamp}-auto.json`;
      const backupPath = path.join(BACKUP_DIR, backupName);

      const kvData = db.prepare("SELECT key, value FROM kv_store WHERE user_id = ?").all(userId);
      const trashData = db.prepare("SELECT key, value, deleted_at FROM trash_store WHERE user_id = ?").all(userId);

      const exportData = {
        version: '1.0.0',
        userId: userId,
        timestamp: Date.now(),
        data: { kv_store: kvData, trash_store: trashData }
      };

      fs.writeFileSync(backupPath, JSON.stringify(exportData, null, 2));
      console.log(`[Auto-Backup] User ${userId}: JSON backup created.`);
    }
  } catch (err) {
    console.error("[Auto-Backup] Multi-user task failed:", err);
  }
};

// Run auto-backup check every 6 hours
setInterval(runAutoBackup, 6 * 60 * 60 * 1000);
// Also run once on startup (after a short delay to ensure everything is initialized)
setTimeout(runAutoBackup, 10000);

// Auto-cleanup task for trash (Multi-User)
const cleanupExpiredTrash = () => {
  if (!db) return;
  try {
    const users = db.prepare("SELECT id FROM users").all();

    for (const user of users) {
      const userId = user.id;
      let retentionMs = 3 * 24 * 60 * 60 * 1000;

      const settingRow = db.prepare("SELECT value FROM kv_store WHERE user_id = ? AND key = 'trash_retention_days'").get(userId);
      if (settingRow) {
        const days = parseInt(JSON.parse(settingRow.value));
        if (!isNaN(days)) retentionMs = days * 24 * 60 * 60 * 1000;
      }

      const expirationTime = Date.now() - retentionMs;
      const info = db.prepare("DELETE FROM trash_store WHERE user_id = ? AND deleted_at < ?").run(userId, expirationTime);
      if (info.changes > 0) {
        console.log(`[Trash Cleanup] User ${userId}: Permanently removed ${info.changes} expired items.`);
      }
    }
  } catch (err) {
    console.error("[Trash Cleanup] Error:", err);
  }
};

// Run cleanup every hour
setInterval(cleanupExpiredTrash, 60 * 60 * 1000);
// Also run once on startup after a short delay
setTimeout(cleanupExpiredTrash, 5000);

// --- AI Integration (Ollama) ---

const rawOllamaHost = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
const DEFAULT_OLLAMA_HOST = rawOllamaHost.split(',')[0].trim();

/**
 * SECURITY FIX:
 * Only allow host from environment variable or localhost default in production.
 * In development, we allow the client to specify the endpoint for flexibility.
 */
const getOllamaHost = (req) => {
  let host = DEFAULT_OLLAMA_HOST;

  if (process.env.NODE_ENV !== 'production') {
    const clientEndpoint = req.headers['x-ollama-endpoint'];
    if (clientEndpoint) {
      host = clientEndpoint;
    }
  }

  // Ensure protocol exists
  if (host && !host.startsWith('http://') && !host.startsWith('https://')) {
    host = `http://${host}`;
  }

  // Handle missing port for local addresses (default to 11434 for Ollama)
  // We check if there's no colon after the protocol part (e.g., http://localhost has no second colon)
  const protocolPart = host.startsWith('https') ? 8 : 7;
  if (host && !host.slice(protocolPart).includes(':')) {
    const hostname = host.slice(protocolPart).split('/')[0];
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') {
      host = host.replace(hostname, `${hostname}:11434`);
    }
  }

  // Handle trailing slash
  return host.endsWith('/') ? host.slice(0, -1) : host;
};

/**
 * GET /api/ai/models
 * Proxies request to local Ollama to get list of installed models
 * Publicly accessible so status indicators work for all users (including guests).
 */
app.get('/api/ai/models', async (req, res) => {
  const ollamaHost = getOllamaHost(req);
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${ollamaHost}/api/tags`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error("Failed to fetch models from Ollama");

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("AI Models Fetch Error:", error);
    res.status(503).json({ error: "Ollama service is offline or unreachable.", details: error.message });
  }
});

/**
 * POST /api/ai/generate
 * Proxies request to local Ollama instance
 */
app.post('/api/ai/generate', authenticateToken, async (req, res) => {
  const { prompt, model, options } = req.body;
  const ollamaHost = getOllamaHost(req);
  const targetModel = model || "gemma3:4b";

  try {
    const requestBody = {
      model: targetModel,
      prompt: prompt,
      stream: false
    };

    if (options) {
      requestBody.options = options;
    }

    const ollamaRes = await fetch(`${ollamaHost}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!ollamaRes.ok) {
      const errorText = await ollamaRes.text();
      return res.status(ollamaRes.status).json({
        error: `Ollama error: ${ollamaRes.statusText}`,
        details: errorText
      });
    }

    const data = await ollamaRes.json();
    res.json({ response: data.response });

  } catch (error) {
    console.error("AI Generation Error:", error.message);
    res.status(500).json({ error: `Failed to connect to Ollama: ${error.message}` });
  }
});

/**
 * POST /api/ai/chat
 * Proxies chat request to local Ollama instance
 */
app.post('/api/ai/chat', authenticateToken, async (req, res) => {
  const { messages, model, options } = req.body;
  const ollamaHost = getOllamaHost(req);
  const targetModel = model || "gemma3:4b";

  try {
    const requestBody = {
      model: targetModel,
      messages: messages,
      stream: false
    };

    if (options) {
      requestBody.options = options;
    }

    const ollamaRes = await fetch(`${ollamaHost}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!ollamaRes.ok) {
      const errorText = await ollamaRes.text();
      return res.status(ollamaRes.status).json({
        error: `Ollama error: ${ollamaRes.statusText}`,
        details: errorText
      });
    }

    const data = await ollamaRes.json();
    res.json({ message: data.message });

  } catch (error) {
    console.error("[AI Chat] Critical Error:", error.message);
    res.status(500).json({ error: `Failed to connect to Ollama: ${error.message}` });
  }
});

// Catch-all handler for any request that doesn't match an API route
app.get('*', (req, res) => {
  // Don't intercept API routes
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  // res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  res.send("Server is running. Frontend not served in this environment.");
  console.log("Server is running. Frontend not served in this environment.");
});

// Export the app for Vercel
export default app;

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend server running on http://127.0.0.1:${PORT}`);
    console.log(`Security: CORS enabled for origins: ${allowedOrigins.join(', ')}`);
  });
}
