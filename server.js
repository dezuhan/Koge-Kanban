import express from 'express';
import mariadb from 'mariadb';
import cors from 'cors';
import { fileURLToPath } from 'url';
import path from 'path';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Database Configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost', 
  user: process.env.DB_USER || 'root', 
  password: process.env.DB_PASSWORD || '',
  connectionLimit: 5
};

const DB_NAME = 'simplo_kanban';

// Create a pool
let pool;

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

// Generic GET endpoint
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

// Generic DELETE endpoint (Hard Delete / Drop Data)
app.delete('/api/data/:key', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not initialized' });

  let conn;
  try {
    conn = await pool.getConnection();
    
    // Hard delete the row from the table
    // This performs a true "Drop Data" operation for the specific key
    await conn.query("DELETE FROM kv_store WHERE `key` = ?", [req.params.key]);
    
    res.json({ success: true, message: `Data for ${req.params.key} dropped successfully.` });
  } catch (error) {
    console.error(`Database delete error for key ${req.params.key}:`, error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (conn) conn.release();
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend server running on http://127.0.0.1:${PORT}`);
});
