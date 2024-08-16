const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./database'); // Ensure this file sets up the database connection correctly

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json()); // Use built-in express.json() instead of body-parser


const port = process.env.PORT || 3000;


// Middleware to log requests
app.use((req, res, next) => {
  console.log('Incoming request:', req.body); // Debugging line
  next();
});

// Middleware to check JWT token
const authenticateJWT = (req, res, next) => {
  const token = req.header('x-auth-token');
  if (token == null) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// User Registration
app.post('/register', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  console.log('Received:', { username, password }); // Debugging line

  try {
    const hashedPassword = bcrypt.hashSync(password, 10);
    db.run(`INSERT INTO users (username, password) VALUES (?, ?)`, [username, hashedPassword], function (err) {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      res.status(201).json({ id: this.lastID });
    });
  } catch (error) {
    console.error('Error hashing password:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// User Login
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(400).json({ error: 'User not found' });

    if (bcrypt.compareSync(password, user.password)) {
      const accessToken = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET);
      res.json({ accessToken });
    } else {
      res.status(400).json({ error: 'Invalid credentials' });
    }
  });
});

// CRUD Operations for To-Dos
app.post('/todos', authenticateJWT, (req, res) => {
  const { description } = req.body;
  const userId = req.user.id;

  db.run(`INSERT INTO todos (user_id, description) VALUES (?, ?)`, [userId, description], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: this.lastID });
  });
});

app.get('/todos', authenticateJWT, (req, res) => {
  const userId = req.user.id;

  db.all(`SELECT * FROM todos WHERE user_id = ?`, [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.put('/todos/:id', authenticateJWT, (req, res) => {
  const { description, status } = req.body;
  const { id } = req.params;
  const userId = req.user.id;

  db.run(`UPDATE todos SET description = ?, status = ? WHERE id = ? AND user_id = ?`, [description, status, id, userId], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'To-do not found' });
    res.sendStatus(204);
  });
});

app.delete('/todos/:id', authenticateJWT, (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  db.run(`DELETE FROM todos WHERE id = ? AND user_id = ?`, [id, userId], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'To-do not found' });
    res.sendStatus(204);
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
