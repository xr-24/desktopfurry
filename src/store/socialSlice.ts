import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Message {
  id: string;
  sender: string;
  senderId?: string;
  content: string;
  color?: number;
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

interface FriendRequest {
  id: string;
  from: string;
  username: string;
}

interface SocialState {
  activeTab: 'friends' | 'local' | 'private' | 'dextop';
  localMessages: Message[];
  privateMessages: { [friendId: string]: Message[] };
  friends: Friend[];
  selectedFriend?: string;
  unreadMessages: number;
  unreadFriendRequests: number;
  friendRequests: FriendRequest[];
  lastNotification?: { tab: 'friends' | 'local' | 'private'; friendId?: string };
}

const initialState: SocialState = {
  activeTab: 'local',
  localMessages: [],
  privateMessages: {},
  friends: [],
  selectedFriend: undefined,
  unreadMessages: 0,
  unreadFriendRequests: 0,
  friendRequests: [],
  lastNotification: undefined,
};

const socialSlice = createSlice({
  name: 'social',
  initialState,
  reducers: {
    setActiveTab: (state, action: PayloadAction<'friends' | 'local' | 'private' | 'dextop'>) => {
      state.activeTab = action.payload;
    },
    addLocalMessage: (state, action: PayloadAction<{ message: Message; currentUserId: string }>) => {
      const { message, currentUserId } = action.payload;
      state.localMessages.push(message);
      if (message.senderId !== currentUserId) {
        state.unreadMessages += 1;
        state.lastNotification = { tab: 'local' };
      }
    },
    addPrivateMessage: (state, action: PayloadAction<{ message: Message; currentUserId: string }>) => {
      const { message, currentUserId } = action.payload;
      const friendId = message.senderId === currentUserId 
        ? message.recipientId 
        : message.senderId;
      
      if (friendId) {
        if (!state.privateMessages[friendId]) {
          state.privateMessages[friendId] = [];
        }
        state.privateMessages[friendId].push(message);
      }
      if (message.senderId !== currentUserId) {
        state.unreadMessages += 1;
        state.lastNotification = { tab: 'private', friendId };
      }
    },
    updateFriends: (state, action: PayloadAction<Friend[]>) => {
      state.friends = action.payload;
    },
    setSelectedFriend: (state, action: PayloadAction<string | undefined>) => {
      state.selectedFriend = action.payload;
    },
    clearUnreadMessages: (state) => {
      state.unreadMessages = 0;
      state.lastNotification = undefined;
    },
    addFriendRequest: (state, action: PayloadAction<FriendRequest>) => {
      if (!state.friendRequests.find((req) => req.id === action.payload.id)) {
        state.friendRequests.push(action.payload);
        state.unreadFriendRequests += 1;
        state.lastNotification = { tab: 'friends' };
      }
    },
    removeFriendRequest: (state, action: PayloadAction<string>) => {
      state.friendRequests = state.friendRequests.filter((req) => req.id !== action.payload);
      state.unreadFriendRequests = Math.max(0, state.unreadFriendRequests - 1);
      if (state.unreadFriendRequests === 0) {
        state.lastNotification = undefined;
      }
    },
    clearFriendRequestNotifications: (state) => {
      state.unreadFriendRequests = 0;
      state.lastNotification = undefined;
    },
    restoreFromProgramState: (state, action: PayloadAction<Partial<SocialState>>) => {
      Object.assign(state, action.payload);
    },
  },
});

export const {
  setActiveTab,
  addLocalMessage,
  addPrivateMessage,
  updateFriends,
  setSelectedFriend,
  clearUnreadMessages,
  addFriendRequest,
  removeFriendRequest,
  clearFriendRequestNotifications,
  restoreFromProgramState,
} = socialSlice.actions;

export default socialSlice.reducer; 