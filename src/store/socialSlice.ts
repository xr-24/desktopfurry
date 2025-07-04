import { createSlice, PayloadAction } from '@reduxjs/toolkit';

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

interface SocialState {
  activeTab: 'friends' | 'local' | 'private' | 'dextop';
  localMessages: Message[];
  privateMessages: { [friendId: string]: Message[] };
  friends: Friend[];
  selectedFriend?: string;
}

const initialState: SocialState = {
  activeTab: 'local',
  localMessages: [],
  privateMessages: {},
  friends: [],
  selectedFriend: undefined,
};

const socialSlice = createSlice({
  name: 'social',
  initialState,
  reducers: {
    setActiveTab: (state, action: PayloadAction<'friends' | 'local' | 'private' | 'dextop'>) => {
      state.activeTab = action.payload;
    },
    addLocalMessage: (state, action: PayloadAction<Message>) => {
      state.localMessages.push(action.payload);
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
    },
    updateFriends: (state, action: PayloadAction<Friend[]>) => {
      state.friends = action.payload;
    },
    setSelectedFriend: (state, action: PayloadAction<string | undefined>) => {
      state.selectedFriend = action.payload;
    },
    // Migration action to restore from old program state
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
  restoreFromProgramState,
} = socialSlice.actions;

export default socialSlice.reducer; 