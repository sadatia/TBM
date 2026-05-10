import express from 'express';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

// Database setup
const adapter = new JSONFile(join(__dirname, 'db.json'));
const db = new Low(adapter, { users: [], records: [] });

// Change this line in your server.js
const file = join(__dirname, 'data', 'db.json'); 
// Ensure the 'data' folder exists in your project or Dockerfile

// Admin Security Key
const ADMIN_KEY = "admin123"; 

async function initDb() {
    await db.read();
    db.data ||= { 
        users: [
            { id: 1, name: "K Takae", position: "PM", passcode: "1234" },
            { id: 2, name: "Nahid", position: "IT", passcode: "1234" }
        ], 
        records: [] 
    };
    await db.write();
}
await initDb();

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public')); // Ensure your logo is in /public/logo/ptjvlogo.png

// --- ROUTES ---

// Main User List
app.get('/', async (req, res) => {
    await db.read();
    res.render('index', { users: db.data.users });
});

// Login and Declaration Page
app.post('/declaration', async (req, res) => {
    await db.read();
    const { userId, passcode } = req.body;
    const user = db.data.users.find(u => u.id == userId);
    if (user && user.passcode === passcode) {
        res.render('declaration', { user });
    } else {
        res.send("<script>alert('Invalid Passcode'); window.location='/';</script>");
    }
});

// Submission
app.post('/submit', async (req, res) => {
    const { userId, status, tbmConfirmed } = req.body;
    const user = db.data.users.find(u => u.id == userId);
    db.data.records.push({
        name: user.name,
        status,
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        tbm: tbmConfirmed === 'on'
    });
    await db.write();
    res.render('success');
});

// Admin Dashboard (Protected)
app.get('/admin', async (req, res) => {
    if (req.query.key !== ADMIN_KEY) return res.status(403).send("Access Denied");
    await db.read();
    const stats = {
        total: db.data.records.length,
        well: db.data.records.filter(r => r.status === 'Well').length,
        notWell: db.data.records.filter(r => r.status !== 'Well').length
    };
    res.render('admin', { users: db.data.users, records: db.data.records, stats, adminKey: ADMIN_KEY });
});

app.post('/admin/add-user', async (req, res) => {
    if (req.query.key !== ADMIN_KEY) return res.status(403).send("Unauthorized");
    db.data.users.push({
        id: db.data.users.length + 1,
        name: req.body.name,
        position: req.body.position,
        passcode: "1234"
    });
    await db.write();
    res.redirect(`/admin?key=${ADMIN_KEY}`);
});

app.post('/update-passcode', async (req, res) => {
    const user = db.data.users.find(u => u.id == req.body.userId);
    if (user) {
        user.passcode = req.body.newPasscode;
        await db.write();
        res.send("<script>alert('Passcode Updated'); window.location='/';</script>");
    }
});
// Admin - Edit User Name or Password
app.post('/admin/edit-user', async (req, res) => {
    // Security check
    if (req.query.key !== ADMIN_KEY) return res.status(403).send("Unauthorized");

    const { userId, newName, newPasscode } = req.body;
    await db.read();
    
    const user = db.data.users.find(u => u.id == userId);
    if (user) {
        if (newName) user.name = newName;
        if (newPasscode) user.passcode = newPasscode;
        
        await db.write();
    }
    
    res.redirect(`/admin?key=${ADMIN_KEY}`);
});

// Admin - Delete User
app.post('/admin/delete-user', async (req, res) => {
    if (req.query.key !== ADMIN_KEY) return res.status(403).send("Unauthorized");

    const { userId } = req.body;
    await db.read();
    
    // Filter out the user with the matching ID
    db.data.users = db.data.users.filter(u => u.id != userId);
    
    await db.write();
    res.redirect(`/admin?key=${ADMIN_KEY}`);
});

app.get('/admin/analysis', async (req, res) => {
    if (req.query.key !== ADMIN_KEY) return res.status(403).send("Unauthorized");
    await db.read();

    const { startDate, endDate } = req.query;
    let reportData = [];
    let overallStats = { well: 0, notWell: 0, totalLogs: 0 };

    if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        // Calculate total days in range
        const diffTime = Math.abs(end - start);
        const totalDaysInRange = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

        reportData = db.data.users.map(user => {
            // Find all logs for THIS user in THIS range
            const userLogs = db.data.records.filter(r => {
                const rDate = new Date(r.date);
                return r.name === user.name && rDate >= start && rDate <= end;
            });

            const wellCount = userLogs.filter(l => l.status === 'Well').length;
            const notWellCount = userLogs.length - wellCount;

            overallStats.well += wellCount;
            overallStats.notWell += notWellCount;
            overallStats.totalLogs += userLogs.length;

            return {
                name: user.name,
                position: user.position,
                submissionCount: userLogs.length,
                wellCount: wellCount,
                notWellCount: notWellCount,
                complianceScore: Math.round((userLogs.length / totalDaysInRange) * 100),
                logs: userLogs // Detail list if needed
            };
        });
    }

    res.render('analysis', { 
        startDate, endDate, reportData, overallStats, 
        adminKey: ADMIN_KEY 
    });
});

app.use(express.static('public'));

app.listen(3000, () => console.log('🚀 Server: http://localhost:3000'));