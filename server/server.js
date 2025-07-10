require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const server = http.createServer(app);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:"],
      fontSrc: ["'self'"],
      connectSrc: ["'self'", "ws:", "wss:"],
      mediaSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable for Socket.IO compatibility
}));

// General rate limiting - TEMPORARILY DISABLED FOR ALPHA
// const generalLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 100, // limit each IP to 100 requests per windowMs
//   message: { error: 'Too many requests, please try again later' },
//   standardHeaders: true,
//   legacyHeaders: false,
// });

// app.use(generalLimiter);

// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL || 'https://yourdomain.com'
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

app.use(cors(corsOptions));

// Socket.IO with CORS
const io = socketIo(server, {
  cors: corsOptions,
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const inventoryRoutes = require('./routes/inventory');
const shopRoutes = require('./routes/shop');
const dextopRoutes = require('./routes/dextop');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/dextop', dextopRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Store connected users
const connectedUsers = new Map();

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Handle user joining
  socket.on('join', (userData) => {
    if (!userData || !userData.userId) {
      socket.emit('error', { message: 'Invalid user data' });
      return;
    }

    // Validate user data structure
    const user = {
      id: userData.userId,
      username: userData.username || 'Anonymous',
      position: userData.position || { x: 100, y: 100 },
      character: userData.character || {},
      socketId: socket.id,
      lastSeen: Date.now()
    };

    connectedUsers.set(socket.id, user);
    
    // Send current users to new user
    const users = Array.from(connectedUsers.values());
    socket.emit('users', users);
    
    // Broadcast new user to others
    socket.broadcast.emit('user-joined', user);
    
    console.log(`User ${user.username} joined`);
  });

  // Handle user movement
  socket.on('move', (moveData) => {
    const user = connectedUsers.get(socket.id);
    if (!user) return;

    // Validate movement data
    if (!moveData || typeof moveData.x !== 'number' || typeof moveData.y !== 'number') {
      return;
    }

    // Basic bounds checking (adjust as needed)
    const maxX = 2000;
    const maxY = 2000;
    const minX = 0;
    const minY = 0;

    moveData.x = Math.max(minX, Math.min(maxX, moveData.x));
    moveData.y = Math.max(minY, Math.min(maxY, moveData.y));

    user.position = { x: moveData.x, y: moveData.y };
    user.lastSeen = Date.now();
    
    // Broadcast to all other users
    socket.broadcast.emit('user-moved', {
      userId: user.id,
      position: user.position
    });
  });

  // Handle character updates
  socket.on('character-update', (characterData) => {
    const user = connectedUsers.get(socket.id);
    if (!user) return;

    // Validate character data
    if (!characterData || typeof characterData !== 'object') {
      return;
    }

    user.character = characterData;
    user.lastSeen = Date.now();
    
    // Broadcast to all other users
    socket.broadcast.emit('user-character-updated', {
      userId: user.id,
      character: user.character
    });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    const user = connectedUsers.get(socket.id);
    if (user) {
      connectedUsers.delete(socket.id);
      io.emit('user-left', user.id);
      console.log(`User ${user.username} disconnected`);
    }
  });

  // Handle errors
  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

// Cleanup inactive users periodically
setInterval(() => {
  const now = Date.now();
  const timeout = 5 * 60 * 1000; // 5 minutes

  for (const [socketId, user] of connectedUsers.entries()) {
    if (now - user.lastSeen > timeout) {
      connectedUsers.delete(socketId);
      io.emit('user-left', user.id);
      console.log(`Cleaned up inactive user: ${user.username}`);
    }
  }
}, 60000); // Check every minute

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = { app, server, io }; 