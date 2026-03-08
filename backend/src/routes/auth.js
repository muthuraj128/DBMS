const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const schemaInfo = require('../schema-info');
const auth = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';

router.post('/register', async (req, res) => {
  try {
    const { passwordColumn, userRole } = await schemaInfo.detect();
    const { name, email, phone, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length) return res.status(400).json({ error: 'Email already registered' });
    const hashed = await bcrypt.hash(password, 10);
    const created = await db.query(
      `INSERT INTO users(email,name,phone,${passwordColumn},role) VALUES($1,$2,$3,$4,$5) RETURNING id,email,name,role`,
      [email, name || null, phone || null, hashed, userRole]
    );
    const user = created.rows[0];
    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role }, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { passwordColumn } = await schemaInfo.detect();
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const result = await db.query(
      `SELECT id,email,name,${passwordColumn} AS pwd,role FROM users WHERE email = $1`,
      [email]
    );
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, user.pwd);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role }, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/me', auth, async (req, res) => {
  try {
    const result = await db.query('SELECT id,email,name,phone,role FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: list all customers
router.get('/admin/customers', auth, isAdmin, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.email, u.name, u.phone, u.created_at,
              COUNT(o.id)::int AS order_count,
              COALESCE(SUM(CASE WHEN o.payment_status = 'PAID' THEN o.total_cents ELSE 0 END), 0)::int AS total_spent_cents
       FROM users u
       LEFT JOIN orders o ON o.user_id = u.id
       WHERE u.role = 'USER'
       GROUP BY u.id
       ORDER BY u.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
