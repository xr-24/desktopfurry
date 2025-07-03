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
  }
};

module.exports = { pool, db }; 