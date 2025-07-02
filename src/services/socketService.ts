import { io, Socket } from 'socket.io-client';
import { store } from '../store/store';
import { setConnected, joinRoom, updatePlayers, updatePlayerPosition } from '../store/gameSlice';
import { setPlayer } from '../store/playerSlice';

class SocketService {
  private socket: Socket | null = null;

  connect() {
    // For now, we'll connect to localhost. Later we'll use your Render.com backend
    this.socket = io('http://localhost:3001');

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

    this.socket.on('playerMoved', (data: { playerId: string; position: { x: number; y: number } }) => {
      store.dispatch(updatePlayerPosition(data));
    });
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

  movePlayer(position: { x: number; y: number }) {
    if (this.socket) {
      this.socket.emit('playerMove', position);
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