import React, { useState } from 'react';
import { useAppSelector } from '../store/hooks';
import { socketService } from '../services/socketService';
import '../styles/win98.css';

const Lobby: React.FC = () => {
  const [username, setUsername] = useState('');
  const [roomId, setRoomIdInput] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const { isConnected, roomId: currentRoomId } = useAppSelector((state) => state.game);

  const handleCreateRoom = () => {
    if (username.trim()) {
      socketService.createRoom(username.trim());
    }
  };

  const handleJoinRoom = () => {
    if (username.trim() && roomId.trim()) {
      socketService.joinExistingRoom(roomId.trim(), username.trim());
    }
  };

  if (currentRoomId) {
    return null; // Don't show lobby if already in a room
  }

  return (
    <div className="win98-desktop">
      <div className="lobby-container win98-window">
        <div className="win98-window-title">
          <span>🎮 Retro Desktop Multiplayer</span>
        </div>
        <div className="lobby-content">
          <div className="form-group">
            <label htmlFor="username">Username:</label>
            <input
              id="username"
              type="text"
              className="win98-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              maxLength={20}
              style={{ width: '100%' }}
            />
          </div>

          {!isJoining ? (
            <div>
              <div className="button-group">
                <button className="win98-button" onClick={handleCreateRoom} disabled={!username.trim() || !isConnected}>
                  Create Room
                </button>
                <button className="win98-button" onClick={() => setIsJoining(true)}>
                  Join Room
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="form-group">
                <label htmlFor="roomId">Room ID:</label>
                <input
                  id="roomId"
                  type="text"
                  className="win98-input"
                  value={roomId}
                  onChange={(e) => setRoomIdInput(e.target.value)}
                  placeholder="Enter room ID"
                  style={{ width: '100%' }}
                />
              </div>
              <div className="button-group">
                <button className="win98-button" onClick={handleJoinRoom} disabled={!username.trim() || !roomId.trim() || !isConnected}>
                  Join
                </button>
                <button className="win98-button" onClick={() => setIsJoining(false)}>
                  Back
                </button>
              </div>
            </div>
          )}

          <div className="room-info">
            Status: {isConnected ? '🟢 Connected' : '🔴 Connecting...'}
          </div>
        </div>
      </div>

      {/* Win98 Taskbar */}
      <div className="win98-taskbar">
        <button className="win98-start-button">
          <span>🖥️</span>
          <span>Retro Desktop</span>
        </button>
      </div>
    </div>
  );
};

export default Lobby; 