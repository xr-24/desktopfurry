import React, { useState, useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { setActiveTab, updateFriends, setSelectedFriend, clearUnreadMessages, clearFriendRequestNotifications, removeFriendRequest } from '../../store/socialSlice';
import { socketService } from '../../services/socketService';
import { authService } from '../../services/authService';
import { offlineDataService } from '../../services/offlineDataService';
import './DexSocial.css';

interface Message {
  id: string;
  sender: string;
  senderId?: string;
  content: string;
  color?: number; // hue value 0-359 provided by sender preference
  timestamp: number;
  type: 'local' | 'private';
  recipientId?: string;
  isRead?: boolean; // Added for marking messages as read
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
    friendRequests?: any[];
  };
  onClose?: () => void; // Callback to hide the widget
  focusTrigger?: number; // increments when parent wants to focus input
  onTabChange?: (tab: 'friends' | 'local' | 'private' | 'dextop') => void; // Callback when tab is manually changed
  initialTab?: 'friends' | 'local' | 'private' | 'dextop'; // Initial tab to show (overrides programState.activeTab)
  forceLocalTab?: boolean; // Whether to force switch to local tab when focusTrigger changes
}

const DexSocial: React.FC<DexSocialProps> = ({
  windowId,
  position,
  size,
  zIndex,
  isMinimized,
  programState,
  onClose,
  focusTrigger,
  onTabChange,
  initialTab,
  forceLocalTab,
}) => {
  const dispatch = useAppDispatch();
  const [activeTab, setActiveTabLocal] = useState<'friends' | 'local' | 'private' | 'dextop'>(
    initialTab || 'local'
  );
  
  // Debug logging
  useEffect(() => {
    console.log('DexSocial initialized with activeTab:', activeTab, 'initialTab prop:', initialTab);
  }, []);
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
  const localInputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [programState.localMessages, programState.privateMessages]);

  // Register friend status handler only (messages handled globally)
  useEffect(() => {
    socketService.registerFriendStatusHandler(windowId, (friends: { [id: string]: Friend }) => {
      dispatch(updateFriends(Object.values(friends)));
    });

    // Initial friends list fetch
    socketService.getFriendsList();

    return () => {
      socketService.unregisterFriendStatusHandler(windowId);
    };
  }, [windowId, dispatch]);

  // Update selectedFriend in Redux when local state changes
  useEffect(() => {
    dispatch(setSelectedFriend(selectedFriend));
  }, [selectedFriend, dispatch]);

  // Clear unread counts when viewing specific tabs
  useEffect(() => {
    if (activeTab === 'local' || activeTab === 'private') {
      dispatch(clearUnreadMessages());
      
      // If viewing private tab, mark all unread messages as read in the database
      if (activeTab === 'private') {
        const allMessages = Object.values(programState.privateMessages).flat();
        const unreadMessageIds = allMessages
          .filter(msg => !msg.isRead && msg.senderId !== currentUser?.id)
          .map(msg => msg.id);
        
        if (unreadMessageIds.length > 0) {
          offlineDataService.markMessagesAsRead(unreadMessageIds);
        }
      }
    }
    if (activeTab === 'friends') {
      dispatch(clearFriendRequestNotifications());
    }
  }, [activeTab, dispatch, programState.privateMessages, currentUser?.id]);

  const handleTabChange = (tab: 'friends' | 'local' | 'private' | 'dextop') => {
    setActiveTabLocal(tab);
    // Notify parent of manual tab change
    onTabChange?.(tab);
  };

  const handleSendMessage = () => {
    if (!messageInput.trim()) return;

    if (activeTab === 'local') {
      socketService.sendLocalMessage(messageInput);
      // Auto-close after sending local chat if onClose provided
      onClose?.();
    } else if (activeTab === 'private' && selectedFriend) {
      const selectedFriendData = programState.friends.find(f => f.id === selectedFriend);
      const isOffline = selectedFriendData && !selectedFriendData.isOnline;
      
      socketService.sendPrivateMessage(selectedFriend, messageInput);
      
      // Show feedback for offline messages
      if (isOffline) {
        // You could add a toast notification here if you want
        console.log('Message sent to offline friend - will be delivered when they log in');
      }
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

  // Friend request handlers
  const handleAcceptRequest = async (requestId: string) => {
    const success = await offlineDataService.respondToFriendRequest(requestId, 'accept');
    if (success) {
      socketService.acceptFriendRequest(requestId);
      dispatch(removeFriendRequest(requestId));
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    const success = await offlineDataService.respondToFriendRequest(requestId, 'reject');
    if (success) {
      socketService.rejectFriendRequest(requestId);
      dispatch(removeFriendRequest(requestId));
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'friends':
        return (
          <div className="dex-social-friends">
            {/* Pending Friend Requests */}
            {programState.friendRequests && programState.friendRequests.length > 0 && (
              <div className="friend-requests-section">
                <h4>Friend Requests</h4>
                {programState.friendRequests.map((req: any) => (
                  <div key={req.id} className="friend-request-item">
                    <span className="username">{req.username}</span>
                    <button className="win98-button small" onClick={() => handleAcceptRequest(req.id)}>Accept</button>
                    <button className="win98-button small" onClick={() => handleRejectRequest(req.id)}>Deny</button>
                  </div>
                ))}
              </div>
            )}
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
              {[...programState.friends]
                .sort((a, b) => {
                  // Sort online friends first, then alphabetically
                  if (a.isOnline !== b.isOnline) {
                    return a.isOnline ? -1 : 1;
                  }
                  return a.username.localeCompare(b.username);
                })
                .map((friend) => (
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
                  <span 
                    className="message-sender" 
                    style={{ color: msg.color !== undefined ? `hsl(${msg.color}, 100%, 50%)` : undefined }}
                  >
                    {msg.sender}:
                  </span>
                  <span 
                    className="message-content" 
                    style={{ color: msg.color !== undefined ? `hsl(${msg.color}, 100%, 50%)` : undefined }}
                  >
                    {msg.content}
                  </span>
                  <span className="message-time">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <div className="message-input">
              <input
                ref={localInputRef}
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
              {[...programState.friends]
                .sort((a, b) => {
                  // Sort online friends first, then alphabetically
                  if (a.isOnline !== b.isOnline) {
                    return a.isOnline ? -1 : 1;
                  }
                  return a.username.localeCompare(b.username);
                })
                .map((friend) => (
                  <div
                    key={friend.id}
                    className={`friend-item ${selectedFriend === friend.id ? 'selected' : ''}`}
                    onClick={() => setSelectedFriendLocal(friend.id)}
                  >
                    <span className={`status-dot ${friend.isOnline ? 'online' : 'offline'}`} />
                    <span className="friend-name">{friend.username}</span>
                    {!friend.isOnline && <span className="offline-indicator">(offline)</span>}
                  </div>
                ))}
            </div>
            <div className="private-chat">
              {selectedFriend ? (
                <>
                  <div className="messages-container">
                    {programState.privateMessages[selectedFriend]?.map((msg) => (
                      <div key={msg.id} className="message-item">
                        <span 
                          className="message-sender" 
                          style={{ color: msg.color !== undefined ? `hsl(${msg.color}, 100%, 50%)` : undefined }}
                        >
                          {msg.sender}:
                        </span>
                        <span 
                          className="message-content" 
                          style={{ color: msg.color !== undefined ? `hsl(${msg.color}, 100%, 50%)` : undefined }}
                        >
                          {msg.content}
                        </span>
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

  // Auto focus input when focusTrigger changes
  useEffect(() => {
    if (focusTrigger !== undefined) {
      // Only force local tab if forceLocalTab is true (i.e., opened via T key)
      if (forceLocalTab && activeTab !== 'local') {
        handleTabChange('local');
      }
      // delay focus until input rendered
      setTimeout(() => {
        localInputRef.current?.focus();
      }, 0);
    }
  }, [focusTrigger, forceLocalTab]);

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
          background: `linear-gradient(90deg, var(--win98-blue) 0%, var(--win98-dark-blue) 100%)`,
          color: 'white',
          padding: '4px 8px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '11px',
          fontFamily: 'var(--theme-font-primary, "Better VCR", "MS Sans Serif", sans-serif)',
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
