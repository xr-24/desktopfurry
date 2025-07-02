const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

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

// In-memory storage for rooms (later we'll use Redis)
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
    };

    socket.join(roomId);
    socket.emit('roomJoined', { roomId, playerId, username, quadrant });
    socket.emit('desktopState', room.desktop);
    
    // Update all players in the room
    io.to(roomId).emit('playersUpdate', room.players);

    console.log(`${username} joined room ${roomId}`);
  });

  socket.on('playerMove', (data) => {
    const { position, isMoving, movementDirection, walkFrame, facingDirection } = data;
    // Find the room this player is in
    for (const [roomId, room] of rooms.entries()) {
      if (room.players[socket.id]) {
        room.players[socket.id].position = position;
        room.players[socket.id].isMoving = isMoving;
        room.players[socket.id].movementDirection = movementDirection;
        room.players[socket.id].walkFrame = walkFrame;
        room.players[socket.id].facingDirection = facingDirection;
        // Broadcast the movement to other players in the room
        socket.to(roomId).emit('playerMoved', {
          playerId: socket.id,
          position,
          isMoving,
          movementDirection,
          walkFrame,
          facingDirection,
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

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Remove player from all rooms
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

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 