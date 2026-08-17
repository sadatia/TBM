import express from 'express';
import session from 'express-session';
import bcrypt from 'bcrypt';
import PDFDocument from 'pdfkit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Database setup
const dbFolder = join(__dirname, 'database');
const dbFile = join(dbFolder, 'wellness.sqlite');

let db;

async function initDb() {
  if (!existsSync(dbFolder)) {
    await mkdir(dbFolder, { recursive: true });
  }

  db = await open({
    filename: dbFile,
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      position TEXT NOT NULL,
      pin TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_status (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      submission_date TEXT NOT NULL,
      submission_time TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(user_id, submission_date)
    );

    CREATE TABLE IF NOT EXISTS admin (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    );
  `);

  const adminCount = await db.get('SELECT COUNT(*) as count FROM admin');
  if (adminCount.count === 0) {
    const hashedPass = await bcrypt.hash('admin123', 10);
    await db.run('INSERT INTO admin (username, password) VALUES (?, ?)', ['admin', hashedPass]);
  }

  const userCount = await db.get('SELECT COUNT(*) as count FROM users');
  if (userCount.count === 0) {
    const defaultPin = await bcrypt.hash('1234', 10);
    await db.run('INSERT INTO users (username, position, pin) VALUES (?, ?, ?)', ['K Takae', 'PM', defaultPin]);
    await db.run('INSERT INTO users (username, position, pin) VALUES (?, ?, ?)', ['Nahid', 'IT', defaultPin]);
  }
}

await initDb();

app.set('view engine', 'ejs');
app.set('views', join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

app.use(session({
  secret: 'wellness_super_secret_key_123',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

const requireUserAuth = (req, res, next) => {
  if (req.session.user) return next();
  res.redirect('/');
};

const requireAdminAuth = (req, res, next) => {
  if (req.session.admin) return next();
  res.redirect('/admin/login');
};

// Check User Log Status API (For AJAX verification inside sidebar)
app.get('/api/user-status-today/:userId', async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const record = await db.get(
    'SELECT * FROM daily_status WHERE user_id = ? AND submission_date = ?',
    [req.params.userId, today]
  );
  res.json({ alreadySubmitted: !!record });
});

// Login Handler
app.post('/login', async (req, res) => {
  const { userId, pin } = req.body;
  const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);

  if (!user) {
    return res.status(401).json({ success: false, message: 'User not found' });
  }

  const isMatch = await bcrypt.compare(pin, user.pin);

  if (isMatch) {
    req.session.user = { id: user.id, username: user.username, position: user.position };
    return res.status(200).json({ success: true, username: user.username });
  } else {
    return res.status(401).json({ success: false, message: 'Invalid 4-digit PIN' });
  }
});

app.get('/', async (req, res) => {
  const users = await db.all('SELECT id, username, position FROM users ORDER BY id ASC');
  res.render('index', { users });
});

app.post('/submit-status', requireUserAuth, async (req, res) => {
  const { status } = req.body;
  const userId = req.session.user.id;
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const time = now.toTimeString().split(' ')[0];

  try {
    await db.run(
      'INSERT INTO daily_status (user_id, status, submission_date, submission_time) VALUES (?, ?, ?, ?)',
      [userId, status, date, time]
    );
    res.json({ success: true, status });
  } catch (err) {
    res.status(400).json({ success: false, message: 'already_submitted' });
  }
});

app.post('/change-pin', requireUserAuth, async (req, res) => {
  const { oldPin, newPin } = req.body;
  const userId = req.session.user.id;

  const user = await db.get('SELECT pin FROM users WHERE id = ?', [userId]);
  const isMatch = await bcrypt.compare(oldPin, user.pin);

  if (!isMatch) {
    return res.status(400).json({ success: false, message: 'Incorrect Old PIN' });
  }

  const hashedNewPin = await bcrypt.hash(newPin, 10);
  await db.run('UPDATE users SET pin = ? WHERE id = ?', [hashedNewPin, userId]);
  res.json({ success: true, message: 'PIN updated successfully!' });
});

// Admin Routes
app.get('/admin/login', (req, res) => res.render('admin-login', { error: req.query.error }));

app.post('/admin/login', async (req, res) => {
  const { username, password } = req.body;
  const admin = await db.get('SELECT * FROM admin WHERE username = ?', [username]);

  if (admin && await bcrypt.compare(password, admin.password)) {
    req.session.admin = { id: admin.id, username: admin.username };
    res.redirect('/admin/dashboard');
  } else {
    res.redirect('/admin/login?error=Invalid Credentials');
  }
});

// Admin Dashboard View - Filtered for TODAY's date only
app.get('/admin/dashboard', requireAdminAuth, async (req, res) => {
  const today = new Date().toISOString().split('T')[0];

  const users = await db.all('SELECT id, username, position FROM users ORDER BY id ASC');
  
  // Fetch logs ONLY for today
  const logs = await db.all(`
    SELECT ds.id, u.username, u.position, ds.status, ds.submission_date, ds.submission_time 
    FROM daily_status ds
    JOIN users u ON ds.user_id = u.id
    WHERE ds.submission_date = ?
    ORDER BY ds.submission_time DESC
  `, [today]);

  res.render('admin-dashboard', { users, logs, msg: req.query.msg, today });
});

app.get('/admin/analytics', requireAdminAuth, async (req, res) => {
  const { startDate, endDate } = req.query;
  let reportData = [];
  let overallStats = { well: 0, notWell: 0, totalLogs: 0 };

  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const totalDaysInRange = (Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1) || 1;

    const users = await db.all('SELECT id, username, position FROM users ORDER BY id ASC');

    for (const user of users) {
      const logs = await db.all(
        `SELECT * FROM daily_status 
         WHERE user_id = ? AND submission_date >= ? AND submission_date <= ?`,
        [user.id, startDate, endDate]
      );

      const wellCount = logs.filter(l => l.status === 'Well').length;
      const notWellCount = logs.length - wellCount;

      overallStats.well += wellCount;
      overallStats.notWell += notWellCount;
      overallStats.totalLogs += logs.length;

      const compliance = Math.min(Math.round((logs.length / totalDaysInRange) * 100), 100);

      reportData.push({
        name: user.username,
        position: user.position,
        submissionCount: logs.length,
        wellCount,
        notWellCount,
        complianceScore: compliance
      });
    }
  }

  res.render('admin-analytics', { startDate, endDate, reportData, overallStats });
});

// Admin - Download Daily PDF Report
app.get('/admin/download-pdf', requireAdminAuth, async (req, res) => {
  try {
    const logs = await db.all(`
      SELECT u.username, u.position, ds.status, ds.submission_date, ds.submission_time 
      FROM daily_status ds
      JOIN users u ON ds.user_id = u.id
      ORDER BY ds.submission_date DESC, ds.submission_time DESC
    `);

    const doc = new PDFDocument({ margin: 30, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=daily_wellness_report.pdf');

    doc.pipe(res);

    // Title & Header
    doc.fontSize(20).fillColor('#002b5c').text('Penta-Ocean / TOA JV', { align: 'center' });
    doc.fontSize(14).fillColor('#475569').text('Daily Wellness & Attendance Report', { align: 'center' });
    doc.moveDown(1.5);

    // Table Headers
    const tableTop = 120;
    doc.fontSize(10).fillColor('#002b5c').font('Helvetica-Bold');
    doc.text('User', 50, tableTop);
    doc.text('Position', 180, tableTop);
    doc.text('Status', 330, tableTop);
    doc.text('Date', 420, tableTop);
    doc.text('Time', 500, tableTop);

    doc.moveTo(40, tableTop + 15).lineTo(550, tableTop + 15).stroke('#cbd5e1');

    // Table Rows
    let y = tableTop + 25;
    doc.font('Helvetica');

    logs.forEach((log) => {
      if (y > 750) { 
        doc.addPage(); 
        y = 50; 
      }

      doc.fillColor('#1e293b').fontSize(9);
      doc.text(log.username, 50, y);
      doc.text(log.position, 180, y);

      if (log.status === 'Well') {
        doc.fillColor('#16a34a').text(log.status, 330, y);
      } else {
        doc.fillColor('#dc2626').text(log.status, 330, y);
      }

      doc.fillColor('#1e293b').text(log.submission_date, 420, y);
      doc.text(log.submission_time, 500, y);

      y += 20;
    });

    doc.end();
  } catch (error) {
    console.error('PDF Generation Error:', error);
    res.status(500).send('Error generating PDF report');
  }
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

const PORT = process.env.PORT || 4010;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server running on http://localhost:${PORT}`));