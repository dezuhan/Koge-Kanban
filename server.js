import express from 'express';
import mariadb from 'mariadb';
import cors from 'cors';
import { fileURLToPath } from 'url';
import path from 'path';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // React scripts might need unsafe-inline/eval in dev
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "*"], // Allow connections to any endpoint for Hybrid mode (needed for client-side API base override)
    },
  },
}));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// CORS Configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:5173', 'http://localhost:3000', 'https://koge-kanban.vercel.app'];
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check allowed origins
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    // In Hybrid Mode, user might connect from a dynamic Ngrok URL or local IP that isn't in allowlist.
    // For a "Self Hosted" tool intended for personal use, strict CORS might block legitimate use cases.
    // We log the blocked attempt for debugging.
    console.warn(`[CORS] Blocked request from origin: ${origin}`);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

app.use(express.json({ limit: '10mb' })); // Limit payload size

// Serve static files from the React app build directory
app.use(express.static(path.join(__dirname, 'dist')));

// Database Configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost', 
  user: process.env.DB_USER || 'root', 
  password: process.env.DB_PASSWORD || '',
  connectionLimit: 5
};

const DB_NAME = process.env.DB_NAME || 'koge_kanban';

// Create a pool
let pool;

/**
 * Initializes the MariaDB database connection and ensures the required table exists.
 * It attempts to create the database if it doesn't exist, then creates the 'kv_store' table.
 */
async function initializeDatabase() {
  // Security Check: Warn if using default root credentials
  if (dbConfig.user === 'root' && !dbConfig.password) {
    console.warn('\x1b[33m%s\x1b[0m', 'WARNING: Running database with root user and empty password. This is insecure for production!');
  }

  let conn;
  try {
    // 1. Connect without selecting a database to check/create the DB
    // Only attempt creation if explicitly configured or in dev mode
    conn = await mariadb.createConnection({
        host: dbConfig.host,
        user: dbConfig.user,
        password: dbConfig.password
    });

    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
    console.log(`Database '${DB_NAME}' checked/created.`);
    await conn.end();

    // 2. Initialize the pool with the specific database
    pool = mariadb.createPool({
      ...dbConfig,
      database: DB_NAME
    });

    // 3. Create Table
    conn = await pool.getConnection();
    await conn.query(`
      CREATE TABLE IF NOT EXISTS kv_store (
        \`key\` VARCHAR(255) PRIMARY KEY,
        \`value\` LONGTEXT
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    console.log("Table 'kv_store' checked/created.");

  } catch (err) {
    console.error("Database Initialization Error:", err);
    console.log("Please ensure MariaDB is running and credentials in server.js are correct.");
    if (!process.env.VERCEL) {
        // Don't exit process in dev to keep server running for frontend dev
        // process.exit(1); 
    }
  } finally {
    if (conn) conn.release();
  }
}

// Initialize DB on startup
initializeDatabase();

// New Endpoint: Get all tasks from all projects
/**
 * GET /api/tasks/global
 * Retrieves all tasks from all projects stored in the database.
 */
app.get('/api/tasks/global', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not initialized' });
  
  let conn;
  try {
    conn = await pool.getConnection();
    const rows = await conn.query("SELECT `key`, `value` FROM kv_store WHERE `key` LIKE 'tasks_%'");
    
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
  } finally {
    if (conn) conn.release();
  }
});

// Generic GET endpoint
app.get('/api/data/:key', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not initialized' });
  
  // Basic validation for key
  if (!req.params.key || req.params.key.length > 255) {
      return res.status(400).json({ error: 'Invalid key' });
  }

  let conn;
  try {
    conn = await pool.getConnection();
    const rows = await conn.query("SELECT `value` FROM kv_store WHERE `key` = ?", [req.params.key]);
    
    if (rows && rows.length > 0) {
      res.json(JSON.parse(rows[0].value));
    } else {
      res.json(null);
    }
  } catch (error) {
    console.error(`Database read error for key ${req.params.key}:`, error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (conn) conn.release();
  }
});

// Generic POST endpoint
app.post('/api/data/:key', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not initialized' });

  // Basic validation for key
  if (!req.params.key || req.params.key.length > 255) {
      return res.status(400).json({ error: 'Invalid key' });
  }

  let conn;
  try {
    conn = await pool.getConnection();
    const valueStr = JSON.stringify(req.body);
    
    await conn.query(
      "INSERT INTO kv_store (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)",
      [req.params.key, valueStr]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error(`Database write error for key ${req.params.key}:`, error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (conn) conn.release();
  }
});

// Generic DELETE endpoint
app.delete('/api/data/:key', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not initialized' });

  // Prevent dangerous wildcard deletes without auth (for now just restrict wildcard length or disable it if unauthed, but since no auth yet, we keep it but log warning)
  const key = req.params.key;

  let conn;
  try {
    conn = await pool.getConnection();
    
    let result;
    if (key.endsWith('*')) {
        const prefix = key.slice(0, -1);
        if (prefix.length < 3) {
             return res.status(400).json({ error: 'Wildcard prefix too short' });
        }
        result = await conn.query("DELETE FROM kv_store WHERE `key` LIKE ?", [`${prefix}%`]);
    } else {
        result = await conn.query("DELETE FROM kv_store WHERE `key` = ?", [key]);
    }
    
    if (result.affectedRows > 0) {
      res.json({ success: true, message: `Deleted ${result.affectedRows} keys matching '${key}'.` });
    } else {
      res.json({ success: true, message: `No keys matching '${key}' found.` });
    }
  } catch (error) {
    console.error(`Database delete error for key ${req.params.key}:`, error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (conn) conn.release();
  }
});

// --- AI Integration (Ollama) ---

const DEFAULT_OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';

/**
 * Determine valid Ollama host.
 * Priority:
 * 1. Environment variable OLLAMA_HOST (Server Admin overrides all)
 * 2. Client header x-ollama-endpoint (Hybrid mode for users connecting to their own tunnels)
 *    -> Only allowed if NO server env var is set OR explicit ALLOW_CLIENT_OLLAMA_HOST=true is set.
 *    -> This restores functionality for the hybrid architecture while keeping safe defaults for pure server deployments.
 */
const getOllamaHost = (req) => {
    // If Admin explicitly set a host in ENV, prefer that (Secure Server Mode)
    // UNLESS the admin explicitly wants to allow client overrides (Hybrid Mode Server)
    const serverHost = process.env.OLLAMA_HOST;
    const clientHost = req.headers['x-ollama-endpoint'];
    const allowClientOverride = process.env.ALLOW_CLIENT_OLLAMA_HOST === 'true';

    if (serverHost && !allowClientOverride) {
        return serverHost.endsWith('/') ? serverHost.slice(0, -1) : serverHost;
    }

    if (clientHost) {
        // Basic sanitization to prevent obvious non-URL payloads
        if (clientHost.startsWith('http://') || clientHost.startsWith('https://')) {
             return clientHost.endsWith('/') ? clientHost.slice(0, -1) : clientHost;
        }
    }

    return DEFAULT_OLLAMA_HOST.endsWith('/') ? DEFAULT_OLLAMA_HOST.slice(0, -1) : DEFAULT_OLLAMA_HOST;
};

/**
 * GET /api/ai/models
 * Proxies request to local Ollama to get list of installed models
 */
app.get('/api/ai/models', async (req, res) => {
    const ollamaHost = getOllamaHost(req);
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // Increased timeout for external tunnels
        
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
app.post('/api/ai/generate', async (req, res) => {
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
app.post('/api/ai/chat', async (req, res) => {
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
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Export the app for Vercel
export default app;

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend server running on http://127.0.0.1:${PORT}`);
    console.log(`Security: CORS enabled for origins: ${allowedOrigins.join(', ')}`);
    console.log(`Security: Rate limiting enabled.`);
  });
}
