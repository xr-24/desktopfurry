const express = require('express');
const router = express.Router();
const authService = require('../auth');

// Create guest account
router.post('/guest', async (req, res) => {
  try {
    const { username } = req.body;
    
    if (!username || username.trim().length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
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
    
    // Validation
    if (!username || username.trim().length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }
    
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email required' });
    }
    
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
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
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
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
    
    if (!guestToken) {
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
    
    if (!guestToken) {
      return res.status(400).json({ error: 'Guest token required' });
    }
    
    // Validation
    if (!username || username.trim().length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }
    
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email required' });
    }
    
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
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