const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'sap-btp-portal-dev-secret-change-in-production';
const USERS_FILE = path.join(__dirname, 'users.json');

app.use(cors());
app.use(express.json());

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
    { expiresIn: '1h' }
  );
}

// --- Routes ---

// POST /api/register
app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  const users = readUsers();

  if (users.find(u => u.email === email.toLowerCase())) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

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
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const users = readUsers();
  const user = users.find(u => u.email === email.toLowerCase().trim());

  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const token = signToken(user);
  res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

// GET /api/verify
app.get('/api/verify', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ valid: true, user: { id: decoded.id, name: decoded.name, email: decoded.email } });
  } catch (err) {
    res.status(401).json({ error: 'Token is invalid or expired.' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'SAP BTP Portal API is running.' });
});

app.listen(PORT, () => {
  console.log(`SAP BTP Portal API running on http://localhost:${PORT}`);
  console.log('Routes: POST /api/register | POST /api/login | GET /api/verify');
});
