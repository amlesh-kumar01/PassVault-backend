const express = require('express');
const pool = require('../config/db');
const auth = require('../middleware/auth.middleware');
const router = express.Router();

// SYNC (PUSH)
router.post('/sync', auth, async (req, res) => {
  const { encryptedBlob, version } = req.body; // encryptedBlob is expected to be a buffer-like array or hex string from JSON? 
  // Postgres BYTEA accepts hex format (starting with \x) or base64? 
  // Let's assume the client sends it as a regular JSON array or base64 string.
  // Actually, for simplicity with node-postgres, passing a Buffer object or bytea hex string works.
  // If `encryptedBlob` comes as {0: 23, 1: ...} (JSON object of array), we need to handle it.
  // Best to expect Base64 string or convert client-side. 
  // For this implementation, let's assume the body has standard JSON fields.
  

  if (encryptedBlob === undefined || version === undefined) {
    return res.status(400).json({ message: 'Missing fields' });
  }

  const client = await pool.pool.connect();

  try {
    await client.query('BEGIN');

    // Get current vault state
    const currentRes = await client.query(
      'SELECT version FROM vaults WHERE user_id = $1 FOR UPDATE',
      [req.user.user_id]
    );

    let currentVersion = 0;
    if (currentRes.rows.length > 0) {
      currentVersion = currentRes.rows[0].version;
    }

    // Conflict Logic
    // If incoming > current OR current is null (0), Update.
    // If incoming <= current, Conflict.

    if (version > currentVersion || currentRes.rows.length === 0) {
      // Update or Insert
      const query = `
        INSERT INTO vaults (user_id, encrypted_blob, version, last_updated_by_device_id)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id)
        DO UPDATE SET
          encrypted_blob = EXCLUDED.encrypted_blob,
          version = EXCLUDED.version,
          last_updated_by_device_id = EXCLUDED.last_updated_by_device_id,
          updated_at = CURRENT_TIMESTAMP
      `;
      
      // We need to ensure encryptedBlob is in a format Postgres accepts for BYTEA. 
      // If it comes as an array of numbers (from Uint8Array JSON.stringify), we can Buffer.from(encryptedBlob).
      // We'll rely on the controller to receive it correctly.
      
      await client.query(query, [
        req.user.user_id, 
        Buffer.from(encryptedBlob), 
        version, 
        req.user.device_id
      ]);

      await client.query('COMMIT');
      return res.json({ success: true, newVersion: version });

    } else {
      // Conflict
      await client.query('ROLLBACK');
      return res.status(409).json({ code: 'CONFLICT', serverVersion: currentVersion });
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
      'SELECT encrypted_blob, version FROM vaults WHERE user_id = $1',
      [req.user.user_id]
    );

    if (result.rows.length === 0) {
        // No vault yet, return empty/null
      return res.json({ encrypted_blob: null, version: 0 });
    }

    const row = result.rows[0];
    // encrypted_blob returned by pg is a Buffer. 
    // We send it back as JSON (which turns Buffer into {type:'Buffer', data:[...]}).
    // Client needs to handle this.
    res.json({ encrypted_blob: row.encrypted_blob, version: row.version });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
