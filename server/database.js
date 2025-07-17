const { Pool } = require('pg');
require('dotenv').config();

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Test the connection
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Database connection error:', err);
  process.exit(-1);
});

// Database helper functions
const db = {
  // Generic query function
  query: (text, params) => pool.query(text, params),

  // User functions
  async createUser(username, email = null, passwordHash = null, guestToken = null) {
    const userType = email ? 'registered' : 'guest';
    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, guest_token, user_type) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [username, email, passwordHash, guestToken, userType]
    );
    return result.rows[0];
  },

  async findUserByEmail(email) {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0];
  },

  async findUserByGuestToken(token) {
    const result = await pool.query('SELECT * FROM users WHERE guest_token = $1', [token]);
    return result.rows[0];
  },

  async findUserById(id) {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0];
  },

  async updateUserLastActive(userId) {
    await pool.query('UPDATE users SET last_active = NOW() WHERE id = $1', [userId]);
  },

  // Friend functions
  async findUserByUsername(username) {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    return result.rows[0];
  },

  async addFriend(userId1, userId2) {
    // Add friendship in both directions
    await pool.query(`
      INSERT INTO friendships (user_id, friend_id, created_at)
      VALUES ($1, $2, NOW()), ($2, $1, NOW())
      ON CONFLICT (user_id, friend_id) DO NOTHING
    `, [userId1, userId2]);
  },

  async removeFriend(userId1, userId2) {
    // Remove friendship in both directions
    await pool.query(`
      DELETE FROM friendships 
      WHERE (user_id = $1 AND friend_id = $2)
         OR (user_id = $2 AND friend_id = $1)
    `, [userId1, userId2]);
  },

  async getUserFriends(userId) {
    const result = await pool.query(`
      SELECT u.id, u.username, u.last_active
      FROM friendships f
      JOIN users u ON f.friend_id = u.id
      WHERE f.user_id = $1
      ORDER BY u.username
    `, [userId]);
    return result.rows;
  },

  async areFriends(userId1, userId2) {
    const result = await pool.query(`
      SELECT 1 FROM friendships
      WHERE user_id = $1 AND friend_id = $2
    `, [userId1, userId2]);
    return result.rows.length > 0;
  },

  // Dextop functions
  async getUserDextop(userId) {
    let result = await pool.query(`
      SELECT d.*, aa.hue, aa.eyes, aa.ears, aa.fluff, aa.tail, aa.body
      FROM dextops d
      LEFT JOIN avatar_appearances aa ON d.user_id = aa.user_id
      WHERE d.user_id = $1
    `, [userId]);

    // Auto-create a basic dextop row if none exists
    if (result.rows.length === 0) {
      const insert = await pool.query(`
        INSERT INTO dextops (user_id, name, background_id, is_public, allow_visitors, allow_visitor_interaction, visit_count, created_at, updated_at)
        VALUES ($1, $2, 'sandstone', false, true, true, 0, NOW(), NOW())
        RETURNING *
      `, [userId, 'My Dextop']);
      result = await pool.query(`
        SELECT d.*, aa.hue, aa.eyes, aa.ears, aa.fluff, aa.tail, aa.body
        FROM dextops d
        LEFT JOIN avatar_appearances aa ON d.user_id = aa.user_id
        WHERE d.user_id = $1
      `, [userId]);
    }
    return result.rows[0];
  },

  async getDextopPrograms(dextopId) {
    const result = await pool.query(`
      SELECT * FROM program_states 
      WHERE dextop_id = $1 
      ORDER BY z_index ASC
    `, [dextopId]);
    return result.rows;
  },

  async saveProgramState(dextopId, programType, position, size, zIndex, isMinimized, programData) {
    await pool.query(`
      INSERT INTO program_states (dextop_id, program_type, position_x, position_y, width, height, z_index, is_minimized, program_data)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (dextop_id, program_type) 
      DO UPDATE SET 
        position_x = EXCLUDED.position_x,
        position_y = EXCLUDED.position_y,
        width = EXCLUDED.width,
        height = EXCLUDED.height,
        z_index = EXCLUDED.z_index,
        is_minimized = EXCLUDED.is_minimized,
        program_data = EXCLUDED.program_data,
        updated_at = NOW()
    `, [dextopId, programType, position.x, position.y, size.width, size.height, zIndex, isMinimized, JSON.stringify(programData)]);
  },

  async deleteProgramState(dextopId, programType) {
    await pool.query(
      'DELETE FROM program_states WHERE dextop_id = $1 AND program_type = $2',
      [dextopId, programType]
    );
  },

  async updateDextopBackground(userId, backgroundId) {
    await pool.query(
      'UPDATE dextops SET background_id = $1, updated_at = NOW() WHERE user_id = $2',
      [backgroundId, userId]
    );
  },

  // Avatar functions
  async updateAvatarAppearance(userId, appearance) {
    await pool.query(`
      INSERT INTO avatar_appearances (user_id, hue, eyes, ears, fluff, tail, body, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        hue   = EXCLUDED.hue,
        eyes  = EXCLUDED.eyes,
        ears  = EXCLUDED.ears,
        fluff = EXCLUDED.fluff,
        tail  = EXCLUDED.tail,
        body  = EXCLUDED.body,
        updated_at = NOW();
    `, [userId, appearance.hue, appearance.eyes, appearance.ears, appearance.fluff, appearance.tail, appearance.body]);
  },

  // Achievement functions
  async getUserAchievements(userId) {
    const result = await pool.query(`
      SELECT a.*, ua.unlocked_at
      FROM achievements a
      JOIN user_achievements ua ON a.id = ua.achievement_id
      WHERE ua.user_id = $1
      ORDER BY ua.unlocked_at DESC
    `, [userId]);
    return result.rows;
  },

  async unlockAchievement(userId, achievementCode) {
    const achievement = await pool.query(
      'SELECT id FROM achievements WHERE code = $1',
      [achievementCode]
    );
    
    if (achievement.rows.length > 0) {
      try {
        await pool.query(
          'INSERT INTO user_achievements (user_id, achievement_id) VALUES ($1, $2)',
          [userId, achievement.rows[0].id]
        );
        return true;
      } catch (error) {
        // Achievement already unlocked
        return false;
      }
    }
    return false;
  },

  async getUnlockedPrograms(userId) {
    const result = await pool.query(`
      SELECT DISTINCT a.unlocks_program
      FROM achievements a
      JOIN user_achievements ua ON a.id = ua.achievement_id
      WHERE ua.user_id = $1 AND a.unlocks_program IS NOT NULL
    `, [userId]);
    return result.rows.map(row => row.unlocks_program);
  },

  // Visit tracking
  async recordDextopVisit(dextopId, visitorUserId) {
    await pool.query(`
      INSERT INTO dextop_visits (dextop_id, visitor_user_id)
      VALUES ($1, $2)
      ON CONFLICT (dextop_id, visitor_user_id, visited_at) DO NOTHING
    `, [dextopId, visitorUserId]);

    // Update visit count
    await pool.query(
      'UPDATE dextops SET visit_count = visit_count + 1 WHERE id = $1',
      [dextopId]
    );
  },

  async searchUsers(query) {
    const like = `%${query}%`;
    const result = await pool.query(
      'SELECT id, username FROM users WHERE LOWER(username) LIKE LOWER($1) ORDER BY username LIMIT 20',
      [like]
    );
    return result.rows;
  },

  // Message functions
  async saveMessage(senderId, recipientId, content, messageType, senderChatColor = 0) {
    const result = await pool.query(`
      INSERT INTO messages (sender_id, recipient_id, content, message_type, sender_chat_color)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, created_at
    `, [senderId, recipientId, content, messageType, senderChatColor]);
    return result.rows[0];
  },

  async getUnreadMessages(userId) {
    const result = await pool.query(`
      SELECT m.*, u.username as sender_username
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.recipient_id = $1 AND m.is_read = false
      ORDER BY m.created_at ASC
    `, [userId]);
    return result.rows;
  },

  async getRecentMessages(userId, limit = 50) {
    const result = await pool.query(`
      SELECT m.*, u.username as sender_username, u.id as sender_id
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.recipient_id = $1 OR m.sender_id = $1
      ORDER BY m.created_at ASC
      LIMIT $2
    `, [userId, limit]);
    return result.rows; // Already in chronological order
  },

  async markMessagesAsRead(userId, messageIds) {
    if (messageIds.length === 0) return;
    await pool.query(`
      UPDATE messages 
      SET is_read = true 
      WHERE id = ANY($1) AND recipient_id = $2
    `, [messageIds, userId]);
  },

  // Friend request functions
  async saveFriendRequest(fromUserId, toUserId) {
    const result = await pool.query(`
      INSERT INTO friend_requests (from_user_id, to_user_id)
      VALUES ($1, $2)
      ON CONFLICT (from_user_id, to_user_id) DO NOTHING
      RETURNING id, created_at
    `, [fromUserId, toUserId]);
    return result.rows[0];
  },

  async getPendingFriendRequests(userId) {
    const result = await pool.query(`
      SELECT fr.*, u.username as from_username
      FROM friend_requests fr
      JOIN users u ON fr.from_user_id = u.id
      WHERE fr.to_user_id = $1 AND fr.status = 'pending'
      ORDER BY fr.created_at ASC
    `, [userId]);
    return result.rows;
  },

  async updateFriendRequestStatus(requestId, status) {
    await pool.query(`
      UPDATE friend_requests 
      SET status = $1, responded_at = NOW()
      WHERE id = $2
    `, [status, requestId]);
  },

  async getUnreadCounts(userId) {
    const [messageCount, requestCount] = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM messages WHERE recipient_id = $1 AND is_read = false', [userId]),
      pool.query('SELECT COUNT(*) as count FROM friend_requests WHERE to_user_id = $1 AND status = \'pending\'', [userId])
    ]);
    
    return {
      unreadMessages: parseInt(messageCount.rows[0].count),
      unreadFriendRequests: parseInt(requestCount.rows[0].count)
    };
  },
};

module.exports = { pool, db }; 