import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check common locations
const pathsToCheck = [
    path.join(__dirname, 'db', 'kanban.db'),
    path.join(__dirname, 'kanban.db')
];

let finalPath = '';
for (const p of pathsToCheck) {
    if (fs.existsSync(p)) {
        finalPath = p;
        break;
    }
}

if (!finalPath) {
    console.error('Could not find kanban.db');
    process.exit(1);
}

console.log(`Reading database from: ${finalPath}`);
const db = new Database(finalPath);

try {
    const users = db.prepare('SELECT * FROM users').all();
    if (users.length === 0) {
        console.log("No users found in the 'users' table yet.");
    } else {
        console.log(`Found ${users.length} user(s):`);
        console.table(users);
    }
} catch (error) {
    console.error("Error querying users table:", error.message);
}
