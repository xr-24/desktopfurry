const express = require('express');
const router = express.Router();
const { db } = require('../database');
const authService = require('../auth');

// Apply authentication middleware to all routes
router.use(authService.authenticateToken);

// GET /api/social/unread-counts - Get unread message and friend request counts
router.get('/unread-counts', async (req, res) => {
  try {
    const userId = req.user.userId;
    const counts = await db.getUnreadCounts(userId);
    res.json({ success: true, ...counts });
  } catch (error) {
    console.error('Error getting unread counts:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/social/messages - Get recent messages for user
router.get('/messages', async (req, res) => {
  try {
    const userId = req.user.userId;
    const limit = parseInt(req.query.limit) || 50;
    const messages = await db.getRecentMessages(userId, limit);
    res.json({ success: true, messages });
  } catch (error) {
    console.error('Error getting messages:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/social/unread-messages - Get unread messages
router.get('/unread-messages', async (req, res) => {
  try {
    const userId = req.user.userId;
    const messages = await db.getUnreadMessages(userId);
    res.json({ success: true, messages });
  } catch (error) {
    console.error('Error getting unread messages:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/social/messages/mark-read - Mark messages as read
router.post('/messages/mark-read', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { messageIds } = req.body;
    
    if (!Array.isArray(messageIds)) {
      return res.status(400).json({ success: false, error: 'messageIds must be an array' });
    }
    
    await db.markMessagesAsRead(userId, messageIds);
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/social/friend-requests - Get pending friend requests
router.get('/friend-requests', async (req, res) => {
  try {
    const userId = req.user.userId;
    const requests = await db.getPendingFriendRequests(userId);
    res.json({ success: true, requests });
  } catch (error) {
    console.error('Error getting friend requests:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/social/friend-requests/:requestId/respond - Accept or reject friend request
router.post('/friend-requests/:requestId/respond', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { requestId } = req.params;
    const { action } = req.body; // 'accept' or 'reject'
    
    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, error: 'Action must be accept or reject' });
    }
    
    // Get the request to verify ownership and get sender info
    const requests = await db.getPendingFriendRequests(userId);
    const request = requests.find(r => r.id === requestId);
    
    if (!request) {
      return res.status(404).json({ success: false, error: 'Friend request not found' });
    }
    
    const status = action === 'accept' ? 'accepted' : 'rejected';
    await db.updateFriendRequestStatus(requestId, status);
    
    if (action === 'accept') {
      // Add friendship in both directions
      await db.addFriend(userId, request.from_user_id);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error responding to friend request:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router; 