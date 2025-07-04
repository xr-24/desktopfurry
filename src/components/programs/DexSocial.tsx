import React, { useState, useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { setActiveTab, addLocalMessage, addPrivateMessage, updateFriends, setSelectedFriend } from '../../store/socialSlice';
import { socketService } from '../../services/socketService';
import { authService } from '../../services/authService';
import './DexSocial.css';

interface Message {
  id: string;
  sender: string;
  senderId?: string;
  content: string;
  timestamp: number;
  type: 'local' | 'private';
  recipientId?: string;
}

interface Friend {
  id: string;
  username: string;
  isOnline: boolean;
  currentDextop?: string;
}

interface DexSocialProps {
  windowId: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
  isMinimized: boolean;
  programState: {
    activeTab: 'friends' | 'local' | 'private' | 'dextop';
    localMessages: Message[];
    privateMessages: { [friendId: string]: Message[] };
    friends: Friend[];
    selectedFriend?: string;
  };
  onClose?: () => void; // Callback to hide the widget
}

const DexSocial: React.FC<DexSocialProps> = ({
  windowId,
  position,
  size,
  zIndex,
  isMinimized,
  programState,
  onClose
}) => {
  const dispatch = useAppDispatch();
  const [activeTab, setActiveTabLocal] = useState<'friends' | 'local' | 'private' | 'dextop'>(
    programState.activeTab || 'local'
  );
  const [messageInput, setMessageInput] = useState('');
  const [friendSearchInput, setFriendSearchInput] = useState('');
  const [dextopCodeInput, setDextopCodeInput] = useState('');
  const [selectedFriend, setSelectedFriendLocal] = useState<string | undefined>(
    programState.selectedFriend
  );
  const [searchResults, setSearchResults] = useState<Friend[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const currentUser = useAppSelector((state) => state.auth.user);
  const currentDextop = useAppSelector((state) => state.dextop.current);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [programState.localMessages, programState.privateMessages]);

  // Register message handlers
  useEffect(() => {
    socketService.registerMessageHandler(windowId, (message: Message) => {
      if (message.type === 'local') {
        dispatch(addLocalMessage(message));
      } else if (message.type === 'private') {
        dispatch(addPrivateMessage({ message, currentUserId: currentUser?.id || '' }));
      }
    });

    socketService.registerFriendStatusHandler(windowId, (friends: { [id: string]: Friend }) => {
      dispatch(updateFriends(Object.values(friends)));
    });

    // Initial friends list fetch
    socketService.getFriendsList();

    return () => {
      socketService.unregisterMessageHandler(windowId);
      socketService.unregisterFriendStatusHandler(windowId);
    };
  }, [windowId, dispatch, currentUser?.id]);

  // Update Redux state when local state changes
  useEffect(() => {
    dispatch(setActiveTab(activeTab));
  }, [activeTab, dispatch]);

  useEffect(() => {
    dispatch(setSelectedFriend(selectedFriend));
  }, [selectedFriend, dispatch]);

  const handleTabChange = (tab: 'friends' | 'local' | 'private' | 'dextop') => {
    setActiveTabLocal(tab);
  };

  const handleSendMessage = () => {
    if (!messageInput.trim()) return;

    if (activeTab === 'local') {
      socketService.sendLocalMessage(messageInput);
    } else if (activeTab === 'private' && selectedFriend) {
      socketService.sendPrivateMessage(selectedFriend, messageInput);
    }

    setMessageInput('');
  };

  const handleFriendSearch = async () => {
    if (!friendSearchInput.trim()) return;
    setIsSearching(true);

    try {
      const results = await authService.searchUsers(friendSearchInput);
      setSearchResults(results.filter((user: any) => user.id !== currentUser?.id));
    } catch (error) {
      console.error('Failed to search users:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendFriendRequest = (username: string) => {
    socketService.sendFriendRequest(username);
    setSearchResults([]);
    setFriendSearchInput('');
  };

  const handleJoinFriendDextop = (friendId: string) => {
    socketService.joinFriendDextop(friendId);
  };

  const handleJoinDextopByCode = () => {
    const tk = authService.getToken();
    if (tk && socketService['socket']) {
      (socketService as any)['socket'].emit('joinDextop', { token: tk, dextopId: dextopCodeInput });
    }
    setDextopCodeInput('');
  };

  const handleLeaveDextop = () => {
    socketService.leaveDextop();
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'friends':
        return (
          <div className="dex-social-friends">
            <div className="friend-search">
              <input
                type="text"
                placeholder="Search username..."
                value={friendSearchInput}
                onChange={(e) => setFriendSearchInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleFriendSearch();
                  }
                }}
              />
              <button 
                className="win98-button"
                onClick={handleFriendSearch}
                disabled={isSearching}
              >
                {isSearching ? 'Searching...' : 'Search'}
              </button>
            </div>
            {searchResults.length > 0 && (
              <div className="search-results">
                {searchResults.map((user) => (
                  <div key={user.id} className="search-result-item">
                    <span className="username">{user.username}</span>
                    <button 
                      className="win98-button small"
                      onClick={() => handleSendFriendRequest(user.username)}
                    >
                      Add Friend
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="friends-list">
              {programState.friends.map((friend) => (
                <div key={friend.id} className="friend-item">
                  <span className={`status-dot ${friend.isOnline ? 'online' : 'offline'}`} />
                  <span className="friend-name">{friend.username}</span>
                  {friend.isOnline && friend.currentDextop && (
                    <button 
                      className="win98-button small"
                      onClick={() => handleJoinFriendDextop(friend.id)}
                    >
                      Join
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        );

      case 'local':
        return (
          <div className="dex-social-local">
            <div className="messages-container">
              {programState.localMessages.map((msg) => (
                <div key={msg.id} className="message-item">
                  <span className="message-sender">{msg.sender}:</span>
                  <span className="message-content">{msg.content}</span>
                  <span className="message-time">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <div className="message-input">
              <input
                type="text"
                placeholder="Type a message..."
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSendMessage();
                  }
                }}
              />
              <button 
                className="win98-button"
                onClick={handleSendMessage}
              >
                Send
              </button>
            </div>
          </div>
        );

      case 'private':
        return (
          <div className="dex-social-private">
            <div className="friends-sidebar">
              {programState.friends
                .filter(f => f.isOnline)
                .map((friend) => (
                  <div
                    key={friend.id}
                    className={`friend-item ${selectedFriend === friend.id ? 'selected' : ''}`}
                    onClick={() => setSelectedFriendLocal(friend.id)}
                  >
                    <span className="status-dot online" />
                    <span className="friend-name">{friend.username}</span>
                  </div>
                ))}
            </div>
            <div className="private-chat">
              {selectedFriend ? (
                <>
                  <div className="messages-container">
                    {programState.privateMessages[selectedFriend]?.map((msg) => (
                      <div key={msg.id} className="message-item">
                        <span className="message-sender">{msg.sender}:</span>
                        <span className="message-content">{msg.content}</span>
                        <span className="message-time">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                  <div className="message-input">
                    <input
                      type="text"
                      placeholder="Type a message..."
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleSendMessage();
                        }
                      }}
                    />
                    <button 
                      className="win98-button"
                      onClick={handleSendMessage}
                    >
                      Send
                    </button>
                  </div>
                </>
              ) : (
                <div className="no-friend-selected">
                  Select a friend to start chatting
                </div>
              )}
            </div>
          </div>
        );

      case 'dextop':
        return (
          <div className="dex-social-dextop">
            <div className="current-dextop">
              <h3>Current Dextop</h3>
              <p>{currentDextop?.id || 'Your Personal Dextop'}</p>
              {currentDextop?.id !== currentUser?.id && (
                <button 
                  className="win98-button"
                  onClick={handleLeaveDextop}
                >
                  Leave & Return Home
                </button>
              )}
            </div>
            <div className="join-dextop">
              <h3>Join Dextop</h3>
              <input
                type="text"
                placeholder="Enter Dextop code..."
                value={dextopCodeInput}
                onChange={(e) => setDextopCodeInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleJoinDextopByCode();
                  }
                }}
              />
              <button 
                className="win98-button"
                onClick={handleJoinDextopByCode}
              >
                Join
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <div
      className="dex-social-window"
      style={{
        position: 'relative',
        left: 0,
        top: 0,
        width: size.width,
        height: size.height,
        zIndex: 1,
        background: '#c0c0c0',
        border: '2px outset #c0c0c0',
        display: isMinimized ? 'none' : 'block'
      }}
    >
      {/* Custom Title Bar */}
      <div 
        className="dex-social-title-bar"
        style={{
          background: 'linear-gradient(90deg, #0080ff 0%, #0040ff 100%)',
          color: 'white',
          padding: '4px 8px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '11px',
          fontFamily: '"Better VCR", "MS Sans Serif", sans-serif',
          fontWeight: 'bold'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>💬</span>
          <span>Dex Social</span>
        </div>
        <div>
          <button 
            style={{
              background: '#c0c0c0',
              border: '1px outset #c0c0c0',
              width: '16px',
              height: '14px',
              cursor: 'pointer',
              fontSize: '9px',
              fontFamily: '"Better VCR", "MS Sans Serif", sans-serif'
            }}
            onClick={onClose}
            title="Minimize to taskbar"
          >
            _
          </button>
        </div>
      </div>

      {/* Window Content */}
      <div 
        className="dex-social-container"
        style={{
          height: 'calc(100% - 22px)', // Subtract title bar height
          overflow: 'hidden'
        }}
      >
        <div className="dex-social-tabs">
          <button
            className={`tab-button ${activeTab === 'friends' ? 'active' : ''}`}
            onClick={() => handleTabChange('friends')}
          >
            Friends
          </button>
          <button
            className={`tab-button ${activeTab === 'local' ? 'active' : ''}`}
            onClick={() => handleTabChange('local')}
          >
            Local Chat
          </button>
          <button
            className={`tab-button ${activeTab === 'private' ? 'active' : ''}`}
            onClick={() => handleTabChange('private')}
          >
            Private Messages
          </button>
          <button
            className={`tab-button ${activeTab === 'dextop' ? 'active' : ''}`}
            onClick={() => handleTabChange('dextop')}
          >
            Dextop
          </button>
        </div>
        <div className="tab-content">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
};

export default DexSocial; 