import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function migrateDump() {
  const dbFolder = path.join(__dirname, 'database');
  if (!fs.existsSync(dbFolder)) fs.mkdirSync(dbFolder, { recursive: true });

  const db = await open({
    filename: path.join(dbFolder, 'wellness.sqlite'),
    driver: sqlite3.Database
  });

  console.log('Creating SQLite tables...');
  
  await db.exec(`
    DROP TABLE IF EXISTS daily_status;
    DROP TABLE IF EXISTS users;
    DROP TABLE IF EXISTS admin;

    CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      username TEXT NOT NULL,
      position TEXT NOT NULL,
      pin TEXT NOT NULL,
      is_admin INTEGER DEFAULT 0
    );

    CREATE TABLE daily_status (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      submission_date TEXT NOT NULL,
      submission_time TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, submission_date)
    );

    CREATE TABLE admin (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    );
  `);

  // Read SQL File
  const sqlDumpPath = path.join(__dirname, 'tbm_db.sql');
  if (!fs.existsSync(sqlDumpPath)) {
    console.error('Error: Put your SQL dump file in project root named "tbm_db.sql"');
    process.exit(1);
  }

  const sqlContent = fs.readFileSync(sqlDumpPath, 'utf8');

  // Insert Users
  console.log('Migrating personnel data...');
  const userMatch = sqlContent.match(/INSERT INTO `users`[\s\S]*?;/g);
  if (userMatch) {
    for (const statement of userMatch) {
      const cleanStmt = statement
        .replace(/`users`/g, 'users')
        .replace(/`pin`/g, 'pin')
        .replace(/`username`/g, 'username')
        .replace(/`position`/g, 'position')
        .replace(/`is_admin`/g, 'is_admin');
      await db.exec(cleanStmt);
    }
  }

  // Insert Wellness Status Records mapped to daily_status
  console.log('Migrating historical health records...');
  const statusMatches = sqlContent.match(/INSERT INTO `wellness_status`[\s\S]*?;/g);
  if (statusMatches) {
    for (const statement of statusMatches) {
      // Convert INSERT INTO wellness_status (id, user_id, status, tbm_understood, date, submitted_at)
      // to SQLite daily_status schema (id, user_id, status, submission_date, submission_time)
      const valuesMatch = statement.match(/\(([^)]+)\)/g);
      if (valuesMatch) {
        for (const val of valuesMatch) {
          const parts = val.replace(/[()']/g, '').split(',').map(s => s.trim());
          if (parts.length >= 6 && !isNaN(parseInt(parts[0]))) {
            const id = parseInt(parts[0]);
            const userId = parseInt(parts[1]);
            const status = parts[2];
            const date = parts[4];
            const timestamp = parts[5];
            const time = timestamp.includes(' ') ? timestamp.split(' ')[1] : '00:00:00';

            await db.run(
              `INSERT OR REPLACE INTO daily_status (id, user_id, status, submission_date, submission_time) 
               VALUES (?, ?, ?, ?, ?)`,
              [id, userId, status, date, time]
            );
          }
        }
      }
    }
  }

  // Ensure Admin user exists with default credentials if no admin found
  const superAdmin = await db.get('SELECT * FROM users WHERE is_admin = 1 OR username = "admin"');
  if (superAdmin) {
    await db.run(
      'INSERT OR REPLACE INTO admin (id, username, password) VALUES (1, ?, ?)',
      [superAdmin.username, superAdmin.pin]
    );
  }

  console.log('Migration Completed Successfully!');
  await db.close();
}

migrateDump().catch(console.error);