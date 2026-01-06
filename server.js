import express from 'express';
import mariadb from 'mariadb';
import cors from 'cors';
import { fileURLToPath } from 'url';
import path from 'path';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static files from the React app build directory
app.use(express.static(path.join(__dirname, 'dist')));

// Database Configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost', 
  user: process.env.DB_USER || 'root', 
  password: process.env.DB_PASSWORD || '',
  connectionLimit: 5
};

const DB_NAME = 'koge_kanban';

// Create a pool
let pool;

/**
 * Initializes the MariaDB database connection and ensures the required table exists.
 * It attempts to create the database if it doesn't exist, then creates the 'kv_store' table.
 */
async function initializeDatabase() {
  let conn;
  try {
    // 1. Connect without selecting a database to check/create the DB
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
    process.exit(1);
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
 * Used for the "Recent Tasks" dashboard.
 * 
 * Logic:
 * 1. Fetches all rows where key starts with 'tasks_'.
 * 2. Parses the JSON value of each row.
 * 3. Extracts the Project ID from the key ('tasks_{projectId}').
 * 4. Injects the '_projectId' into each task object for frontend lookup.
 * 5. Returns a flattened array of all tasks.
 */
app.get('/api/tasks/global', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not initialized' });
  
  let conn;
  try {
    conn = await pool.getConnection();
    console.log("Fetching global tasks...");
    // Fetch all keys starting with 'tasks_'
    const rows = await conn.query("SELECT `key`, `value` FROM kv_store WHERE `key` LIKE 'tasks_%'");
    console.log(`Found ${rows.length} project task entries.`);
    
    // Flatten all task arrays into one single array AND inject projectId from the key
    const allTasks = rows.reduce((acc, row) => {
        try {
            // Key format: "tasks_{projectId}"
            // Extract projectId from the key name
            // e.g. "tasks_intro-project-welcome" -> "intro-project-welcome"
            const keyParts = row.key ? row.key.split('tasks_') : [];
            const projectId = keyParts.length > 1 ? keyParts[1] : null;

            const tasks = JSON.parse(row.value);
            
            if (Array.isArray(tasks)) {
                // Inject the real Project ID into the task object for easier lookup
                const tasksWithPid = tasks.map(t => ({
                    ...t,
                    _projectId: projectId // Add internal field for lookup
                }));
                return [...acc, ...tasksWithPid];
            }
            return acc;
        } catch (e) {
            console.error("Error parsing task row", e);
            return acc;
        }
    }, []);
    
    console.log(`Returning ${allTasks.length} global tasks.`);
    res.json(allTasks);
  } catch (error) {
    console.error(`Database global tasks error:`, error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (conn) conn.release();
  }
});

// Generic GET endpoint
/**
 * GET /api/data/:key
 * Retrieves a specific JSON value by its key.
 */
app.get('/api/data/:key', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not initialized' });
  
  let conn;
  try {
    conn = await pool.getConnection();
    const rows = await conn.query("SELECT `value` FROM kv_store WHERE `key` = ?", [req.params.key]);
    
    // MariaDB returns an array. If empty, return null.
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
/**
 * POST /api/data/:key
 * Saves (Upserts) a JSON value to a specific key.
 * Uses ON DUPLICATE KEY UPDATE to handle both inserts and updates.
 */
app.post('/api/data/:key', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not initialized' });

  let conn;
  try {
    conn = await pool.getConnection();
    const valueStr = JSON.stringify(req.body);
    
    // MariaDB UPSERT syntax
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
/**
 * DELETE /api/data/:key
 * Permanently removes a key and its value from the database.
 * Supports wildcard matching if key ends with '*'.
 */
app.delete('/api/data/:key', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not initialized' });

  let conn;
  try {
    conn = await pool.getConnection();
    const key = req.params.key;
    
    let result;
    if (key.endsWith('*')) {
        const prefix = key.slice(0, -1);
        // Delete all keys starting with prefix
        // Note: DELETE with LIKE might not be standard in all SQL dialects for simple KV tables, 
        // but typically: DELETE FROM kv_store WHERE `key` LIKE 'prefix%'
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

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';

/**
 * GET /api/ai/models
 * Proxies request to local Ollama to get list of installed models
 */
app.get('/api/ai/models', async (req, res) => {
    try {
        // 1. Check if Ollama is reachable
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        
        const response = await fetch(`${OLLAMA_HOST}/api/tags`, { 
            signal: controller.signal 
        });
        clearTimeout(timeoutId);

        if (!response.ok) throw new Error("Failed to fetch models from Ollama");
        
        const data = await response.json();
        // Ollama returns { models: [...] }
        res.json(data);
    } catch (error) {
        console.error("AI Models Fetch Error:", error);
        res.status(503).json({ error: "Ollama service is offline or unreachable." });
    }
});

/**
 * POST /api/ai/generate
 * Proxies request to local Ollama instance
 */
app.post('/api/ai/generate', async (req, res) => {
    const { prompt, model, options } = req.body;
    
    // Default model if not specified
    const targetModel = model || "gemma3:4b";
    
    try {
        // 1. Check if Ollama is reachable (optional fast check)
        try {
            const check = await fetch(`${OLLAMA_HOST}/api/tags`, { signal: AbortSignal.timeout(1000) });
            if (!check.ok) throw new Error("Ollama not ready");
        } catch (e) {
            return res.status(503).json({ error: "Ollama service is offline or unreachable." });
        }

        // 2. Forward request to Ollama
        const requestBody = {
            model: targetModel,
            prompt: prompt,
            stream: false
        };

        // Add options if provided (e.g. temperature)
        if (options) {
            requestBody.options = options;
        }

        const ollamaRes = await fetch(`${OLLAMA_HOST}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });
        
        if (!ollamaRes.ok) {
            throw new Error(`Ollama API error: ${ollamaRes.statusText}`);
        }

        const data = await ollamaRes.json();
        res.json({ response: data.response });

    } catch (error) {
        console.error("AI Generation Error:", error);
        res.status(500).json({ error: error.message || "Failed to generate AI response" });
    }
});

// Catch-all handler for any request that doesn't match an API route
// Sends back the React index.html file to handle client-side routing
app.get('*', (req, res) => {
  // Don't intercept API routes
  if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend server running on http://127.0.0.1:${PORT}`);
});
