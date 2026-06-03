const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'sap-btp-portal-dev-secret-change-in-production';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const USERS_FILE = path.join(__dirname, 'users.json');

app.use(cors());
app.use(express.json());

// --- Rate limiting ---
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// --- Helpers ---

function readUsers() {
  const data = fs.readFileSync(USERS_FILE, 'utf8');
  return JSON.parse(data);
}

function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function getAuthUser(req, res) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token.' });
    return null;
  }
  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    const users = readUsers();
    const user = users.find(u => u.id === decoded.id);
    if (!user) { res.status(404).json({ error: 'User not found.' }); return null; }
    return { user, users };
  } catch (e) {
    res.status(401).json({ error: 'Invalid token.' });
    return null;
  }
}

// --- Routes ---

// POST /api/register
app.post('/api/register', authLimiter, async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });

  const users = readUsers();
  if (users.find(u => u.email === email.toLowerCase()))
    return res.status(409).json({ error: 'An account with this email already exists.' });

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = {
    id: Date.now().toString(),
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password: hashedPassword,
    createdAt: new Date().toISOString()
  };
  users.push(newUser);
  writeUsers(users);

  const token = signToken(newUser);
  res.status(201).json({ token, user: { id: newUser.id, name: newUser.name, email: newUser.email } });
});

// POST /api/login
app.post('/api/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required.' });

  const users = readUsers();
  const user = users.find(u => u.email === email.toLowerCase().trim());
  if (!user) return res.status(401).json({ error: 'Invalid email or password.' });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(401).json({ error: 'Invalid email or password.' });

  // Track streak
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (user.lastLoginDate === yesterday) {
    user.streak = (user.streak || 1) + 1;
  } else if (user.lastLoginDate !== today) {
    user.streak = 1;
  }
  user.lastLoginDate = today;
  writeUsers(users);

  const token = signToken(user);
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, streak: user.streak || 1 } });
});

// GET /api/verify
app.get('/api/verify', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer '))
    return res.status(401).json({ error: 'No token provided.' });
  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    const users = readUsers();
    const user = users.find(u => u.id === decoded.id);
    res.json({ valid: true, user: { id: decoded.id, name: decoded.name, email: decoded.email, streak: user?.streak || 1 } });
  } catch (err) {
    res.status(401).json({ error: 'Token is invalid or expired.' });
  }
});

// GET /api/refresh
app.get('/api/refresh', (req, res) => {
  const result = getAuthUser(req, res);
  if (!result) return;
  const token = signToken(result.user);
  res.json({ token });
});

// GET /api/progress
app.get('/api/progress', (req, res) => {
  const result = getAuthUser(req, res);
  if (!result) return;
  const { user } = result;
  res.json({
    progress:    user.progress    || {},
    doChecks:    user.doChecks    || {},
    practicedQ:  user.practicedQ  || {},
    bookmarks:   user.bookmarks   || [],
    notes:       user.notes       || {},
    timeSpent:   user.timeSpent   || {},
    theme:       user.theme       || 'dark',
    streak:      user.streak      || 1,
    lastLoginDate: user.lastLoginDate || null
  });
});

// POST /api/progress
app.post('/api/progress', (req, res) => {
  const result = getAuthUser(req, res);
  if (!result) return;
  const { user, users } = result;
  const { progress, doChecks, practicedQ, bookmarks, notes, timeSpent, theme } = req.body;
  if (progress   !== undefined) user.progress   = progress;
  if (doChecks   !== undefined) user.doChecks   = doChecks;
  if (practicedQ !== undefined) user.practicedQ = practicedQ;
  if (bookmarks  !== undefined) user.bookmarks  = bookmarks;
  if (notes      !== undefined) user.notes      = notes;
  if (timeSpent  !== undefined) user.timeSpent  = timeSpent;
  if (theme      !== undefined) user.theme      = theme;
  writeUsers(users);
  res.json({ ok: true });
});

// PATCH /api/password — change password
app.patch('/api/password', authLimiter, async (req, res) => {
  const result = getAuthUser(req, res);
  if (!result) return;
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword)
    return res.status(400).json({ error: 'Current and new password are required.' });
  if (newPassword.length < 6)
    return res.status(400).json({ error: 'New password must be at least 6 characters.' });

  const { user, users } = result;
  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) return res.status(401).json({ error: 'Current password is incorrect.' });

  user.password = await bcrypt.hash(newPassword, 10);
  writeUsers(users);
  res.json({ ok: true });
});

// GET /api/admin/users — admin only
app.get('/api/admin/users', (req, res) => {
  const adminPass = req.headers['x-admin-password'];
  if (adminPass !== ADMIN_PASSWORD)
    return res.status(401).json({ error: 'Invalid admin password.' });

  const users = readUsers();
  const ALL_LESSONS_COUNT = 25;
  const safeUsers = users.map(u => ({
    id:            u.id,
    name:          u.name,
    email:         u.email,
    createdAt:     u.createdAt,
    lastLoginDate: u.lastLoginDate || null,
    streak:        u.streak || 0,
    lessonsCompleted: Object.values(u.progress || {}).filter(Boolean).length,
    progressPct:   Math.round((Object.values(u.progress || {}).filter(Boolean).length / ALL_LESSONS_COUNT) * 100),
    totalMinutes:  Math.round(Object.values(u.timeSpent || {}).reduce((a, b) => a + b, 0) / 60),
    bookmarks:     (u.bookmarks || []).length,
    notes:         Object.keys(u.notes || {}).length,
  }));
  res.json({ users: safeUsers });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'SAP BTP Portal API is running.' });
});

app.listen(PORT, () => {
  console.log(`SAP BTP Portal API running on http://localhost:${PORT}`);

  const RENDER_URL = process.env.RENDER_EXTERNAL_URL;
  if (RENDER_URL) {
    setInterval(() => {
      fetch(`${RENDER_URL}/api/health`)
        .then(() => console.log('Keep-alive ping sent'))
        .catch(() => {});
    }, 14 * 60 * 1000);
  }
});
