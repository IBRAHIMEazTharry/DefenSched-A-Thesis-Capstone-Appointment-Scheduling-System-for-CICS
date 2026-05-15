'use strict';

const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const db      = require('../database');

// POST /api/auth/register
router.post('/register', (req, res) => {
  const { name, email, password, role, is_group, group_name, leader_name, member_names } = req.body;
  if (!name || !email || !password || !role)
    return res.status(400).json({ error: 'All fields are required.' });

  // Build members JSON for group student accounts
  let membersJson = null;
  let isGroup = 0;
  if (role === 'student' && is_group) {
    isGroup = 1;
    if (!leader_name) return res.status(400).json({ error: 'Team leader name is required for group accounts.' });
    const names = Array.isArray(member_names) ? member_names.filter(n => n && n.trim()) : [];
    membersJson = JSON.stringify({ leader: leader_name.trim(), members: names.map(n => n.trim()) });
  }

  const hashed = bcrypt.hashSync(password, 10);
  try {
    const { lastInsertRowid: id } = db.prepare(`
      INSERT INTO users (name, email, password_hash, role, group_name, is_group, members)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(name, email.toLowerCase().trim(), hashed, role, group_name || null, isGroup, membersJson);

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
    user: { id: user.id, name: user.name, email: user.email, role: user.role, group_name: user.group_name, is_group: user.is_group, members: user.members }
  });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  if (!req.session?.userId) return res.status(401).json({ error: 'Not authenticated.' });
  const user = db.prepare('SELECT id, name, email, role, group_name, is_group, members FROM users WHERE id = ?')
                 .get(req.session.userId);
  if (!user) return res.status(401).json({ error: 'User not found.' });
  res.json({ user });
});

module.exports = router;
