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
const usersRoutes = require('./routes/users');

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
app.use('/api/users', usersRoutes);

// In-memory storage for active dextop sessions
const activeDextops = new Map(); // dextopId -> { visitors: Map<userId, playerData> }
const userSockets = new Map(); // userId -> socketId
const userFriends = new Map(); // userId -> Set<friendId>
const userFriendRequests = new Map(); // userId -> Set<requestId>
const onlineUsers = new Map(); // userId -> { socketId, currentDextop }

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

      // Patch handshake so future handlers can access the token
      socket.handshake.auth = socket.handshake.auth || {};
      socket.handshake.auth.token = token;

      // Get user from database
      const user = await db.findUserById(decoded.userId);
      if (!user) {
        socket.emit('error', { message: 'User not found' });
        return;
      }

      // Get dextop and avatar
      const dextop = await db.getUserDextop(user.id);
      
      const inputId = dextopId || dextop.id;
      let targetDextopId = inputId;

      // Allow short codes (userId) as dextop identifiers
      if (inputId && inputId.length !== 36) {
        try {
          const ownerDextop = await db.getUserDextop(inputId);
          if (ownerDextop) {
            targetDextopId = ownerDextop.id;
          }
        } catch (err) {
          console.error('Failed to translate dextop code', inputId, err);
        }
      }
      
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

      // Update onlineUsers entry with current dextop id
      if (onlineUsers.has(user.id)) {
        onlineUsers.get(user.id).currentDextop = targetDextopId;
      }

      // Notify friends of updated dextop location
      const userFriendsList2 = userFriends.get(user.id);
      if (userFriendsList2) {
        for (const fid of userFriendsList2) {
          const fSockId = userSockets.get(fid);
          if (fSockId) {
            io.to(fSockId).emit('friendStatusUpdate', {
              [user.id]: {
                id: user.id,
                username: user.username,
                isOnline: true,
                currentDextop: targetDextopId
              }
            });
          }
        }
      }
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

  // Social feature handlers
  socket.on('localMessage', ({ roomId, message }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    // Broadcast message to all users in the room
    io.to(roomId).emit('localMessage', message);
  });

  socket.on('privateMessage', async ({ recipientId, message }) => {
    try {
      // Get recipient's socket ID
      const recipientSocketId = userSockets.get(recipientId);
      if (!recipientSocketId) return; // User is offline

      // Send to recipient
      io.to(recipientSocketId).emit('privateMessage', message);
      // Send back to sender
      socket.emit('privateMessage', message);
    } catch (error) {
      console.error('Error sending private message:', error);
    }
  });

  socket.on('friendRequest', async ({ username }) => {
    try {
      // Get user from token
      const token = socket.handshake.auth.token;
      const decoded = authService.verifyJWT(token);
      if (!decoded) return;

      // Find target user by username
      const targetUser = await db.findUserByUsername(username);
      if (!targetUser) {
        socket.emit('error', { message: 'User not found' });
        return;
      }

      // Check if already friends
      const userFriendsList = userFriends.get(decoded.userId) || new Set();
      if (userFriendsList.has(targetUser.id)) {
        socket.emit('error', { message: 'Already friends with this user' });
        return;
      }

      // Create friend request
      const requestId = uuidv4();
      const targetUserRequests = userFriendRequests.get(targetUser.id) || new Set();
      targetUserRequests.add({
        id: requestId,
        from: decoded.userId,
        username: decoded.username,
        timestamp: Date.now()
      });
      userFriendRequests.set(targetUser.id, targetUserRequests);

      // Notify target user if online
      const targetSocketId = userSockets.get(targetUser.id);
      if (targetSocketId) {
        io.to(targetSocketId).emit('friendRequest', {
          requestId,
          from: decoded.userId,
          username: decoded.username
        });
      }
    } catch (error) {
      console.error('Error sending friend request:', error);
      socket.emit('error', { message: 'Failed to send friend request' });
    }
  });

  socket.on('acceptFriendRequest', async ({ requestId }) => {
    try {
      // Get user from token
      const token = socket.handshake.auth.token;
      const decoded = authService.verifyJWT(token);
      if (!decoded) return;

      // Find the request
      const userRequests = userFriendRequests.get(decoded.userId);
      if (!userRequests) return;

      const request = Array.from(userRequests).find(r => r.id === requestId);
      if (!request) return;

      // Remove request
      userRequests.delete(request);

      // Add to friends lists
      const userFriendsList = userFriends.get(decoded.userId) || new Set();
      const otherUserFriendsList = userFriends.get(request.from) || new Set();

      userFriendsList.add(request.from);
      otherUserFriendsList.add(decoded.userId);

      userFriends.set(decoded.userId, userFriendsList);
      userFriends.set(request.from, otherUserFriendsList);

      // Save to database
      await db.addFriend(decoded.userId, request.from);

      // Notify both users
      const friendData = {
        id: request.from,
        username: request.username,
        isOnline: true,
        currentDextop: onlineUsers.get(request.from)?.currentDextop
      };

      const userData = {
        id: decoded.userId,
        username: decoded.username,
        isOnline: true,
        currentDextop: onlineUsers.get(decoded.userId)?.currentDextop
      };

      socket.emit('friendRequestAccepted', { friend: friendData });

      const otherSocketId = userSockets.get(request.from);
      if (otherSocketId) {
        io.to(otherSocketId).emit('friendRequestAccepted', { friend: userData });
      }
    } catch (error) {
      console.error('Error accepting friend request:', error);
      socket.emit('error', { message: 'Failed to accept friend request' });
    }
  });

  socket.on('rejectFriendRequest', async ({ requestId }) => {
    try {
      // Get user from token
      const token = socket.handshake.auth.token;
      const decoded = authService.verifyJWT(token);
      if (!decoded) return;

      // Find and remove the request
      const userRequests = userFriendRequests.get(decoded.userId);
      if (!userRequests) return;

      const request = Array.from(userRequests).find(r => r.id === requestId);
      if (!request) return;

      userRequests.delete(request);
    } catch (error) {
      console.error('Error rejecting friend request:', error);
    }
  });

  socket.on('getFriendsList', async () => {
    try {
      // Get user from token
      const token = socket.handshake.auth.token;
      const decoded = authService.verifyJWT(token);
      if (!decoded) return;

      // Get friends from database
      const friends = await db.getUserFriends(decoded.userId);
      const friendsList = {};

      for (const friend of friends) {
        const isOnline = onlineUsers.has(friend.id);
        friendsList[friend.id] = {
          id: friend.id,
          username: friend.username,
          isOnline,
          currentDextop: isOnline ? onlineUsers.get(friend.id).currentDextop : undefined
        };
      }

      socket.emit('friendStatusUpdate', friendsList);
    } catch (error) {
      console.error('Error getting friends list:', error);
    }
  });

  socket.on('joinFriendDextop', async ({ friendId }) => {
    try {
      // Get user from token
      const token = socket.handshake.auth.token;
      const decoded = authService.verifyJWT(token);
      if (!decoded) return;

      // Check if they are friends
      const userFriendsList = userFriends.get(decoded.userId);
      if (!userFriendsList?.has(friendId)) {
        socket.emit('error', { message: 'Not friends with this user' });
        return;
      }

      // Check if friend is online
      const friendDextop = onlineUsers.get(friendId)?.currentDextop;
      if (!friendDextop) {
        socket.emit('error', { message: 'Friend is not online' });
        return;
      }

      // Join friend's dextop
      socket.emit('joinDextopByCode', { code: friendDextop });
    } catch (error) {
      console.error('Error joining friend dextop:', error);
      socket.emit('error', { message: 'Failed to join friend\'s dextop' });
    }
  });

  // Update user tracking on connection/disconnection
  socket.on('authenticate', async (token) => {
    try {
      const decoded = authService.verifyJWT(token);
      if (!decoded) return;

      // Patch handshake so future handlers can access the token
      socket.handshake.auth = socket.handshake.auth || {};
      socket.handshake.auth.token = token;

      // Store socket mapping
      userSockets.set(decoded.userId, socket.id);
      onlineUsers.set(decoded.userId, { socketId: socket.id, currentDextop: decoded.userId });

      // NEW: Hydrate in-memory friends list for this user so future
      // handlers (e.g. joinFriendDextop) know who they're friends with.
      if (!userFriends.has(decoded.userId)) {
        try {
          const friends = await db.getUserFriends(decoded.userId);
          const friendSet = new Set(friends.map((f) => f.id));
          userFriends.set(decoded.userId, friendSet);
        } catch (err) {
          console.error('Failed to load friends for', decoded.userId, err);
        }
      }

      // Notify friends that user is online
      const userFriendsList = userFriends.get(decoded.userId);
      if (userFriendsList) {
        for (const friendId of userFriendsList) {
          const friendSocketId = userSockets.get(friendId);
          if (friendSocketId) {
            io.to(friendSocketId).emit('friendStatusUpdate', {
              [decoded.userId]: {
                id: decoded.userId,
                username: decoded.username,
                isOnline: true,
                currentDextop: null
              }
            });
          }
        }
      }
    } catch (error) {
      console.error('Error authenticating socket:', error);
    }
  });

  socket.on('disconnect', async () => {
    try {
      // Find user ID from socket
      let userId;
      for (const [uid, sid] of userSockets.entries()) {
        if (sid === socket.id) {
          userId = uid;
          break;
        }
      }

      if (userId) {
        // Clean up user tracking
        userSockets.delete(userId);
        onlineUsers.delete(userId);
        
        // Notify friends that user is offline
        const userFriendsList = userFriends.get(userId);
        if (userFriendsList) {
          for (const friendId of userFriendsList) {
            const friendSocketId = userSockets.get(friendId);
            if (friendSocketId) {
              io.to(friendSocketId).emit('friendStatusUpdate', {
                [userId]: {
                  id: userId,
                  isOnline: false
                }
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Error handling disconnect:', error);
    }
  });

  // Allow clients to request joining a dextop by code (user ID)
  socket.on('joinDextopByCode', async ({ code }) => {
    try {
      if (!code) return;
      const token = socket.handshake.auth.token;
      if (!token) return;

      // Reuse joinDextop logic by emitting the event locally
      // but avoid hitting client again; instead call the same
      // handler function contents inline (simplified).

      const decoded = authService.verifyJWT(token);
      if (!decoded) {
        socket.emit('error', { message: 'Invalid token' });
        return;
      }

      // If already in desired dextop, ignore
      const currentInfo = onlineUsers.get(decoded.userId);
      if (currentInfo && currentInfo.currentDextop === code) return;

      // Leave all existing dextop rooms
      for (const [dextopId, session] of activeDextops.entries()) {
        if (session.visitors.has(decoded.userId)) {
          session.visitors.delete(decoded.userId);
          socket.leave(dextopId);
          socket.to(dextopId).emit('visitorLeft', { userId: decoded.userId });
        }
      }

      // Finally call joinDextop by emitting internally (reuse existing handler)
      socket.emit('joinDextop', { token, dextopId: code });
    } catch (err) {
      console.error('joinDextopByCode error', err);
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