const express = require('express');
// const rateLimit = require('express-rate-limit');
const router = express.Router();
const authService = require('../auth');

// Rate limiting for auth endpoints - TEMPORARILY DISABLED
// const authLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 10, // limit each IP to 10 requests per windowMs
//   message: { error: 'Too many authentication attempts, please try again later' },
//   standardHeaders: true,
//   legacyHeaders: false,
// });

// Stricter rate limiting for login attempts - TEMPORARILY DISABLED
// const loginLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 5, // limit each IP to 5 login attempts per windowMs
//   message: { error: 'Too many login attempts, please try again later' },
//   standardHeaders: true,
//   legacyHeaders: false,
// });

// Input validation helpers - MADE LESS STRICT
const validateUsername = (username) => {
  if (!username || typeof username !== 'string') return 'Username is required';
  const trimmed = username.trim();
  if (trimmed.length < 1) return 'Username is required';
  if (trimmed.length > 50) return 'Username is too long';
  return null;
};

const validateEmail = (email) => {
  if (!email || typeof email !== 'string') return 'Email is required';
  const trimmed = email.trim();
  if (trimmed.length > 254) return 'Email is too long';
  if (!trimmed.includes('@')) return 'Please enter a valid email address';
  return null;
};

const validatePassword = (password) => {
  if (!password || typeof password !== 'string') return 'Password is required';
  if (password.length < 1) return 'Password is required';
  if (password.length > 128) return 'Password is too long';
  return null;
};

// Create guest account
router.post('/guest', async (req, res) => {
  try {
    const { username } = req.body;
    
    const usernameError = validateUsername(username);
    if (usernameError) {
      return res.status(400).json({ error: usernameError });
    }

    const result = await authService.createGuestUser(username.trim());
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Guest creation error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Register new account
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    const usernameError = validateUsername(username);
    if (usernameError) {
      return res.status(400).json({ error: usernameError });
    }
    
    const emailError = validateEmail(email);
    if (emailError) {
      return res.status(400).json({ error: emailError });
    }
    
    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const result = await authService.register(username.trim(), email.trim(), password);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const emailError = validateEmail(email);
    if (emailError) {
      return res.status(400).json({ error: emailError });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const result = await authService.login(email.trim(), password);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Resume guest session
router.post('/guest-resume', async (req, res) => {
  try {
    const { guestToken } = req.body;
    
    if (!guestToken || typeof guestToken !== 'string') {
      return res.status(400).json({ error: 'Guest token required' });
    }

    const result = await authService.resumeGuestSession(guestToken);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Guest resume error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Migrate guest to registered account
router.post('/migrate', async (req, res) => {
  try {
    const { guestToken, username, email, password } = req.body;
    
    if (!guestToken || typeof guestToken !== 'string') {
      return res.status(400).json({ error: 'Guest token required' });
    }
    
    const usernameError = validateUsername(username);
    if (usernameError) {
      return res.status(400).json({ error: usernameError });
    }
    
    const emailError = validateEmail(email);
    if (emailError) {
      return res.status(400).json({ error: emailError });
    }
    
    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const result = await authService.migrateGuestToAccount(
      guestToken, 
      username.trim(), 
      email.trim(), 
      password
    );
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Verify token (for client-side token validation)
router.get('/verify', authService.authenticateToken, (req, res) => {
  res.json({ 
    valid: true, 
    user: {
      userId: req.user.userId,
      username: req.user.username,
      userType: req.user.userType
    }
  });
});

module.exports = router; 