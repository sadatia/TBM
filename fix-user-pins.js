import path from 'path';
import { fileURLToPath } from 'url';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import bcrypt from 'bcrypt';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fixUserPins() {
  const dbFile = path.join(__dirname, 'database', 'wellness.sqlite');

  const db = await open({
    filename: dbFile,
    driver: sqlite3.Database
  });

  console.log('Fixing user PIN compatibility...');

  // 1. Convert any PHP $2y$ hashes to standard $2b$ hashes so Node bcrypt recognizes them
  await db.run(`UPDATE users SET pin = REPLACE(pin, '$2y$', '$2b$') WHERE pin LIKE '$2y$%'`);

  // 2. Alternatively, generate a fresh Node bcrypt hash for '1234' and update all non-admin users
  const defaultPinHash = await bcrypt.hash('1234', 10);
  await db.run('UPDATE users SET pin = ? WHERE is_admin = 0 OR is_admin IS NULL', [defaultPinHash]);

  console.log('✅ All user PINs successfully reset to default: 1234');
  await db.close();
}

fixUserPins().catch(console.error);