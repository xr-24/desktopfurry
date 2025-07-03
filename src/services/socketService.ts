import { io, Socket } from 'socket.io-client';
import { store } from '../store/store';
import { setConnected, joinRoom, updatePlayers, updatePlayerPosition } from '../store/gameSlice';
import { setPlayer } from '../store/playerSlice';
import { syncDesktop } from '../store/programSlice';

// Utility to deep compare objects by JSON stringify (cheap & ok for small state)
function jsonEqual(a: any, b: any) {
  return JSON.stringify(a) === JSON.stringify(b);
}

class SocketService {
  private socket: Socket | null = null;

  // Keep last sent desktop state so we only emit diffs
  private lastDesktopState: any = null;
  private lastPlayerState: any = null;
  // Flag to ignore local store updates that originated remotely
  private ignoreNextDesktopUpdate = false;
  
  // Add heartbeat and connection recovery
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect() {
    // Use env variable in production, fallback to localhost during development
    const serverUrl =
      (process.env.REACT_APP_SOCKET_URL as string | undefined) ||
      'http://localhost:3001';

    this.socket = io(serverUrl, {
      // Add connection options for better reliability
      forceNew: true,
      timeout: 20000,
      transports: ['websocket', 'polling'],
    });

    this.socket.on('connect', () => {
      console.log('Connected to server');
      store.dispatch(setConnected(true));
      this.reconnectAttempts = 0;
      this.startHeartbeat();
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected from server:', reason);
      store.dispatch(setConnected(false));
      this.stopHeartbeat();
      
      // Attempt reconnection if not manual disconnect
      if (reason !== 'io client disconnect' && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        console.log(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
        setTimeout(() => {
          if (this.socket) {
            this.socket.connect();
          }
        }, 1000 * this.reconnectAttempts);
      }
    });

    this.socket.on('connect_error', (error) => {
      console.log('Connection error:', error);
      store.dispatch(setConnected(false));
    });

    this.socket.on('roomJoined', (data: { roomId: string; playerId: string; username: string; quadrant: number }) => {
      store.dispatch(joinRoom(data.roomId));
      store.dispatch(setPlayer({ id: data.playerId, username: data.username, quadrant: data.quadrant }));

      // After Redux slices are set up, broadcast saved avatar appearance to the room
      const appearance = store.getState().player.appearance;
      if (appearance) {
        // Slight delay ensures player slice dispatch finishes before we emit
        setTimeout(() => this.updateAppearance(appearance), 0);
      }
    });

    this.socket.on('playersUpdate', (players: any) => {
      store.dispatch(updatePlayers(players));
    });

    this.socket.on('playerMoved', (data: any) => {
      store.dispatch(updatePlayerPosition(data));
    });

    // Receive full desktop state from server
    this.socket.on('desktopState', (desktopState: any) => {
      // remove any characterEditor windows before syncing local store
      for (const id of Object.keys(desktopState.openPrograms || {})) {
        if (desktopState.openPrograms[id].type === 'characterEditor') {
          delete desktopState.openPrograms[id];
        }
      }
      this.ignoreNextDesktopUpdate = true;
      this.lastDesktopState = desktopState;
      store.dispatch(syncDesktop(desktopState));
      // reset flag after current tick
      setTimeout(() => { this.ignoreNextDesktopUpdate = false; }, 0);
    });

    // Prime lastDesktopState with current slice
    this.lastDesktopState = store.getState().programs;

    // Prime lastPlayerState
    this.lastPlayerState = store.getState().player;

    // Subscribe once to program slice changes to broadcast
    const sanitize = (progState:any) => {
      const clone = JSON.parse(JSON.stringify(progState));
      for (const id of Object.keys(clone.openPrograms)) {
        if (clone.openPrograms[id].type === 'characterEditor') {
          delete clone.openPrograms[id];
        }
      }
      return clone;
    };

    const sendDesktopState = () => {
      if (this.ignoreNextDesktopUpdate) return;
      const raw = store.getState().programs;
      const state = sanitize(raw);
      if (!jsonEqual(state, sanitize(this.lastDesktopState))) {
        const roomId = store.getState().game.roomId;
        if (roomId && this.socket) {
          this.socket.emit('desktopStateUpdate', { roomId, desktopState: state });
          this.lastDesktopState = state;
        }
      }
    };

    store.subscribe(sendDesktopState);

    // Subscribe once to player slice changes to broadcast gaming state
    const sendPlayerState = () => {
      const player = store.getState().player;
      // Only care about gaming state fields changing
      if (player && !jsonEqual({ isGaming: player.isGaming, dir: player.gamingInputDirection }, { isGaming: this.lastPlayerState?.isGaming, dir: this.lastPlayerState?.gamingInputDirection })) {
        const roomId = store.getState().game.roomId;
        if (roomId && this.socket) {
          this.socket.emit('playerStateUpdate', {
            roomId,
            playerId: player.id,
            isGaming: player.isGaming,
            gamingInputDirection: player.gamingInputDirection,
          });
          this.lastPlayerState = player;
        }
      }
    };

    store.subscribe(sendPlayerState);
  }

  createRoom(username: string) {
    if (this.socket) {
      this.socket.emit('createRoom', { username });
    }
  }

  joinExistingRoom(roomId: string, username: string) {
    if (this.socket) {
      this.socket.emit('joinRoom', { roomId, username });
    }
  }

  movePlayer(data: {
    position: { x: number; y: number };
    isMoving: boolean;
    movementDirection: string | null;
    walkFrame: number;
    facingDirection: 'left' | 'right';
    isGrabbing?: boolean;
    isResizing?: boolean;
  }) {
    if (this.socket && this.socket.connected) {
      // Add timestamp for animation sync
      const timestampedData = {
        ...data,
        timestamp: Date.now()
      };
      this.socket.emit('playerMove', timestampedData);
    }
  }

  updateAppearance(appearance: { hue: number; eyes: string; ears: string; fluff: string; tail: string }) {
    const roomId = store.getState().game.roomId;
    const playerId = store.getState().player.id;
    if (this.socket && roomId && playerId) {
      this.socket.emit('appearanceUpdate', { roomId, playerId, appearance });
    }
  }

  disconnect() {
    this.stopHeartbeat();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Add heartbeat and connection recovery
  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.socket) {
        this.socket.emit('heartbeat');
      }
    }, 10000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}

export const socketService = new SocketService(); 