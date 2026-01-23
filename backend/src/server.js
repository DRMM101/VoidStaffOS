const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./routes/auth');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100
});
app.use(limiter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Void Staff OS API is running' });
});

app.get('/api/db-test', async (req, res) => {
  const pool = require('./config/database');
  try {
    const result = await pool.query('SELECT COUNT(*) FROM roles');
    res.json({
      status: 'ok',
      message: 'Database connected',
      roles_count: result.rows[0].count
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

app.use('/api/auth', authRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
  console.log('Health check: http://localhost:' + PORT + '/api/health');
  console.log('DB test: http://localhost:' + PORT + '/api/db-test');
});