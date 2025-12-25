const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const router = express.Router();

// Helper to generate JWT
const generateToken = (user_id, device_id) => {
  return jwt.sign(
    { user_id, device_id },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
};

// REGISTER
router.post('/register', async (req, res) => {
  const { email, password, device_name } = req.body;

  if (!email || !password || !device_name) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  const client = await pool.pool.connect();

  try {
    await client.query('BEGIN');

    // Check if user exists
    const userResult = await client.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userResult.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'User already exists' });
    }

    // Hash password (salt embedded)
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Create User
    const newUserRes = await client.query(
      'INSERT INTO users (email, password_hash, salt) VALUES ($1, $2, $3) RETURNING id',
      [email, password_hash, salt]
    );
    const user_id = newUserRes.rows[0].id;

    // Create Device
    const newDeviceRes = await client.query(
      'INSERT INTO devices (user_id, device_name) VALUES ($1, $2) RETURNING id',
      [user_id, device_name]
    );
    const device_id = newDeviceRes.rows[0].id;

    await client.query('COMMIT');

    const token = generateToken(user_id, device_id);
    res.status(201).json({ token, user_id, device_id });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});

// LOGIN
router.post('/login', async (req, res) => {
  const { email, password, device_name } = req.body;

  if (!email || !password || !device_name) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  const client = await pool.pool.connect();

  try {
    await client.query('BEGIN');

    // Find User
    const userResult = await client.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const user = userResult.rows[0];

    // Verify Password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      await client.query('ROLLBACK');
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Register Device (if new) or Get Existing
    let device_id;
    // For simplicity, we just create a new device entry or find one with same name?
    // Prompt says: "Register new device (if needed)"
    // Let's check if this device name exists for this user.
    const deviceRes = await client.query(
      'SELECT id FROM devices WHERE user_id = $1 AND device_name = $2',
      [user.id, device_name]
    );

    if (deviceRes.rows.length > 0) {
      device_id = deviceRes.rows[0].id;
    } else {
      const newDeviceRes = await client.query(
        'INSERT INTO devices (user_id, device_name) VALUES ($1, $2) RETURNING id',
        [user.id, device_name]
      );
      device_id = newDeviceRes.rows[0].id;
    }

    await client.query('COMMIT');

    const token = generateToken(user.id, device_id);
    res.json({ token, user_id: user.id, device_id });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
