import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FT_DIR = path.join(__dirname, 'fine-tunning');
if (!fs.existsSync(FT_DIR)) {
  fs.mkdirSync(FT_DIR, { recursive: true });
}
const DB_PATH = path.join(FT_DIR, 'fine-tunning.sqlite');

let ftDb;

export function initFineTuningDb() {
  ftDb = new Database(DB_PATH, { timeout: 10000 });
  ftDb.pragma('journal_mode = WAL');

  // Create table if not exists, but NO hardcoded inserts per user request
  ftDb.prepare(`
    CREATE TABLE IF NOT EXISTS prompts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Custom',
      content TEXT NOT NULL,
      default_content TEXT NOT NULL,
      temperature REAL DEFAULT 0.7,
      is_system INTEGER DEFAULT 0
    )
  `).run();
}

export function registerFineTuningRoutes(app, authMiddleware) {
  // Get all prompts
  app.get('/api/fine-tuning/prompts', authMiddleware, (req, res) => {
    try {
      const rows = ftDb.prepare("SELECT * FROM prompts ORDER BY is_system DESC, category ASC, title ASC").all();
      res.json(rows);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Get single prompt
  app.get('/api/fine-tuning/prompts/:id', authMiddleware, (req, res) => {
    try {
      const row = ftDb.prepare("SELECT * FROM prompts WHERE id = ?").get(req.params.id);
      if (!row) return res.status(404).json({ error: 'Not found' });
      res.json(row);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Update prompt
  app.patch('/api/fine-tuning/prompts/:id', authMiddleware, (req, res) => {
    try {
      const { content, temperature, title, category } = req.body;
      const stmt = ftDb.prepare(`
        UPDATE prompts 
        SET content = COALESCE(@content, content),
            temperature = COALESCE(@temperature, temperature),
            title = COALESCE(@title, title),
            category = COALESCE(@category, category)
        WHERE id = @id
      `);
      const info = stmt.run({ content, temperature, title, category, id: req.params.id });
      if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Reset prompt to default
  app.post('/api/fine-tuning/prompts/:id/reset', authMiddleware, (req, res) => {
    try {
      const stmt = ftDb.prepare("UPDATE prompts SET content = default_content WHERE id = ?");
      const info = stmt.run(req.params.id);
      if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Create custom prompt
  app.post('/api/fine-tuning/prompts', authMiddleware, (req, res) => {
    try {
      const { id, title, category, content, temperature } = req.body;
      if (!id || !title || !content || !category) {
        return res.status(400).json({ error: 'id, title, category, and content are required' });
      }
      // Check if id exists
      const existing = ftDb.prepare("SELECT id FROM prompts WHERE id = ?").get(id);
      if (existing) return res.status(409).json({ error: 'ID already exists' });

      const stmt = ftDb.prepare("INSERT INTO prompts (id, title, category, content, default_content, temperature, is_system) VALUES (?, ?, ?, ?, ?, ?, 0)");
      stmt.run(id, title, category, content, content, typeof temperature === 'number' ? temperature : 0.7);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Delete custom prompt
  app.delete('/api/fine-tuning/prompts/:id', authMiddleware, (req, res) => {
    try {
      // Ensure we don't delete system prompts
      const row = ftDb.prepare("SELECT is_system FROM prompts WHERE id = ?").get(req.params.id);
      if (!row) return res.status(404).json({ error: 'Not found' });
      if (row.is_system) return res.status(403).json({ error: 'Cannot delete system prompts' });

      const stmt = ftDb.prepare("DELETE FROM prompts WHERE id = ?");
      stmt.run(req.params.id);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
}
