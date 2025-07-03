const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// Import database and auth
const { db } = require('./database');
const authService = require('./auth');

// Import routes
const authRoutes = require('./routes/auth');
const dextopRoutes = require('./routes/dextop');

const app = express();
const server = http.createServer(app);

// Allow CORS from the production front-end domain or localhost during dev.
const allowedOrigin = process.env.CLIENT_ORIGIN || '*';

const io = socketIo(server, {
  cors: {
    origin: allowedOrigin,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.use(cors({ origin: allowedOrigin }));
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/dextop', dextopRoutes);

// In-memory storage for active dextop sessions
const activeDextops = new Map(); // dextopId -> { visitors: Map<userId, playerData> }
const userSockets = new Map(); // userId -> socketId

// Legacy room system (for backward compatibility)
const rooms = new Map();

// Helper to create an empty desktop state
function createDesktopState() {
  return {
    openPrograms: {},
    highestZIndex: 100,
    backgroundId: 'sandstone',
  };
}

// Helper function to get player quadrant based on join order
function getPlayerQuadrant(room) {
  const playerCount = Object.keys(room.players).length;
  return playerCount; // 0=top-left, 1=top-right, 2=bottom-left, 3=bottom-right
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Add heartbeat handler
  socket.on('heartbeat', () => {
    // Update last seen time for this socket
    for (const [roomId, room] of rooms.entries()) {
      if (room.players[socket.id]) {
        room.players[socket.id].lastSeen = Date.now();
        break;
      }
    }
  });

  socket.on('createRoom', ({ username }) => {
    const roomId = uuidv4().substring(0, 8); // Short room ID
    const playerId = socket.id;
    const quadrant = 0; // First player gets top-left

    const room = {
      id: roomId,
      players: {
        [playerId]: {
          id: playerId,
          username,
          quadrant,
          position: { x: 100, y: 100 },
          isMoving: false,
          movementDirection: null,
          walkFrame: 1,
          facingDirection: 'left',
          isGaming: false,
          gamingInputDirection: null,
          appearance: { hue: 0, eyes: 'none', ears: 'none', fluff: 'none', tail: 'none', body: 'CustomBase' },
          lastSeen: Date.now(),
        }
      },
      maxPlayers: 4,
      desktop: createDesktopState(),
    };

    rooms.set(roomId, room);
    socket.join(roomId);

    socket.emit('roomJoined', { roomId, playerId, username, quadrant });
    socket.emit('playersUpdate', room.players);
    socket.emit('desktopState', room.desktop);

    console.log(`Room ${roomId} created by ${username}`);
  });

  socket.on('joinRoom', ({ roomId, username }) => {
    const room = rooms.get(roomId);
    const playerId = socket.id;

    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    if (Object.keys(room.players).length >= room.maxPlayers) {
      socket.emit('error', { message: 'Room is full' });
      return;
    }

    const quadrant = getPlayerQuadrant(room);
    
    room.players[playerId] = {
      id: playerId,
      username,
      quadrant,
      position: { x: 100, y: 100 },
      isMoving: false,
      movementDirection: null,
      walkFrame: 1,
      facingDirection: 'left',
      isGaming: false,
      gamingInputDirection: null,
      appearance: { hue: 0, eyes: 'none', ears: 'none', fluff: 'none', tail: 'none', body: 'CustomBase' },
      lastSeen: Date.now(),
    };

    socket.join(roomId);
    socket.emit('roomJoined', { roomId, playerId, username, quadrant });
    socket.emit('desktopState', room.desktop);
    
    // Update all players in the room
    io.to(roomId).emit('playersUpdate', room.players);

    console.log(`${username} joined room ${roomId}`);
  });

  socket.on('playerMove', (data) => {
    const { position, isMoving, movementDirection, walkFrame, facingDirection, isGrabbing, isResizing, timestamp } = data;
    // Find the room this player is in
    for (const [roomId, room] of rooms.entries()) {
      if (room.players[socket.id]) {
        room.players[socket.id].position = position;
        room.players[socket.id].isMoving = isMoving;
        room.players[socket.id].movementDirection = movementDirection;
        room.players[socket.id].walkFrame = walkFrame;
        room.players[socket.id].facingDirection = facingDirection;
        room.players[socket.id].isGrabbing = isGrabbing;
        room.players[socket.id].isResizing = isResizing;
        room.players[socket.id].lastSeen = Date.now();
        
        // Broadcast the movement to other players in the room
        socket.to(roomId).emit('playerMoved', {
          playerId: socket.id,
          position,
          isMoving,
          movementDirection,
          walkFrame,
          facingDirection,
          isGrabbing,
          isResizing,
          timestamp,
        });
        break;
      }
    }
  });

  socket.on('desktopStateUpdate', ({ roomId, desktopState }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    room.desktop = desktopState;
    // Broadcast to all other clients in the room
    socket.to(roomId).emit('desktopState', desktopState);
  });

  socket.on('playerStateUpdate', ({ roomId, playerId, isGaming, gamingInputDirection }) => {
    const room = rooms.get(roomId);
    if (!room || !room.players[playerId]) return;
    room.players[playerId].isGaming = isGaming;
    room.players[playerId].gamingInputDirection = gamingInputDirection;
    // Broadcast updated players list
    io.to(roomId).emit('playersUpdate', room.players);
  });

  // Receive appearance updates
  socket.on('appearanceUpdate', ({ roomId, playerId, appearance }) => {
    const room = rooms.get(roomId);
    if (!room || !room.players[playerId]) return;
    room.players[playerId].appearance = appearance;
    io.to(roomId).emit('playersUpdate', room.players);
  });

  // New dextop-based socket handlers
  socket.on('joinDextop', async ({ token, dextopId }) => {
    try {
      // Verify user token
      const decoded = authService.verifyJWT(token);
      if (!decoded) {
        socket.emit('error', { message: 'Invalid token' });
        return;
      }

      // Get user from database
      const user = await db.findUserById(decoded.userId);
      if (!user) {
        socket.emit('error', { message: 'User not found' });
        return;
      }

      // Get dextop and avatar
      const dextop = await db.getUserDextop(user.id);
      
      const targetDextopId = dextopId || dextop.id; // Use provided dextop or user's own
      
      // Initialize active dextop if needed
      if (!activeDextops.has(targetDextopId)) {
        activeDextops.set(targetDextopId, { visitors: new Map() });
      }

      const dextopSession = activeDextops.get(targetDextopId);
      
      // Create player data
      const playerData = {
        id: user.id,
        username: user.username,
        position: { x: 200, y: 200 },
        isMoving: false,
        movementDirection: null,
        walkFrame: 1,
        facingDirection: 'left',
        isGaming: false,
        gamingInputDirection: null,
        appearance: {
          hue: dextop.hue || 0,
          eyes: dextop.eyes || 'none',
          ears: dextop.ears || 'none',
          fluff: dextop.fluff || 'none',
          tail: dextop.tail || 'none',
          body: dextop.body || 'CustomBase'
        },
        lastSeen: Date.now(),
        socketId: socket.id
      };

      // Add player to dextop session
      dextopSession.visitors.set(user.id, playerData);
      userSockets.set(user.id, socket.id);
      
      // Join socket room
      socket.join(targetDextopId);
      
      // Send success response
      socket.emit('dextopJoined', { 
        dextopId: targetDextopId, 
        userId: user.id, 
        username: user.username 
      });

      // Send current visitors to new player
      const visitors = Array.from(dextopSession.visitors.values());
      socket.emit('visitorsUpdate', visitors);
      
      // Notify other visitors
      socket.to(targetDextopId).emit('visitorJoined', playerData);

      // Record visit if not owner
      if (dextopId && dextopId !== dextop.id) {
        await db.recordDextopVisit(targetDextopId, user.id);
      }

      console.log(`${user.username} joined dextop ${targetDextopId}`);
    } catch (error) {
      console.error('Error joining dextop:', error);
      socket.emit('error', { message: 'Failed to join dextop' });
    }
  });

  socket.on('dextopPlayerMove', (data) => {
    // Find which dextop this socket is in
    for (const [dextopId, session] of activeDextops.entries()) {
      for (const [userId, player] of session.visitors.entries()) {
        if (player.socketId === socket.id) {
          // Update player data
          Object.assign(player, {
            position: data.position,
            isMoving: data.isMoving,
            movementDirection: data.movementDirection,
            walkFrame: data.walkFrame,
            facingDirection: data.facingDirection,
            isGrabbing: data.isGrabbing,
            isResizing: data.isResizing,
            lastSeen: Date.now()
          });
          
          // Broadcast to other visitors in the same dextop
          socket.to(dextopId).emit('visitorMoved', {
            userId,
            ...data,
            timestamp: Date.now()
          });
          return;
        }
      }
    }
  });

  socket.on('dextopStateUpdate', ({ dextopId, desktopState }) => {
    // Broadcast desktop state to all visitors of this dextop
    socket.to(dextopId).emit('dextopState', desktopState);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Remove from dextop sessions
    for (const [dextopId, session] of activeDextops.entries()) {
      for (const [userId, player] of session.visitors.entries()) {
        if (player.socketId === socket.id) {
          session.visitors.delete(userId);
          userSockets.delete(userId);
          
          // Notify remaining visitors
          socket.to(dextopId).emit('visitorLeft', { userId });
          
          // Clean up empty dextop sessions
          if (session.visitors.size === 0) {
            activeDextops.delete(dextopId);
          }
          
          console.log(`User ${userId} left dextop ${dextopId}`);
          break;
        }
      }
    }
    
    // Legacy room cleanup
    for (const [roomId, room] of rooms.entries()) {
      if (room.players[socket.id]) {
        delete room.players[socket.id];
        
        // If room is empty, delete it
        if (Object.keys(room.players).length === 0) {
          rooms.delete(roomId);
          console.log(`Room ${roomId} deleted (empty)`);
        } else {
          // Update remaining players
          io.to(roomId).emit('playersUpdate', room.players);
        }
        break;
      }
    }
  });
});

// Add cleanup interval for stale player states
setInterval(() => {
  const now = Date.now();
  const STALE_THRESHOLD = 30000; // 30 seconds without update = stale
  
  for (const [roomId, room] of rooms.entries()) {
    let roomChanged = false;
    
    for (const [playerId, player] of Object.entries(room.players)) {
      const timeSinceLastSeen = now - (player.lastSeen || now);
      
      // If player hasn't been seen in a while and appears to be moving, reset their state
      if (timeSinceLastSeen > STALE_THRESHOLD && player.isMoving) {
        console.log(`Resetting stale player state for ${playerId} in room ${roomId}`);
        player.isMoving = false;
        player.movementDirection = null;
        player.walkFrame = 1;
        roomChanged = true;
      }
    }
    
    // If any player states were changed, broadcast the update
    if (roomChanged) {
      io.to(roomId).emit('playersUpdate', room.players);
    }
  }
}, 15000); // Check every 15 seconds

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 