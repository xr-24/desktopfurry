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

  connect() {
    // Use env variable in production, fallback to localhost during development
    const serverUrl =
      (process.env.REACT_APP_SOCKET_URL as string | undefined) ||
      'http://localhost:3001';

    this.socket = io(serverUrl);

    this.socket.on('connect', () => {
      console.log('Connected to server');
      store.dispatch(setConnected(true));
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
      store.dispatch(setConnected(false));
    });

    this.socket.on('roomJoined', (data: { roomId: string; playerId: string; username: string; quadrant: number }) => {
      store.dispatch(joinRoom(data.roomId));
      store.dispatch(setPlayer({ id: data.playerId, username: data.username, quadrant: data.quadrant }));
    });

    this.socket.on('playersUpdate', (players: any) => {
      store.dispatch(updatePlayers(players));
    });

    this.socket.on('playerMoved', (data: any) => {
      store.dispatch(updatePlayerPosition(data));
    });

    // Receive full desktop state from server
    this.socket.on('desktopState', (desktopState: any) => {
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
    const sendDesktopState = () => {
      if (this.ignoreNextDesktopUpdate) return;
      const state = store.getState().programs;
      if (!jsonEqual(state, this.lastDesktopState)) {
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
    if (this.socket) {
      this.socket.emit('playerMove', data);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const socketService = new SocketService(); 