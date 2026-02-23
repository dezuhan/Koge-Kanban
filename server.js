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
import crypto from 'crypto';
import { Server } from 'socket.io';
import { createServer } from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const httpServer = createServer(app);
const ENABLE_WEBSOCKET = process.env.ENABLE_WEBSOCKET !== 'false'; // Change to false manually or via env to disable

let io;
if (ENABLE_WEBSOCKET) {
  io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });
} else {
  console.log("WebSocket is disabled by configuration.");
  io = {
    use: () => { },
    on: () => { },
    to: () => ({ emit: () => { } }),
    emit: () => { }
  };

  // Prevent socket.io requests falling through to catch-all if disabled
  app.all('/socket.io/*', (req, res) => {
    res.status(404).send('Websocket support is disabled.');
  });
}

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
const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:5173', 'http://localhost:3000'];
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
}));

app.use(express.json({ limit: '10mb' })); // Limit payload size

// Serve static files from the 'dist' directory
app.use(express.static(path.join(__dirname, 'dist')));

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

// --- Socket.io Real-time Logic ---
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    if (socket.handshake.headers['x-is-guest'] === 'true') {
      socket.user = { id: 0, username: 'Guest' };
      return next();
    }
    return next(new Error('Authentication error'));
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return next(new Error('Authentication error'));
    socket.user = user;
    next();
  });
});

io.on('connection', (socket) => {
  console.log(`[Socket] User connected: ${socket.id} (User ID: ${socket.user?.id})`);

  socket.on('join_project', (projectId) => {
    if (!socket.user) return;

    // SECURITY CHECK: Verify if user has access to this project
    try {
      if (socket.user.id !== 0) {
        const hasAccess = db.prepare("SELECT 1 FROM project_access WHERE project_id = ? AND user_id = ?").get(projectId, socket.user.id);
        if (!hasAccess) {
          console.warn(`[Socket] Unauthorized join attempt for project ${projectId} by user ${socket.user.id}`);
          return;
        }
      }
      socket.join(`project_${projectId}`);
      console.log(`[Socket] User ${socket.user.id} joined project room: ${projectId}`);
    } catch (err) {
      console.error("[Socket] Join project error:", err);
    }
  });

  socket.on('join_user', (userId) => {
    if (!socket.user) return;

    // SECURITY CHECK: User can only join their own room
    if (socket.user.id != userId) {
      console.warn(`[Socket] Unauthorized join attempt for user room ${userId} by user ${socket.user.id}`);
      return;
    }

    socket.join(`user_${userId}`);
    console.log(`[Socket] User ${socket.user.id} joined personal room: user_${userId}`);
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] User disconnected: ${socket.id}`);
  });
});


// Endpoint to trigger cleanup manually
app.post('/api/cleanup/temp', (req, res) => {
  const results = cleanupLeftoverTempFiles();
  res.json({
    success: true,
    message: `Cleanup completed. Deleted ${results.deleted.length} temp files.`,
    details: results
  });
});

/**
 * Public Health Check Endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    database: !!db,
    websocket: ENABLE_WEBSOCKET,
    version: '3.2.1'
  });
});

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

    // MIGRATION: Check if kv_store already exists and lacks user_id
    const tableInfo = db.prepare("PRAGMA table_info(kv_store)").all();
    const hasUserId = tableInfo.some(col => col.name === 'user_id');

    if (tableInfo.length > 0 && !hasUserId) {
      console.log("[Migration] Adding user_id to existing tables for data isolation...");
      db.transaction(() => {
        // Migration for kv_store
        db.prepare("ALTER TABLE kv_store RENAME TO kv_store_old").run();
        db.prepare(`
          CREATE TABLE kv_store (
            user_id INTEGER,
            key TEXT,
            value TEXT,
            PRIMARY KEY (user_id, key)
          )
        `).run();
        db.prepare("INSERT INTO kv_store (user_id, key, value) SELECT 0, key, value FROM kv_store_old").run();
        db.prepare("DROP TABLE kv_store_old").run();

        // Migration for trash_store
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
        db.prepare("INSERT INTO trash_store (user_id, key, value, deleted_at) SELECT 0, key, value, deleted_at FROM trash_store_old").run();
        db.prepare("DROP TABLE trash_store_old").run();
      })();
      console.log("[Migration] Data successfully isolated under user_id 0 (legacy/guest).");
    }

    db.prepare(`
      CREATE TABLE IF NOT EXISTS kv_store (
        user_id INTEGER,
        key TEXT,
        value TEXT,
        PRIMARY KEY (user_id, key)
      )
    `).run();

    db.prepare(`
      CREATE TABLE IF NOT EXISTS trash_store (
        user_id INTEGER,
        key TEXT,
        value TEXT,
        deleted_at INTEGER,
        PRIMARY KEY (user_id, key)
      )
    `).run();

    db.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        email TEXT UNIQUE,
        password TEXT,
        access_token TEXT,
        created_at INTEGER
      )
    `).run();

    // Migration: Add access_token to users if missing
    const usersInfo = db.prepare("PRAGMA table_info(users)").all();
    if (!usersInfo.some(col => col.name === 'access_token')) {
      db.prepare("ALTER TABLE users ADD COLUMN access_token TEXT").run();
      // Backfill existing users
      const users = db.prepare("SELECT id, username FROM users").all();
      for (const u of users) {
        const token = crypto.createHash('sha256').update(u.username + Date.now() + Math.random()).digest('hex');
        db.prepare("UPDATE users SET access_token = ? WHERE id = ?").run(token, u.id);
      }
    }

    db.prepare(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        type TEXT,
        message TEXT,
        metadata TEXT,
        is_read INTEGER DEFAULT 0,
        created_at INTEGER
      )
    `).run();

    db.prepare(`
      CREATE TABLE IF NOT EXISTS project_access (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT,
        user_id INTEGER,
        owner_id INTEGER,
        permissions TEXT DEFAULT 'editor',
        access_token TEXT,
        UNIQUE(project_id, user_id)
      )
    `).run();

    // Migration: Add access_token if missing
    const paInfo = db.prepare("PRAGMA table_info(project_access)").all();
    if (!paInfo.some(col => col.name === 'access_token')) {
      db.prepare("ALTER TABLE project_access ADD COLUMN access_token TEXT").run();
    }

    console.log(`SQLite database checked/created at: ${DB_PATH}`);
  } catch (err) {
    console.error("Database Initialization Error:", err);
    console.log("Please ensure the directory is writable.");
  }
}

// Initialize DB on startup
initializeDatabase();

// --- AUTH MIDDLEWARE ---
const JWT_SECRET = process.env.JWT_SECRET || 'koge-kanban-secret-key-change-me';

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    // Check if it's a guest request (we allow some routes for guest user_id = 0)
    if (req.headers['x-is-guest'] === 'true') {
      req.user = { id: 0, username: 'Guest' };
      return next();
    }
    return res.status(401).json({ error: 'Authentication required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

const authenticateAdmin = (req, res, next) => {
  authenticateToken(req, res, () => {
    if (req.user && req.user.id === 1) {
      next();
    } else {
      res.status(403).json({ error: 'Admin access required' });
    }
  });
};

// --- Project Sharing Endpoints ---

/**
 * POST /api/project/:id/share
 */
app.post('/api/project/:id/share', authenticateToken, (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database not initialized' });
  const projectId = req.params.id;
  const { userId, permissions } = req.body;

  if (!userId) return res.status(400).json({ error: 'User ID is required' });

  try {
    // Check if requester is owner
    const requesterShare = db.prepare("SELECT permissions FROM project_access WHERE project_id = ? AND user_id = ?").get(projectId, req.user.id);
    if (!requesterShare || requesterShare.permissions !== 'owner') {
      return res.status(403).json({ error: 'Only the project owner can manage sharing.' });
    }

    // 1. Fetch the target user's access token
    const targetUser = db.prepare("SELECT access_token FROM users WHERE id = ?").get(userId);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    db.prepare(`
      INSERT OR REPLACE INTO project_access (project_id, user_id, owner_id, permissions, access_token)
      VALUES (?, ?, ?, ?, ?)
    `).run(projectId, userId, req.user.id, permissions || 'editor', targetUser.access_token);

    res.json({ success: true, message: 'Project shared successfully', token: targetUser.access_token });
  } catch (err) {
    console.error("Share error:", err);
    res.status(500).json({ error: 'Failed to share project' });
  }
});

/**
 * GET /api/project/:id/members
 */
app.get('/api/project/:id/members', authenticateToken, (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database not initialized' });
  const projectId = req.params.id;

  try {
    // Get members from project_access
    const rows = db.prepare(`
      SELECT u.id, u.username, u.email, pa.permissions, pa.access_token as accessCode, pa.owner_id
      FROM users u
      JOIN project_access pa ON u.id = pa.user_id
      WHERE pa.project_id = ?
    `).all(projectId);

    // Also get the project owner info from kv_store if possible, or just look at owner_id from first row
    // But since projects are in kv_store, let's find who originally owns this project_id
    // Actually, owner_id is already in project_access if shared.
    // Let's also look for the real owner who is NOT in project_access (the one who HAS it in 'kanban_projects')

    // Simplification: the one who shared it (owner_id in pa) is the admin.
    // If no shares yet, we can't easily find the owner without checking everyone's kv_store.
    // But usually the requester IS the owner if they are viewing this modal.

    // Better way: Union with the project owner
    // We'll assume the first share's owner_id is the primary admin.
    let ownerInfo = null;
    if (rows.length > 0) {
      const o = db.prepare("SELECT id, username, email FROM users WHERE id = ?").get(rows[0].owner_id);
      if (o) ownerInfo = { ...o, permissions: 'owner', isAdmin: true };
    } else {
      // if no shares, current user is owner
      const o = db.prepare("SELECT id, username, email FROM users WHERE id = ?").get(req.user.id);
      if (o) ownerInfo = { ...o, permissions: 'owner', isAdmin: true };
    }

    const finalMembers = [];
    if (ownerInfo) finalMembers.push(ownerInfo);

    rows.forEach(r => {
      if (r.id !== ownerInfo?.id) {
        finalMembers.push(r);
      }
    });

    res.json(finalMembers);
  } catch (err) {
    console.error("Fetch members error:", err);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

app.delete('/api/project/:id/share/:userId', authenticateToken, (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database not initialized' });
  const { id: projectId, userId } = req.params;

  try {
    const targetUserId = parseInt(userId);

    // Check if requester is owner
    const requesterShare = db.prepare("SELECT permissions FROM project_access WHERE project_id = ? AND user_id = ?").get(projectId, req.user.id);
    if (!requesterShare || requesterShare.permissions !== 'owner') {
      return res.status(403).json({ error: 'Only the project owner can remove members.' });
    }

    db.prepare("DELETE FROM project_access WHERE project_id = ? AND user_id = ?").run(projectId, targetUserId);
    res.json({ success: true });
  } catch (err) {
    console.error("Remove member error:", err);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

/**
 * PATCH /api/project/:id/share/:userId
 */
app.patch('/api/project/:id/share/:userId', authenticateToken, (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database not initialized' });
  const { id: projectId, userId } = req.params;
  const { permissions } = req.body;

  if (!permissions) return res.status(400).json({ error: 'Permissions required' });

  try {
    const targetUserId = parseInt(userId);

    // Check if requester is owner
    const requesterShare = db.prepare("SELECT permissions FROM project_access WHERE project_id = ? AND user_id = ?").get(projectId, req.user.id);
    if (!requesterShare || requesterShare.permissions !== 'owner') {
      return res.status(403).json({ error: 'Only the project owner can update member permissions.' });
    }

    const info = db.prepare("UPDATE project_access SET permissions = ? WHERE project_id = ? AND user_id = ?").run(permissions, projectId, targetUserId);

    if (info.changes === 0) {
      return res.status(404).json({ error: 'Member not found in this project' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Update permissions error:", err);
    res.status(500).json({ error: 'Failed to update permissions' });
  }
});



// New Endpoint: Get all tasks from all projects
app.get('/api/tasks/global', authenticateToken, (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database not initialized' });

  try {
    // Get own tasks
    const ownRows = db.prepare("SELECT key, value FROM kv_store WHERE user_id = ? AND key LIKE 'tasks_%'").all(req.user.id);

    // Get shared tasks
    const sharedInfos = db.prepare("SELECT project_id, owner_id FROM project_access WHERE user_id = ? AND owner_id != ?").all(req.user.id, req.user.id);
    const sharedRows = [];
    for (const info of sharedInfos) {
      const row = db.prepare("SELECT key, value FROM kv_store WHERE user_id = ? AND key = ?").get(info.owner_id, `tasks_${info.project_id}`);
      if (row) sharedRows.push(row);
    }

    // Use a Map to unique-ify by project ID (shared takes precedence if ID conflict)
    const rowMap = new Map();
    ownRows.forEach(row => {
      const pid = row.key.replace('tasks_', '');
      rowMap.set(pid, row);
    });
    sharedRows.forEach(row => {
      const pid = row.key.replace('tasks_', '');
      rowMap.set(pid, row);
    });

    const rows = Array.from(rowMap.values());

    // 1. Fetch all columns to resolve status names
    const ownColumns = db.prepare("SELECT key, value FROM kv_store WHERE user_id = ? AND key LIKE 'columns_%'").all(req.user.id);
    const sharedColumns = [];
    for (const info of sharedInfos) {
      const row = db.prepare("SELECT key, value FROM kv_store WHERE user_id = ? AND key = ?").get(info.owner_id, `columns_${info.project_id}`);
      if (row) sharedColumns.push(row);
    }

    const columnMap = new Map();
    // Pre-populate with Template Columns
    [
      { id: 'Draft', title: 'DRAFT' },
      { id: 'To Do', title: 'TO-DO' },
      { id: 'On Going', title: 'ON GOING' },
      { id: 'Complete', title: 'COMPLETE' }
    ].forEach(c => columnMap.set(c.id, c.title));

    [...ownColumns, ...sharedColumns].forEach(row => {
      try {
        const cols = JSON.parse(row.value);
        if (Array.isArray(cols)) {
          cols.forEach(c => columnMap.set(c.id, c.title));
        }
      } catch (e) { }
    });

    // 2. Flatten all task arrays into one single array AND inject projectId from the key
    const allTasks = rows.reduce((acc, row) => {
      try {
        if (!row || !row.key) return acc;
        const projectId = row.key.replace('tasks_', '');

        const tasks = JSON.parse(row.value);

        if (Array.isArray(tasks)) {
          const tasksWithPid = tasks.map(t => ({
            ...t,
            status: columnMap.get(t.status) || t.status, // Resolve status ID to Title
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

  if (!req.params.key || req.params.key.length > 255) {
    return res.status(400).json({ error: 'Invalid key' });
  }

  try {
    const key = req.params.key;
    let ownerId = req.user.id;

    // Special Handling for project list: merge shared projects
    if (key === 'kanban_projects') {
      const ownRow = db.prepare("SELECT value FROM kv_store WHERE user_id = ? AND key = ?").get(req.user.id, key);
      let ownProjects = ownRow ? JSON.parse(ownRow.value) : [];

      const sharedInfos = db.prepare("SELECT project_id, owner_id, permissions FROM project_access WHERE user_id = ? AND owner_id != ?").all(req.user.id, req.user.id);

      const sharedProjects = [];
      for (const info of sharedInfos) {
        const ownerRow = db.prepare("SELECT value FROM kv_store WHERE user_id = ? AND key = ?").get(info.owner_id, 'kanban_projects');
        if (ownerRow) {
          const ownerProjects = JSON.parse(ownerRow.value);
          const project = ownerProjects.find(p => p.id === info.project_id);
          if (project) {
            sharedProjects.push({ ...project, isShared: true, ownerId: info.owner_id, permissions: info.permissions });
          }
        }
      }

      // Use a Map to unique-ify by project ID (shared takes precedence if ID conflict)
      const projectMap = new Map();
      ownProjects.forEach(p => projectMap.set(p.id, p));
      sharedProjects.forEach(p => projectMap.set(p.id, p));

      return res.json(Array.from(projectMap.values()));
    }

    // Project Data Check: tasks_uuid, columns_uuid, etc.
    if (key.startsWith('tasks_') || key.startsWith('columns_') || key.startsWith('chat_history_')) {
      const projectId = key.split('_')[1];
      // Prioritize shared project data if there is an ID collision (e.g. Welcome board)
      const share = db.prepare("SELECT owner_id FROM project_access WHERE project_id = ? AND user_id = ? ORDER BY (owner_id != ?) DESC").get(projectId, req.user.id, req.user.id);
      if (share) {
        ownerId = share.owner_id;
      }
    }

    const row = db.prepare("SELECT value FROM kv_store WHERE user_id = ? AND key = ?").get(ownerId, req.params.key);

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

  if (!req.params.key || req.params.key.length > 255) {
    return res.status(400).json({ error: 'Invalid key' });
  }

  try {
    let valueStr = JSON.stringify(req.body);
    const key = req.params.key;
    let ownerId = req.user.id;

    // Filter shared projects before saving project list
    if (key === 'kanban_projects' && Array.isArray(req.body)) {
      const filtered = req.body.filter(p => !p.isShared);
      valueStr = JSON.stringify(filtered);

      // Auto-register ownership if not exists
      try {
        const user = db.prepare("SELECT access_token FROM users WHERE id = ?").get(req.user.id);
        if (user) {
          for (const project of filtered) {
            db.prepare(`
               INSERT OR IGNORE INTO project_access (project_id, user_id, owner_id, permissions, access_token)
               VALUES (?, ?, ?, ?, ?)
             `).run(project.id, req.user.id, req.user.id, 'owner', user.access_token);
          }
        }
      } catch (e) {
        console.error("Failed to auto-register project ownership:", e);
      }
    }

    // Project Data Check
    if (key.startsWith('tasks_') || key.startsWith('columns_') || key.startsWith('chat_history_')) {
      const projectId = key.split('_')[1];
      const share = db.prepare("SELECT owner_id, permissions FROM project_access WHERE project_id = ? AND user_id = ?").get(projectId, req.user.id);
      if (share) {
        if (share.permissions !== 'editor' && share.permissions !== 'owner') {
          return res.status(403).json({ error: 'You do not have permission to edit this project' });
        }
        ownerId = share.owner_id;
      }
    }

    db.prepare(
      "INSERT OR REPLACE INTO kv_store (user_id, key, value) VALUES (?, ?, ?)"
    ).run(ownerId, req.params.key, valueStr);

    // Emit real-time update
    if (key.startsWith('tasks_') || key.startsWith('columns_')) {
      const projectId = key.split('_')[1];
      io.to(`project_${projectId}`).emit('data_updated', { key, senderId: req.user.id });
    } else if (key === 'kanban_projects') {
      io.to(`user_${req.user.id}`).emit('data_updated', { key });
    }

    // --- MENTION DETECTION LOGIC ---
    // If we are saving tasks, check for @username mentions
    if (req.params.key.startsWith('tasks_')) {
      const tasks = req.body;
      if (Array.isArray(tasks)) {
        tasks.forEach(task => {
          const content = `${task.title} ${task.description || ''}`;
          const mentions = content.match(/@(\w+)/g);

          if (mentions) {
            const uniqueUsernames = [...new Set(mentions.map(m => m.substring(1)))];
            uniqueUsernames.forEach(username => {
              const targetUser = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
              if (targetUser && targetUser.id !== req.user.id) {
                const exists = db.prepare("SELECT id FROM notifications WHERE user_id = ? AND metadata LIKE ? AND type = 'mention' AND is_read = 0")
                  .get(targetUser.id, `%${task.id}%`);
                if (!exists) {
                  db.prepare(`
                    INSERT INTO notifications (user_id, type, message, metadata, created_at)
                    VALUES (?, ?, ?, ?, ?)
                  `).run(
                    targetUser.id,
                    'mention',
                    `${req.user.username} mentioned you in task: ${task.title}`,
                    JSON.stringify({ taskId: task.id, projectId: req.params.key.replace('tasks_', ''), sender: req.user.username }),
                    Date.now()
                  );

                  // Real-time notification
                  io.to(`user_${targetUser.id}`).emit('new_notification', {
                    type: 'mention',
                    message: `${req.user.username} mentioned you in task: ${task.title}`
                  });
                }
              }
            });
          }

          // Assignee Notification
          if (task.assignee) {
            const targetUser = db.prepare("SELECT id FROM users WHERE username = ?").get(task.assignee);
            if (targetUser && targetUser.id !== req.user.id) {
              const exists = db.prepare("SELECT id FROM notifications WHERE user_id = ? AND metadata LIKE ? AND type = 'assignment' AND is_read = 0")
                .get(targetUser.id, `%${task.id}%`);

              if (!exists) {
                db.prepare(`
                    INSERT INTO notifications (user_id, type, message, metadata, created_at)
                    VALUES (?, ?, ?, ?, ?)
                  `).run(
                  targetUser.id,
                  'assignment',
                  `${req.user.username} assigned you to task: ${task.title}`,
                  JSON.stringify({ taskId: task.id, projectId: req.params.key.replace('tasks_', ''), sender: req.user.username }),
                  Date.now()
                );

                // Real-time notification
                io.to(`user_${targetUser.id}`).emit('new_notification', {
                  type: 'assignment',
                  message: `${req.user.username} assigned you to task: ${task.title}`
                });
              }
            }
          }
        });
      }
    }

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
  const isPermanent = req.query.permanent === 'true';

  try {
    let affectedKeys = [];
    let ownerIdToCheck = req.user.id;

    // Project Data Permission Check
    if (key.startsWith('tasks_') || key.startsWith('columns_') || key.startsWith('chat_history_')) {
      const projectId = key.split('_')[1];
      const share = db.prepare("SELECT owner_id, permissions FROM project_access WHERE project_id = ? AND user_id = ?").get(projectId, req.user.id);
      if (share) {
        if (share.permissions !== 'editor' && share.permissions !== 'owner') {
          return res.status(403).json({ error: 'You do not have permission to delete content in this project.' });
        }
        ownerIdToCheck = share.owner_id;
      }
    }

    // 1. Identify keys to "delete"
    if (key.endsWith('*')) {
      const prefix = key.slice(0, -1);
      if (prefix.length < 3) {
        return res.status(400).json({ error: 'Wildcard prefix too short' });
      }
      const rows = db.prepare("SELECT key, value FROM kv_store WHERE user_id = ? AND key LIKE ?").all(ownerIdToCheck, `${prefix}%`);
      affectedKeys = rows;
    } else {
      const row = db.prepare("SELECT key, value FROM kv_store WHERE user_id = ? AND key = ?").get(ownerIdToCheck, key);
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
          // Trash always goes to the OWN trash of the actor for safety?
          // Or owner's trash? Usually it's better to go to actor's trash so they can restore it if they made a mistake.
          // But then the owner can't see what was deleted. 
          // Let's go with the actor's trash (req.user.id) as it is currently implemented.
          insertTrash.run(req.user.id, item.key, item.value, now);
        }
        deleteMain.run(ownerIdToCheck, item.key);
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
 * Explicitly move an item to trash. 
 */
app.post('/api/trash/item', authenticateToken, (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database not initialized' });

  const { key, value } = req.body;
  if (!key || !value) {
    return res.status(400).json({ error: 'Key and value are required' });
  }

  try {
    const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
    const now = Date.now();

    db.prepare(
      "INSERT OR REPLACE INTO trash_store (user_id, key, value, deleted_at) VALUES (?, ?, ?, ?)"
    ).run(req.user.id, key, valueStr, now);

    res.json({ success: true, message: 'Item moved to trash.' });
  } catch (error) {
    console.error(`Database trash error for key ${key}:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/trash
 * Returns all items currently in the trash for the user.
 */
app.get('/api/trash', authenticateToken, (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database not initialized' });
  try {
    const rows = db.prepare("SELECT key, value, deleted_at FROM trash_store WHERE user_id = ? ORDER BY deleted_at DESC").all(req.user.id);
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
 */
app.post('/api/trash/restore/:key', authenticateToken, (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database not initialized' });
  const key = req.params.key;
  const options = req.body || {};

  try {
    let ownerIdToRestore = req.user.id;

    // Check if it's project data and verify permissions
    if (key.startsWith('tasks_') || key.startsWith('columns_') || key.startsWith('chat_history_')) {
      const projectId = key.split('_')[1];
      const share = db.prepare("SELECT owner_id, permissions FROM project_access WHERE project_id = ? AND user_id = ?").get(projectId, req.user.id);
      if (share) {
        if (share.permissions !== 'editor' && share.permissions !== 'owner') {
          return res.status(403).json({ error: 'You do not have permission to restore items to this project.' });
        }
        ownerIdToRestore = share.owner_id;
      }
    }

    const transaction = db.transaction(() => {
      // Find item in actor's trash
      const item = db.prepare("SELECT value FROM trash_store WHERE user_id = ? AND key = ?").get(req.user.id, key);
      if (!item) throw new Error(`Item "${key}" not found in your trash.`);

      db.prepare("INSERT OR REPLACE INTO kv_store (user_id, key, value) VALUES (?, ?, ?)").run(ownerIdToRestore, key, item.value);
      db.prepare("DELETE FROM trash_store WHERE user_id = ? AND key = ?").run(req.user.id, key);
      return { success: true };
    });
    const result = transaction();
    res.json({ success: true, message: result.message || 'Item restored successfully.' });
  } catch (error) {
    console.error(`Restore error for ${key}:`, error);
    res.status(500).json({ error: 'Failed to restore', details: error.message });
  }
});

/**
 * DELETE /api/trash/permanent/:key
 */
app.delete('/api/trash/permanent/:key', authenticateToken, (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database not initialized' });
  const key = req.params.key;
  try {
    let info;
    if (key === '__all__') {
      info = db.prepare("DELETE FROM trash_store WHERE user_id = ?").run(req.user.id);
    } else {
      info = db.prepare("DELETE FROM trash_store WHERE user_id = ? AND key = ?").run(req.user.id, key);
    }
    res.json({ success: true, deletedCount: info.changes });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete permanently' });
  }
});

// --- Notification Endpoints ---

/**
 * GET /api/notifications
 */
app.get('/api/notifications', authenticateToken, (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database not initialized' });
  try {
    const rows = db.prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC").all(req.user.id);
    const notifications = rows.map(r => ({
      ...r,
      metadata: r.metadata ? JSON.parse(r.metadata) : null,
      isRead: r.is_read === 1
    }));
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

/**
 * POST /api/notifications/:id/read
 */
app.post('/api/notifications/:id/read', authenticateToken, (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database not initialized' });
  try {
    const info = db.prepare("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?").run(req.params.id, req.user.id);
    res.json({ success: info.changes > 0 });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

/**
 * DELETE /api/notifications/:id
 */
app.delete('/api/notifications/:id', authenticateToken, (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database not initialized' });
  try {
    const info = db.prepare("DELETE FROM notifications WHERE id = ? AND user_id = ?").run(req.params.id, req.user.id);
    res.json({ success: info.changes > 0 });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

/**
 * DELETE /api/notifications/clear-all
 */
app.delete('/api/notifications/clear-all', authenticateToken, (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database not initialized' });
  try {
    const info = db.prepare("DELETE FROM notifications WHERE user_id = ?").run(req.user.id);
    res.json({ success: true, count: info.changes });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear notifications' });
  }
});

// --- Authentication Endpoints ---

// (JWT_SECRET moved to top)

/**
 * POST /api/auth/register
 * Register a new user
 */
app.post('/api/auth/register', async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database not initialized' });
  let { username, email, password } = req.body;

  if (!username || !password || !email) {
    return res.status(400).json({ error: 'Username, email, and password are required' });
  }

  // Trim inputs
  username = username.trim();
  email = email.trim().toLowerCase();

  // Simple email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  try {
    // Check if user or email exists
    const existing = db.prepare("SELECT username, email FROM users WHERE username = ? OR email = ?").get(username, email);
    if (existing) {
      if (existing.username.toLowerCase() === username.toLowerCase()) {
        return res.status(409).json({ error: 'Username already taken' });
      }
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const now = Date.now();
    const accessToken = crypto.createHash('sha256').update(username + now + Math.random()).digest('hex');

    // Check if ID 1 (Admin/Owner) is vacant
    const adminExists = db.prepare("SELECT id FROM users WHERE id = 1").get();

    let info;
    if (!adminExists) {
      // Force this user to take the primary admin slot (ID 1)
      info = db.prepare(
        "INSERT INTO users (id, username, email, password, access_token, created_at) VALUES (1, ?, ?, ?, ?, ?)"
      ).run(username, email || '', hashedPassword, accessToken, now);
    } else {
      info = db.prepare(
        "INSERT INTO users (username, email, password, access_token, created_at) VALUES (?, ?, ?, ?, ?)"
      ).run(username, email || '', hashedPassword, accessToken, now);
    }

    const userId = info.lastInsertRowid;
    const token = jwt.sign({ id: userId, username }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      message: 'User registered successfully',
      token,
      user: { id: userId, username, email, accessToken }
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: 'Registration failed', details: err.message });
  }
});

// --- User Search Endpoint ---
app.get('/api/users/search', authenticateToken, (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database not initialized' });
  const query = req.query.q || '';

  try {
    const rows = db.prepare(`
      SELECT id, username, email 
      FROM users 
      WHERE (username LIKE ? OR email LIKE ?) 
      AND id != ? 
      LIMIT 10
    `).all(`%${query}%`, `%${query}%`, req.user.id);

    res.json(rows);
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: 'Search failed' });
  }
});

/**
 * POST /api/auth/login
 * Login existing user
 */
app.post('/api/auth/login', async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database not initialized' });
  let { username, password } = req.body; // username can be username or email

  if (!username || !password) {
    return res.status(400).json({ error: 'Credentials are required' });
  }

  username = username.trim();

  try {
    // Support login by username OR email (case-insensitive for either)
    const user = db.prepare("SELECT * FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)").get(username, username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
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
app.delete('/api/auth/user/:id', async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database not initialized' });
  const id = req.params.id;

  try {
    const transaction = db.transaction(() => {
      // 1. Delete the user record
      const info = db.prepare("DELETE FROM users WHERE id = ?").run(id);

      if (info.changes > 0) {
        // 2. Wipe ALL child data for this specific user only (Isolation Fix)
        db.prepare("DELETE FROM kv_store WHERE user_id = ?").run(id);
        db.prepare("DELETE FROM trash_store WHERE user_id = ?").run(id);
        db.prepare("DELETE FROM project_access WHERE user_id = ? OR owner_id = ?").run(id, id);
        db.prepare("DELETE FROM notifications WHERE user_id = ?").run(id);
        console.log(`[Account] User ${id} deleted and their data wiped.`);
      }
      return info;
    });

    const info = transaction();

    if (info.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({
      success: true,
      message: 'User account and all data from this connection have been permanently deleted.'
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
app.post('/api/reset', (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database not initialized' });

  const { includeBackups } = req.body;

  try {
    const transaction = db.transaction(() => {
      // 1. Delete project index for THIS user
      db.prepare("DELETE FROM kv_store WHERE user_id = ? AND key = ?").run(req.user.id, 'kanban_projects');

      // 2. Delete all tasks and columns for THIS user
      db.prepare("DELETE FROM kv_store WHERE user_id = ? AND key LIKE 'tasks_%'").run(req.user.id);
      db.prepare("DELETE FROM kv_store WHERE user_id = ? AND key LIKE 'columns_%'").run(req.user.id);
      db.prepare("DELETE FROM kv_store WHERE user_id = ? AND key LIKE 'chat_history_%'").run(req.user.id);

      // 3. Clear trash for THIS user
      db.prepare("DELETE FROM trash_store WHERE user_id = ?").run(req.user.id);
    });

    transaction();

    let backupMessage = '';
    if (includeBackups) {
      if (fs.existsSync(BACKUP_DIR)) {
        const files = fs.readdirSync(BACKUP_DIR);
        for (const file of files) {
          try {
            fs.unlinkSync(path.join(BACKUP_DIR, file));
          } catch (e) {
            console.error(`Failed to delete backup ${file}:`, e);
          }
        }
        backupMessage = ' and all backups were deleted';
      }
    }

    res.json({ success: true, message: `All project data${backupMessage} has been wiped.` });
  } catch (err) {
    console.error("Reset error:", err);
    res.status(500).json({ error: 'Failed to reset data', details: err.message });
  }
});

// --- Backup Endpoints ---

/**
 * POST /api/backup
 * Creates a backup of the current database file.
 */
app.post('/api/backup', async (req, res) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupName = `kanban-backup-${timestamp}.db`;
  const backupPath = path.join(BACKUP_DIR, backupName);

  try {
    // We use the SQLite backup API for a safe hot backup
    if (!db) throw new Error("DB not initialized");
    await db.backup(backupPath);
    res.json({ success: true, filename: backupName });
  } catch (err) {
    console.error("Backup failed:", err);
    res.status(500).json({ error: 'Backup failed', details: err.message });
  }
});

/**
 * GET /api/backups
 * Lists all available database backups.
 */
app.get('/api/backups', (req, res) => {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.db'))
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
 * Deletes a specific backup file.
 */
app.delete('/api/backups/:filename', (req, res) => {
  const filename = req.params.filename;
  // Security: prevent path traversal by only allowing specific filename pattern
  if (!filename.startsWith('kanban-backup-') || !filename.endsWith('.db') || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).json({ error: 'Invalid backup filename' });
  }

  const filePath = path.join(BACKUP_DIR, filename);

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[Backup] Successfully deleted backup: ${filename}`);
      res.json({ success: true });
    } else {
      console.warn(`[Backup] Delete failed: File not found: ${filePath}`);
      res.status(404).json({ error: 'Backup not found' });
    }
  } catch (err) {
    console.error(`[Backup] Failed to delete backup ${filename}:`, err);
    res.status(500).json({ error: 'Failed to delete backup', details: err.message });
  }
});

/**
 * POST /api/backups/restore
 * Restores the database from a backup file.
 */
app.post('/api/backups/restore', async (req, res) => {
  const { filename } = req.body;

  if (!filename) {
    return res.status(400).json({ error: 'Missing backup filename' });
  }

  // Security: prevent path traversal
  if (!filename.startsWith('kanban-backup-') || !filename.endsWith('.db') || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).json({ error: 'Invalid backup filename' });
  }

  const filePath = path.join(BACKUP_DIR, filename);

  try {
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Backup file not found on server' });
    }

    console.log(`[Backup] Starting SQL-based restore from: ${filename}...`);

    if (!db) return res.status(503).json({ error: 'Database not initialized' });

    // Way 3: Extremely Safe Memory Copy (bypass file locks on backup file)
    let backupDb;
    const tempBackupPath = path.join(TEMP_DIR, `temp_restore_${Date.now()}.db`);

    try {
      // 1. Copy backup file to a temp location to avoid any locks on the original backup file
      fs.copyFileSync(filePath, tempBackupPath);

      // 2. Open the temporary backup file
      backupDb = new Database(tempBackupPath, { readonly: true, timeout: 5000 });

      const kvData = backupDb.prepare("SELECT * FROM kv_store").all();
      const trashData = backupDb.prepare("SELECT * FROM trash_store").all();

      // Close backup immediately after reading
      backupDb.close();
      backupDb = null;

      // 3. Clear and Populate main DB using a transaction
      // We use a retry loop if the main database is busy
      let retries = 3;
      let success = false;
      let lastError = null;

      while (retries > 0 && !success) {
        try {
          const restoreTransaction = db.transaction(() => {
            // Clear tables for this connection (Note: Full restore currently replaces all data)
            db.prepare("DELETE FROM kv_store").run();
            db.prepare("DELETE FROM trash_store").run();

            // Populate from backup data
            // Check if backup has user_id (it will if it's from v3.0+)
            const sampleKV = kvData[0];
            const hasUserId = sampleKV && Object.keys(sampleKV).includes('user_id');

            const insertKV = hasUserId
              ? db.prepare("INSERT INTO kv_store (user_id, key, value) VALUES (?, ?, ?)")
              : db.prepare("INSERT INTO kv_store (user_id, key, value) VALUES (0, ?, ?)"); // Default to guest for old backups

            for (const row of kvData) {
              if (hasUserId) insertKV.run(row.user_id, row.key, row.value);
              else insertKV.run(row.key, row.value);
            }

            const insertTrash = hasUserId
              ? db.prepare("INSERT INTO trash_store (user_id, key, value, deleted_at) VALUES (?, ?, ?, ?)")
              : db.prepare("INSERT INTO trash_store (user_id, key, value, deleted_at) VALUES (0, ?, ?, ?)");

            for (const row of trashData) {
              if (hasUserId) insertTrash.run(row.user_id, row.key, row.value, row.deleted_at);
              else insertTrash.run(row.key, row.value, row.deleted_at);
            }
          });

          restoreTransaction();
          success = true;
        } catch (err) {
          lastError = err;
          if (err.message.includes('locked') || err.message.includes('busy')) {
            console.warn(`[Backup] Main DB locked, retrying... (${retries} left)`);
            retries--;
            await new Promise(resolve => setTimeout(resolve, 1000));
          } else {
            throw err; // Non-locking error, throw immediately
          }
        }
      }

      if (!success) throw lastError;

      console.log(`[Backup] Database records successfully restored from ${filename}`);
      res.json({
        success: true,
        message: 'Database has been restored successfully. The application will now use the restored data.'
      });
    } finally {
      // Final cleanup to ensure no temp files are left
      console.log(`[Backup] Cleaning up temporary restoration files...`);
      if (backupDb) {
        try { backupDb.close(); } catch (e) { }
        backupDb = null;
      }

      // Delay slightly on Windows to allow file handles to be released
      setTimeout(() => {
        [tempBackupPath, `${tempBackupPath}-wal`, `${tempBackupPath}-shm`, `${tempBackupPath}-journal`].forEach(f => {
          try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (e) { }
        });
      }, 100);
    }
  } catch (err) {
    console.error(`[Backup] Restore failed:`, err);
    res.status(500).json({ error: 'Failed to restore database', details: err.message });
  }
});

// --- ADMIN ENDPOINTS (USER ID 1 ONLY) ---

app.get('/api/admin/users', authenticateAdmin, (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database not initialized' });
  try {
    const rows = db.prepare("SELECT id, username, email, created_at FROM users ORDER BY created_at DESC").all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.post('/api/admin/users', authenticateAdmin, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database not initialized' });
  let { username, email, password } = req.body;

  if (!username || !password || !email) {
    return res.status(400).json({ error: 'Username, email, and password are required' });
  }

  username = username.trim();
  email = email.trim().toLowerCase();

  try {
    const existing = db.prepare("SELECT id FROM users WHERE username = ? OR email = ?").get(username, email);
    if (existing) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const now = Date.now();
    const accessToken = crypto.createHash('sha256').update(username + now + Math.random()).digest('hex');

    db.prepare(
      "INSERT INTO users (username, email, password, access_token, created_at) VALUES (?, ?, ?, ?, ?)"
    ).run(username, email, hashedPassword, accessToken, now);

    res.json({ success: true, message: `User "${username}" created successfully.` });
  } catch (err) {
    console.error("Admin user creation failed:", err);
    res.status(500).json({ error: 'Failed to create user', details: err.message });
  }
});

app.patch('/api/admin/users/:id/password', authenticateAdmin, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database not initialized' });
  const { id } = req.params;
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const info = db.prepare("UPDATE users SET password = ? WHERE id = ?").run(hashedPassword, id);

    if (info.changes === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json({ success: true, message: 'Password has been updated successfully.' });
  } catch (err) {
    console.error("Admin password reset failed:", err);
    res.status(500).json({ error: 'Failed to reset password.' });
  }
});

app.delete('/api/admin/users/:id', authenticateAdmin, (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database not initialized' });
  const id = parseInt(req.params.id);

  if (id === 1) return res.status(400).json({ error: 'Cannot delete the primary admin account.' });

  try {
    db.transaction(() => {
      // Delete all user data
      db.prepare("DELETE FROM kv_store WHERE user_id = ?").run(id);
      db.prepare("DELETE FROM trash_store WHERE user_id = ?").run(id);
      db.prepare("DELETE FROM project_access WHERE user_id = ? OR owner_id = ?").run(id, id);
      db.prepare("DELETE FROM notifications WHERE user_id = ?").run(id);
      db.prepare("DELETE FROM users WHERE id = ?").run(id);
    })();
    res.json({ success: true, message: `User ID ${id} and all associated data have been removed.` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

app.post('/api/admin/reset-system', authenticateAdmin, (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database not initialized' });

  try {
    db.transaction(() => {
      // Wipe ALL data except ID 1 (The Admin)
      db.prepare("DELETE FROM kv_store WHERE user_id != 1").run();
      db.prepare("DELETE FROM trash_store WHERE user_id != 1").run();
      db.prepare("DELETE FROM project_access WHERE user_id != 1 AND owner_id != 1").run();
      db.prepare("DELETE FROM notifications WHERE user_id != 1").run();
      db.prepare("DELETE FROM users WHERE id != 1").run();

      // Also clear Admin's own Kanban projects/tasks if desired, or keep them?
      // Request says "hapus database keseluruhan", but usually we keep the admin.
      // Let's wipe everything except the admin USER row, but wipe admin's boards too for a clean slate.
      db.prepare("DELETE FROM kv_store WHERE user_id = 1").run();
      db.prepare("DELETE FROM trash_store WHERE user_id = 1").run();
      db.prepare("DELETE FROM project_access WHERE owner_id = 1 OR user_id = 1").run();
      db.prepare("DELETE FROM notifications WHERE user_id = 1").run();
    })();
    res.json({ success: true, message: 'System-wide data reset successful. All users (except admin) and projects have been wiped.' });
  } catch (err) {
    console.error("Global reset failed:", err);
    res.status(500).json({ error: 'Global reset failed' });
  }
});

// Auto-backup Scheduler
const runAutoBackup = async () => {
  if (!db) return;

  try {
    const row = db.prepare("SELECT value FROM kv_store WHERE key = ?").get('kanban_settings');
    if (!row) return;

    const settings = JSON.parse(row.value);
    const intervalDays = parseInt(settings.autoBackupInterval);

    if (!intervalDays || intervalDays <= 0) return;

    // Check last backup time
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('kanban-backup-') && f.endsWith('.db'));

    if (files.length > 0) {
      const stats = files.map(f => fs.statSync(path.join(BACKUP_DIR, f)));
      const latestBackup = Math.max(...stats.map(s => s.mtimeMs));
      const now = Date.now();
      const diffDays = (now - latestBackup) / (1000 * 60 * 60 * 24);

      if (diffDays < intervalDays) {
        // Not time yet
        return;
      }
    }

    // Perform backup
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `kanban-backup-${timestamp}-auto.db`;
    const backupPath = path.join(BACKUP_DIR, backupName);

    console.log(`[Auto-Backup] Triggering scheduled backup: ${backupName}`);
    await db.backup(backupPath);
    console.log(`[Auto-Backup] Success.`);
  } catch (err) {
    console.error("[Auto-Backup] Task failed:", err);
  }
};

// Run auto-backup check every 6 hours
setInterval(runAutoBackup, 6 * 60 * 60 * 1000);
// Also run once on startup (after a short delay to ensure everything is initialized)
setTimeout(runAutoBackup, 10000);

// Auto-cleanup task for trash
const cleanupExpiredTrash = () => {
  if (!db) return;
  try {
    // Get retention setting from DB, default to 3 days (3 * 24 * 60 * 60 * 1000)
    let retentionMs = 3 * 24 * 60 * 60 * 1000;
    const settingRow = db.prepare("SELECT value FROM kv_store WHERE key = 'trash_retention_days'").get();
    if (settingRow) {
      const days = parseInt(JSON.parse(settingRow.value));
      if (!isNaN(days)) retentionMs = days * 24 * 60 * 60 * 1000;
    }

    const expirationTime = Date.now() - retentionMs;
    const info = db.prepare("DELETE FROM trash_store WHERE deleted_at < ?").run(expirationTime);
    if (info.changes > 0) {
      console.log(`[Trash Cleanup] Permanently removed ${info.changes} expired items.`);
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
  // Priority: 
  // 1. Client header (if explicit allow or dev mode)
  // 2. Server env var OLLAMA_HOST
  // 3. Localhost default

  let host = DEFAULT_OLLAMA_HOST;
  const clientEndpoint = req.headers['x-ollama-endpoint'];
  const allowClientOverride = process.env.ALLOW_CLIENT_OLLAMA_HOST === 'true' || process.env.NODE_ENV !== 'production';

  // SECURITY FIX: Only allow verified users to override host in production
  const isGuest = !req.user || req.user.id === 0;

  if (allowClientOverride && clientEndpoint) {
    if (isGuest && process.env.NODE_ENV === 'production') {
      console.warn(`[AI] Blocked guest attempt to override Ollama endpoint: ${clientEndpoint}`);
    } else {
      host = clientEndpoint;
    }
  }

  // Ensure protocol exists
  if (host && !host.startsWith('http://') && !host.startsWith('https://')) {
    host = `http://${host}`;
  }

  // SSRF Protection: Prevent accessing internal network IPs if provided by client
  if (clientEndpoint && host === clientEndpoint) {
    try {
      const url = new URL(host);
      const ipRegex = /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|169\.254\.)/;
      if (ipRegex.test(url.hostname)) {
        console.warn(`[AI] Blocked internal network access attempt: ${url.hostname}`);
        return DEFAULT_OLLAMA_HOST;
      }
    } catch (e) { }
  }

  // Handle missing port ONLY for local addresses (default to 11434 for Ollama)
  try {
    const url = new URL(host);
    const isLocal = ['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(url.hostname);

    if (isLocal && !url.port) {
      if (url.hostname === 'localhost') host = host.replace('localhost', 'localhost:11434');
      else if (url.hostname === '127.0.0.1') host = host.replace('127.0.0.1', '127.0.0.1:11434');
      else if (url.hostname === '0.0.0.0') host = host.replace('0.0.0.0', '0.0.0.0:11434');
    }
  } catch (e) {
    // If URL is invalid, don't try to be clever with ports
    console.warn(`[AI] Invalid Ollama Host format: ${host}`);
  }

  // Handle trailing slash
  return host.endsWith('/') ? host.slice(0, -1) : host;
};

/**
 * GET /api/ai/models
 * Proxies request to local Ollama to get list of installed models
 */
app.get('/api/ai/models', authenticateToken, async (req, res) => {
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
  const targetModel = model || "qwen2.5:3b";

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
  const targetModel = model || "qwen2.5:3b";

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

// Catch-all handler: Serve index.html for SPA routing
app.get('*', (req, res) => {
  // Don't intercept API routes
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }

  const indexPath = path.join(__dirname, 'dist', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.send("Server is running. Frontend (dist) not found.");
  }
});

// Export the app for Vercel
export default app;

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend server running on http://127.0.0.1:${PORT}`);
    console.log(`Security: CORS enabled for origins: ${allowedOrigins.join(', ')}`);
  });
}
