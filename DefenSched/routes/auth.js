'use strict';

const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const db      = require('../database');

// POST /api/auth/register
router.post('/register', (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role)
    return res.status(400).json({ error: 'All fields are required.' });

  const hashed = bcrypt.hashSync(password, 10);
  try {
    const { lastInsertRowid: id } = db.prepare(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES (?, ?, ?, ?)
    `).run(name, email.toLowerCase().trim(), hashed, role);

    res.status(201).json({ success: true, user_id: id });
  } catch (e) {
    if (e.message.includes('UNIQUE'))
      return res.status(400).json({ error: 'Email already exists.' });
    throw e;
  }
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required.' });

  const user = db.prepare('SELECT * FROM users WHERE email = ? AND is_active = 1')
                 .get(email.toLowerCase().trim());

  if (!user || !bcrypt.compareSync(password, user.password_hash))
    return res.status(401).json({ error: 'Invalid email or password.' });

  req.session.userId = user.id;
  req.session.role   = user.role;

  res.json({
    success: true,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, group_name: user.group_name }
  });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  if (!req.session?.userId) return res.status(401).json({ error: 'Not authenticated.' });
  const user = db.prepare('SELECT id, name, email, role, group_name FROM users WHERE id = ?')
                 .get(req.session.userId);
  if (!user) return res.status(401).json({ error: 'User not found.' });
  res.json({ user });
});

module.exports = router;
