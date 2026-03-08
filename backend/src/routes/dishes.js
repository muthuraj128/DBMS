const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');
const multer = require('multer');
const path = require('node:path');

// Setup multer storage to backend/uploads
const uploadDir = path.resolve(__dirname, '..', '..', 'uploads');
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext).replaceAll(/\s+/g, '-');
    cb(null, Date.now() + '-' + name + ext);
  }
});
const upload = multer({ storage });

// Admin: list all dishes
router.get('/admin', auth, isAdmin, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM dishes ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: create dish
router.post('/', auth, isAdmin, upload.single('photo'), async (req, res) => {
  try {
    const { name, description, price_cents, available_quantity, available_from_minutes, available_to_minutes } = req.body;
    if (!name || !price_cents || available_from_minutes == null || available_to_minutes == null) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const photo_url = req.file ? `/uploads/${req.file.filename}` : null;
    const result = await db.query(
      `INSERT INTO dishes(name,description,price_cents,available_quantity,available_from_minutes,available_to_minutes,photo_url,is_active)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [name, description || null, Number.parseInt(price_cents, 10), Number.parseInt(available_quantity || '0', 10), Number.parseInt(available_from_minutes, 10), Number.parseInt(available_to_minutes, 10), photo_url, true]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: update dish
router.put('/:id', auth, isAdmin, upload.single('photo'), async (req, res) => {
  try {
    const id = req.params.id;
    const data = {};
    const fields = ['name','description','price_cents','available_quantity','available_from_minutes','available_to_minutes','is_active'];
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        data[f] = (f === 'price_cents' || f === 'available_quantity' || f === 'available_from_minutes' || f === 'available_to_minutes') ? Number.parseInt(req.body[f],10) : req.body[f];
      }
    }
    if (req.file) data.photo_url = `/uploads/${req.file.filename}`;
    if (Object.keys(data).length === 0) return res.status(400).json({ error: 'No fields to update' });
    const sets = [];
    const values = [];
    let idx = 1;
    for (const k of Object.keys(data)) {
      sets.push(`${k} = $${idx}`);
      values.push(data[k]);
      idx++;
    }
    values.push(id);
    const q = `UPDATE dishes SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`;
    const updated = await db.query(q, values);
    res.json(updated.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: soft-delete dish
router.delete('/:id', auth, isAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const updated = await db.query('UPDATE dishes SET is_active = false WHERE id = $1 RETURNING *', [id]);
    res.json({ success: true, dish: updated.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Public: list active dishes
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM dishes WHERE is_active = true');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Public: get dish by id
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM dishes WHERE id = $1', [req.params.id]);
    const dish = result.rows[0];
    if (!dish) return res.status(404).json({ error: 'Dish not found' });
    res.json(dish);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
