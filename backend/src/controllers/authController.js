const bcrypt = require('bcrypt');
const User = require('../models/User');
const { generateToken } = require('../utils/jwt');

async function register(req, res) {
  try {
    const { email, password, full_name, role_id } = req.body;

    if (!email || !password || !full_name || !role_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const user = await User.create({ email, password, full_name, role_id });

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role_id: user.role_id
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.employment_status !== 'active') {
      return res.status(401).json({ error: 'Account is inactive' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken({
      id: user.id,
      role_id: user.role_id,
      role_name: user.role_name
    });

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role_name: user.role_name
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
}

async function getMe(req, res) {
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      full_name: req.user.full_name,
      role_id: req.user.role_id,
      role_name: req.user.role_name,
      employment_status: req.user.employment_status,
      start_date: req.user.start_date
    }
  });
}

module.exports = {
  register,
  login,
  getMe
};
