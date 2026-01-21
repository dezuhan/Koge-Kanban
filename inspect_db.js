import Database from 'better-sqlite3';
import path from 'path';

const db = new Database('db/kanban.db');
const rows = db.prepare("SELECT key FROM kv_store").all();
console.log('kv_store keys:', rows.map(r => r.key).join(', '));
const trashRows = db.prepare("SELECT key FROM trash_store").all();
console.log('trash_store keys:', trashRows.map(r => r.key).join(', '));
