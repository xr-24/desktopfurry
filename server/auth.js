const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { db } = require('./database');

// Ensure JWT_SECRET is set - exit if not
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is required');
  process.exit(1);
}

const JWT_SECRET = process.env.JWT_SECRET;
const SALT_ROUNDS = 12;

// Guest token expiration (30 days - extended for alpha)
const GUEST_TOKEN_EXPIRY_DAYS = 30;

class AuthService {
  constructor() {
    // Ensure that instance methods used as Express middleware retain the correct `this` context.
    this.authenticateToken = this.authenticateToken.bind(this);
  }

  // Generate a secure guest token with expiration
  generateGuestToken() {
    const expiry = Date.now() + (GUEST_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    return uuidv4() + '-' + expiry;
  }

  // Check if guest token is expired
  isGuestTokenExpired(guestToken) {
    if (!guestToken || !guestToken.includes('-')) return true;
    const parts = guestToken.split('-');
    const expiry = parseInt(parts[parts.length - 1]);
    return Date.now() > expiry;
  }

  // Generate JWT token with longer expiration for alpha
  generateJWT(user) {
    return jwt.sign(
      { 
        userId: user.id, 
        username: user.username, 
        userType: user.user_type 
      },
      JWT_SECRET,
      { expiresIn: '30d' } // Back to 30 days for alpha testing
    );
  }

  // Verify JWT token
  verifyJWT(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return null;
    }
  }

  // Create guest user
  async createGuestUser(username) {
    try {
      const guestToken = this.generateGuestToken();
      const user = await db.createUser(username, null, null, guestToken);
      
      // Unlock welcome achievement
      await db.unlockAchievement(user.id, 'WELCOME');
      
      const token = this.generateJWT(user);
      
      return {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          userType: user.user_type,
          guestToken: user.guest_token
        },
        token
      };
    } catch (error) {
      console.error('Error creating guest user:', error);
      return {
        success: false,
        error: error.code === '23505' ? 'Username already taken' : 'Failed to create user'
      };
    }
  }

  // Register new account
  async register(username, email, password) {
    try {
      // Check if email already exists
      const existingUser = await db.findUserByEmail(email);
      if (existingUser) {
        return { success: false, error: 'Email already registered' };
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      
      // Create user
      const user = await db.createUser(username, email, passwordHash);
      
      // Unlock achievements
      await db.unlockAchievement(user.id, 'WELCOME');
      await db.unlockAchievement(user.id, 'PERSISTENT_USER');
      
      const token = this.generateJWT(user);
      
      return {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          userType: user.user_type
        },
        token
      };
    } catch (error) {
      console.error('Error registering user:', error);
      return {
        success: false,
        error: error.code === '23505' ? 'Username or email already taken' : 'Registration failed'
      };
    }
  }

  // Login existing user
  async login(email, password) {
    try {
      const user = await db.findUserByEmail(email);
      if (!user || !user.password_hash) {
        return { success: false, error: 'Invalid email or password' };
      }

      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        return { success: false, error: 'Invalid email or password' };
      }

      // Update last active
      await db.updateUserLastActive(user.id);
      
      const token = this.generateJWT(user);
      
      return {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          userType: user.user_type
        },
        token
      };
    } catch (error) {
      console.error('Error logging in user:', error);
      return { success: false, error: 'Login failed' };
    }
  }

  // Migrate guest to registered account
  async migrateGuestToAccount(guestToken, username, email, password) {
    try {
      // Find guest user
      const guestUser = await db.findUserByGuestToken(guestToken);
      if (!guestUser) {
        return { success: false, error: 'Guest account not found' };
      }

      // Check if email already exists
      const existingUser = await db.findUserByEmail(email);
      if (existingUser) {
        return { success: false, error: 'Email already registered' };
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      
      // Update guest user to registered user
      await db.query(`
        UPDATE users 
        SET username = $1, email = $2, password_hash = $3, user_type = 'registered', guest_token = NULL
        WHERE id = $4
      `, [username, email, passwordHash, guestUser.id]);

      // Unlock persistent user achievement
      await db.unlockAchievement(guestUser.id, 'PERSISTENT_USER');
      
      const updatedUser = await db.findUserById(guestUser.id);
      const token = this.generateJWT(updatedUser);
      
      return {
        success: true,
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          email: updatedUser.email,
          userType: updatedUser.user_type
        },
        token
      };
    } catch (error) {
      console.error('Error migrating guest account:', error);
      return { success: false, error: 'Migration failed' };
    }
  }

  // Resume guest session
  async resumeGuestSession(guestToken) {
    try {
      // Check if token is expired
      if (this.isGuestTokenExpired(guestToken)) {
        return { success: false, error: 'Guest session expired' };
      }

      const user = await db.findUserByGuestToken(guestToken);
      if (!user) {
        return { success: false, error: 'Guest session not found' };
      }

      await db.updateUserLastActive(user.id);
      
      const token = this.generateJWT(user);
      
      return {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          userType: user.user_type,
          guestToken: user.guest_token
        },
        token
      };
    } catch (error) {
      console.error('Error resuming guest session:', error);
      return { success: false, error: 'Failed to resume session' };
    }
  }

  // Middleware to authenticate requests
  async authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = this.verifyJWT(token);
    if (!decoded) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    // Add user info to request
    req.user = decoded;
    next();
  }
}

module.exports = new AuthService(); 