const express = require('express');
const pool = require('../config/db');
const auth = require('../middleware/auth.middleware');
const router = express.Router();

// SYNC (TWO-WAY)
router.post('/sync', auth, async (req, res) => {
  const { encryptedBlob, lastModified } = req.body; // lastModified is ISO timestamp or Unix timestamp in ms
  
  if (encryptedBlob === undefined || lastModified === undefined) {
    return res.status(400).json({ message: 'Missing fields' });
  }

  // Convert to Date object for comparison
  const clientTimestamp = new Date(lastModified);

  const client = await pool.pool.connect();

  try {
    await client.query('BEGIN');

    // Get current vault state
    const currentRes = await client.query(
      'SELECT encrypted_blob, updated_at FROM vaults WHERE user_id = $1 FOR UPDATE',
      [req.user.user_id]
    );

    let serverTimestamp = null;
    if (currentRes.rows.length > 0) {
      serverTimestamp = new Date(currentRes.rows[0].updated_at);
    }

    // Two-way sync logic based on timestamps:
    // 1. If client timestamp > server timestamp: Server updates with client data
    // 2. If server timestamp > client timestamp: Return server data to client
    // 3. If timestamps are equal: No update needed

    if (!serverTimestamp || clientTimestamp > serverTimestamp) {
      // Client has newer data - Update server
      const query = `
        INSERT INTO vaults (user_id, encrypted_blob, last_updated_by_device_id, updated_at)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id)
        DO UPDATE SET
          encrypted_blob = EXCLUDED.encrypted_blob,
          last_updated_by_device_id = EXCLUDED.last_updated_by_device_id,
          updated_at = EXCLUDED.updated_at
      `;
      
      await client.query(query, [
        req.user.user_id, 
        Buffer.from(encryptedBlob), 
        req.user.device_id,
        clientTimestamp
      ]);

      await client.query('COMMIT');
      return res.json({ success: true, action: 'updated', lastModified: clientTimestamp.toISOString() });

    } else if (clientTimestamp < serverTimestamp) {
      // Server has newer data - Return server data to client
      await client.query('COMMIT');
      return res.json({ 
        success: true, 
        action: 'pull_required',
        encrypted_blob: currentRes.rows[0].encrypted_blob, 
        lastModified: serverTimestamp.toISOString()
      });

    } else {
      // Timestamps are equal - Already in sync
      await client.query('COMMIT');
      return res.json({ success: true, action: 'up_to_date', lastModified: serverTimestamp.toISOString() });
    }

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});

// PULL
router.get('/pull', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT encrypted_blob, updated_at FROM vaults WHERE user_id = $1',
      [req.user.user_id]
    );

    if (result.rows.length === 0) {
        // No vault yet, return empty/null
      return res.json({ encrypted_blob: null, lastModified: null });
    }

    const row = result.rows[0];
    // encrypted_blob returned by pg is a Buffer. 
    // We send it back as JSON (which turns Buffer into {type:'Buffer', data:[...]}).
    // Client needs to handle this.
    res.json({ 
      encrypted_blob: row.encrypted_blob, 
      lastModified: row.updated_at.toISOString() 
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
