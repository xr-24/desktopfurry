import { store } from '../store/store';
import { loadOfflineData, markMessagesAsRead } from '../store/socialSlice';
import { authService } from './authService';

class OfflineDataService {
  private isInitialized = false;

  async initialize() {
    if (this.isInitialized) return;
    
    try {
      // Load offline data from API
      const [messages, friendRequests] = await Promise.all([
        authService.getUnreadMessages(),
        authService.getPendingFriendRequests()
      ]);

      // Transform data to match our interfaces
      const transformedMessages = messages.map(msg => ({
        id: msg.id,
        sender: msg.sender_username,
        senderId: msg.sender_id,
        content: msg.content,
        timestamp: new Date(msg.created_at).getTime(),
        type: 'private' as const,
        recipientId: msg.recipient_id,
        isRead: false
      }));

      const transformedRequests = friendRequests.map(req => ({
        id: req.id,
        from: req.from_user_id,
        username: req.from_username
      }));

      // Dispatch to store
      store.dispatch(loadOfflineData({
        messages: transformedMessages,
        friendRequests: transformedRequests
      }));

      this.isInitialized = true;
      console.log('Offline data loaded:', { messages: transformedMessages.length, requests: transformedRequests.length });
    } catch (error) {
      console.error('Failed to load offline data:', error);
    }
  }

  async markMessagesAsRead(messageIds: string[]) {
    try {
      const success = await authService.markMessagesAsRead(messageIds);
      if (success) {
        store.dispatch(markMessagesAsRead(messageIds));
      }
    } catch (error) {
      console.error('Failed to mark messages as read:', error);
    }
  }

  async respondToFriendRequest(requestId: string, action: 'accept' | 'reject') {
    try {
      return await authService.respondToFriendRequest(requestId, action);
    } catch (error) {
      console.error('Failed to respond to friend request:', error);
      return false;
    }
  }

  reset() {
    this.isInitialized = false;
  }
}

export const offlineDataService = new OfflineDataService(); 