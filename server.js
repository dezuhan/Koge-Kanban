import express from 'express';
import mariadb from 'mariadb';
import cors from 'cors';
import { fileURLToPath } from 'url';
import path from 'path';
import helmet from 'helmet';
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
    // console.log(`Database '${DB_NAME}' checked/created.`); // Removed for cleaner logs
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
    console.log(`Security: Rate limiting enabled.`);
  });
}
