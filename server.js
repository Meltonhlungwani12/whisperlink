const express = require('express');
const http = require('http');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');require('dotenv').config();


const PORT = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET || 'fallback-secret';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
app.use(cors({ origin: CORS_ORIGIN }));

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const USERS_DB = path.join(__dirname, 'users.json');

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../frontend')));

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'Token missing' });

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(403).json({ message: 'Invalid token' });
  }
}

function getUsers() {
  if (!fs.existsSync(USERS_DB)) fs.writeFileSync(USERS_DB, '[]');
  return JSON.parse(fs.readFileSync(USERS_DB));
}

function saveUsers(users) {
  fs.writeFileSync(USERS_DB, JSON.stringify(users, null, 2));
}

app.post('/api/auth/register', (req, res) => {
  const { email, password, username } = req.body;
  if (!email || !password || !username) return res.status(400).json({ message: 'All fields required' });

  const users = getUsers();
  if (users.find(u => u.email === email)) {
    return res.status(400).json({ message: 'Email already registered' });
  }

  const newUser = { id: Date.now(), email, password, username };
  users.push(newUser);
  saveUsers(users);

  const token = jwt.sign({ id: newUser.id, email }, SECRET, { expiresIn: '1d' });
  res.json({ message: 'Registered successfully', token });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const users = getUsers();
  const user = users.find(u => u.email === email && u.password === password);

  if (!user) return res.status(401).json({ message: 'Invalid credentials' });

  const token = jwt.sign({ id: user.id, email }, SECRET, { expiresIn: '1d' });
  res.json({ message: 'Login successful', token });
});

app.get('/api/verify-token', verifyToken, (req, res) => {
  res.json({ id: req.user.id, email: req.user.email });
});

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication error'));

  try {
    const decoded = jwt.verify(token, SECRET);
    socket.user = decoded;
    next();
  } catch (err) {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  console.log(`✅ ${socket.user.email} connected via WebSocket`);

  setInterval(() => {
    socket.emit('new-message', {
      id: Date.now(),
      content: 'You got a new anonymous message!'
    });
  }, 10000);

  setInterval(() => {
    socket.emit('new-match', {
      id: Date.now(),
      username: 'Crush_' + Math.floor(Math.random() * 1000)
    });
  }, 15000);
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
