const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');

// Create order (requires auth)
router.post('/', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { items, pickup_time } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Items required' });
    if (!pickup_time) return res.status(400).json({ error: 'pickup_time required' });
    const pickupDate = new Date(pickup_time);
    if (Number.isNaN(pickupDate.getTime())) return res.status(400).json({ error: 'Invalid pickup_time' });
    // enforce minimum 30-minute lead time
    const minAllowed = Date.now() + 30 * 60 * 1000;
    if (pickupDate.getTime() < minAllowed) return res.status(400).json({ error: 'Pickup time must be at least 30 minutes from now' });
    // enforce same-day pickup only
    const now = new Date();
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    if (pickupDate.getTime() > endOfToday.getTime()) return res.status(400).json({ error: 'Pickup time must be today. Pre-orders for future days are not allowed.' });

    // Validate dishes and calculate total
    let totalCents = 0;
    const checks = [];
    const pickupMinutes = pickupDate.getUTCHours() * 60 + pickupDate.getUTCMinutes();

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      for (const it of items) {
        if (!it.dishId || !it.quantity) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Each item requires dishId and quantity' });
        }
        const dishRes = await client.query('SELECT id,name,price_cents,available_quantity,available_from_minutes,available_to_minutes,is_active FROM dishes WHERE id = $1 FOR UPDATE', [it.dishId]);
        const dish = dishRes.rows[0];
        if (!dish?.is_active) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: `Dish not available: ${it.dishId}` });
        }
        if (dish.available_quantity < it.quantity) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: `Insufficient quantity for ${dish.name}` });
        }
        if (!(dish.available_from_minutes <= pickupMinutes && pickupMinutes < dish.available_to_minutes)) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: `Dish ${dish.name} not available at selected pickup time` });
        }
        totalCents += dish.price_cents * it.quantity;
        checks.push({ dish, quantity: it.quantity });
      }

      // Decrement quantities
      for (const c of checks) {
        const upd = await client.query('UPDATE dishes SET available_quantity = available_quantity - $1 WHERE id = $2 AND available_quantity >= $1', [c.quantity, c.dish.id]);
        if (upd.rowCount === 0) {
          throw new Error(`Insufficient quantity for ${c.dish.name}`);
        }
      }

      // Generate order number using DB function
      const seqRes = await client.query("SELECT next_order_number() as order_number");
      const orderNumber = seqRes.rows[0]?.order_number ?? null;

      const createdRes = await client.query(
        `INSERT INTO orders(order_number,user_id,pickup_time,total_cents,payment_status,status)
         VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
        [orderNumber, userId, pickupDate.toISOString(), totalCents, 'PENDING', 'PENDING']
      );
      const created = createdRes.rows[0];

      for (const c of checks) {
        await client.query(
          `INSERT INTO order_items(order_id,dish_id,dish_name,unit_price_cents,quantity)
           VALUES($1,$2,$3,$4,$5)`,
          [created.id, c.dish.id, c.dish.name, c.dish.price_cents, c.quantity]
        );
      }

      await client.query('COMMIT');
      res.json({ order: created });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(err);
      res.status(500).json({ error: err.message || 'Server error' });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// List my orders
router.get('/', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT o.*, json_agg(json_build_object(
         'id', oi.id, 'dish_id', oi.dish_id, 'dish_name', oi.dish_name,
         'unit_price_cents', oi.unit_price_cents, 'quantity', oi.quantity
       )) AS items
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       WHERE o.user_id = $1
       GROUP BY o.id
       ORDER BY o.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get my order by id
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT o.*, json_agg(json_build_object(
         'id', oi.id, 'dish_id', oi.dish_id, 'dish_name', oi.dish_name,
         'unit_price_cents', oi.unit_price_cents, 'quantity', oi.quantity
       )) AS items
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       WHERE o.id = $1 AND o.user_id = $2
       GROUP BY o.id`,
      [req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Order not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: list all orders
router.get('/admin/all', auth, isAdmin, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT o.*, u.email AS user_email, u.name AS user_name, u.phone AS user_phone,
       json_agg(json_build_object(
         'id', oi.id, 'dish_id', oi.dish_id, 'dish_name', oi.dish_name,
         'unit_price_cents', oi.unit_price_cents, 'quantity', oi.quantity
       )) AS items
       FROM orders o
       JOIN users u ON u.id = o.user_id
       LEFT JOIN order_items oi ON oi.order_id = o.id
       GROUP BY o.id, u.email, u.name, u.phone
       ORDER BY o.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: revenue analytics
router.get('/admin/revenue', auth, isAdmin, async (req, res) => {
  try {
    const [summaryRes, dailyRes, dishesRes, paymentRes] = await Promise.all([
      db.query(`
        SELECT
          COALESCE(SUM(CASE WHEN payment_status = 'PAID' THEN total_cents END), 0)::int AS total_revenue_cents,
          COUNT(*)::int AS total_orders,
          COUNT(CASE WHEN payment_status = 'PAID' THEN 1 END)::int AS paid_orders,
          COUNT(CASE WHEN payment_status = 'PENDING' THEN 1 END)::int AS pending_payment_orders,
          COUNT(CASE WHEN status = 'PENDING' THEN 1 END)::int AS pending_orders,
          COUNT(CASE WHEN status = 'FINISHED' THEN 1 END)::int AS finished_orders,
          COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END)::int AS cancelled_orders,
          COALESCE(ROUND(AVG(CASE WHEN payment_status = 'PAID' THEN total_cents END)), 0)::int AS avg_order_cents,
          COALESCE(SUM(CASE WHEN payment_status = 'PAID' AND DATE(created_at AT TIME ZONE 'UTC') = CURRENT_DATE THEN total_cents END), 0)::int AS today_revenue_cents
        FROM orders
      `),
      db.query(`
        SELECT
          TO_CHAR(DATE(created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
          COUNT(*)::int AS orders,
          COALESCE(SUM(CASE WHEN payment_status = 'PAID' THEN total_cents END), 0)::int AS revenue_cents
        FROM orders
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY day
        ORDER BY day ASC
      `),
      db.query(`
        SELECT
          oi.dish_name,
          SUM(oi.quantity)::int AS total_qty,
          SUM(oi.unit_price_cents * oi.quantity)::int AS revenue_cents
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE o.payment_status = 'PAID'
        GROUP BY oi.dish_name
        ORDER BY revenue_cents DESC
        LIMIT 10
      `),
      db.query(`
        SELECT
          COALESCE(payment_method, 'Not specified') AS method,
          COUNT(*)::int AS orders,
          COALESCE(SUM(CASE WHEN payment_status = 'PAID' THEN total_cents END), 0)::int AS revenue_cents
        FROM orders
        GROUP BY method
        ORDER BY revenue_cents DESC
      `),
    ]);

    res.json({
      summary: summaryRes.rows[0],
      daily: dailyRes.rows,
      top_dishes: dishesRes.rows,
      payment_methods: paymentRes.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: update order status
router.patch('/:id/status', auth, isAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['PENDING', 'FINISHED', 'CANCELLED'];
    if (!status || !allowed.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });
    }

    const result = await db.query(
      'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Order not found' });

    // If cancelled, restore dish quantities
    if (status === 'CANCELLED') {
      const items = await db.query('SELECT dish_id, quantity FROM order_items WHERE order_id = $1', [req.params.id]);
      for (const it of items.rows) {
        if (it.dish_id) {
          await db.query('UPDATE dishes SET available_quantity = available_quantity + $1 WHERE id = $2', [it.quantity, it.dish_id]);
        }
      }
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: update payment status
router.patch('/:id/payment', auth, isAdmin, async (req, res) => {
  try {
    const { payment_status, payment_method } = req.body;
    const allowed = ['PENDING', 'PAID'];
    if (!payment_status || !allowed.includes(payment_status)) {
      return res.status(400).json({ error: `payment_status must be one of: ${allowed.join(', ')}` });
    }
    const paymentDate = payment_status === 'PAID' ? new Date().toISOString() : null;
    const result = await db.query(
      'UPDATE orders SET payment_status = $1, payment_method = $2, payment_date = $3 WHERE id = $4 RETURNING *',
      [payment_status, payment_method || null, paymentDate, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Order not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
