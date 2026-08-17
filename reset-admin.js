import path from 'path';
import { fileURLToPath } from 'url';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import bcrypt from 'bcrypt';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function resetAdmin() {
  const dbFile = path.join(__dirname, 'database', 'wellness.sqlite');

  const db = await open({
    filename: dbFile,
    driver: sqlite3.Database
  });

  const newHashedPassword = await bcrypt.hash('445566778899', 10);

  await db.run('DELETE FROM admin WHERE username = "admin"');
  await db.run('INSERT INTO admin (username, password) VALUES (?, ?)', ['admin', newHashedPassword]);

  console.log('✅ Admin credentials successfully reset!');
  console.log('Username: admin');
  console.log('Password: 445566778899');

  await db.close();
}

resetAdmin().catch(console.error);