require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth.routes');
const vaultRoutes = require('./routes/vault.routes');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' })); // Allow larger payloads for vault blobs

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/vault', vaultRoutes);

app.get('/', (req, res) => {
  res.send('PassVault Backend Running');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
