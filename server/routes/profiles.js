const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { authenticateToken } = require('../auth');

// GET /api/profiles/me - Get current user's profile
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // First check if user profile exists, if not create it
    let profile = await db.query(`
      SELECT 
        up.*,
        u.username,
        COALESCE(aa.hue, 0) as hue, 
        COALESCE(aa.eyes, 'none') as eyes, 
        COALESCE(aa.ears, 'none') as ears, 
        COALESCE(aa.fluff, 'none') as fluff, 
        COALESCE(aa.tail, 'none') as tail, 
        COALESCE(aa.body, 'CustomBase') as body
      FROM user_profiles up
      JOIN users u ON up.user_id = u.id
      LEFT JOIN avatar_appearances aa ON up.user_id = aa.user_id
      WHERE up.user_id = $1
    `, [userId]);

    if (profile.rows.length === 0) {
      // Create profile if it doesn't exist
      await db.query(`
        INSERT INTO user_profiles (user_id, biography, interest_tags, privacy_setting)
        VALUES ($1, '', '', 'public')
      `, [userId]);
      
      // Try again
      profile = await db.query(`
        SELECT 
          up.*,
          u.username,
          COALESCE(aa.hue, 0) as hue, 
          COALESCE(aa.eyes, 'none') as eyes, 
          COALESCE(aa.ears, 'none') as ears, 
          COALESCE(aa.fluff, 'none') as fluff, 
          COALESCE(aa.tail, 'none') as tail, 
          COALESCE(aa.body, 'CustomBase') as body
        FROM user_profiles up
        JOIN users u ON up.user_id = u.id
        LEFT JOIN avatar_appearances aa ON up.user_id = aa.user_id
        WHERE up.user_id = $1
      `, [userId]);
    }

    res.json({ success: true, profile: profile.rows[0] });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// PUT /api/profiles/me - Update current user's profile
router.put('/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { biography, profile_background_id, interest_tags, privacy_setting } = req.body;

    // Validate input
    if (biography && biography.length > 500) {
      return res.status(400).json({ success: false, error: 'Biography too long (max 500 characters)' });
    }
    
    if (interest_tags && interest_tags.length > 200) {
      return res.status(400).json({ success: false, error: 'Interest tags too long (max 200 characters)' });
    }

    if (privacy_setting && !['public', 'friends', 'private'].includes(privacy_setting)) {
      return res.status(400).json({ success: false, error: 'Invalid privacy setting' });
    }

    // Update profile
    const result = await db.query(`
      UPDATE user_profiles 
      SET 
        biography = COALESCE($2, biography),
        profile_background_id = COALESCE($3, profile_background_id),
        interest_tags = COALESCE($4, interest_tags),
        privacy_setting = COALESCE($5, privacy_setting),
        updated_at = NOW()
      WHERE user_id = $1
      RETURNING *
    `, [userId, biography, profile_background_id, interest_tags, privacy_setting]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Profile not found' });
    }

    res.json({ success: true, profile: result.rows[0] });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/profiles/search - Search profiles
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { q = '', page = 1 } = req.query;
    const limit = 20;
    const offset = (parseInt(page) - 1) * limit;

    // Get user's friends for privacy filtering
    const friendsResult = await db.query(`
      SELECT friend_id FROM friendships WHERE user_id = $1
      UNION
      SELECT user_id FROM friendships WHERE friend_id = $1
    `, [userId]);
    
    const friendIds = friendsResult.rows.map(row => row.friend_id || row.user_id);
    const friendIdsStr = friendIds.length > 0 ? friendIds.map(id => `'${id}'`).join(',') : "''";

    // Build search query
    let searchCondition = '';
    let searchParams = [userId, limit, offset];
    
    if (q.trim()) {
      // Split search terms by comma and search in both username and interest_tags
      const terms = q.split(',').map(term => term.trim()).filter(term => term.length > 0);
      const searchClauses = terms.map((term, index) => {
        searchParams.push(`%${term}%`);
        const paramIndex = searchParams.length;
        return `(u.username ILIKE $${paramIndex} OR up.interest_tags ILIKE $${paramIndex})`;
      });
      
      if (searchClauses.length > 0) {
        searchCondition = `AND (${searchClauses.join(' OR ')})`;
      }
    }

    // Search profiles with privacy filtering
    const searchQuery = `
      SELECT 
        up.*,
        u.username,
        aa.hue, aa.eyes, aa.ears, aa.fluff, aa.tail, aa.body,
        CASE 
          WHEN up.user_id = $1 THEN true
          WHEN up.user_id IN (${friendIdsStr}) THEN true
          ELSE false
        END as is_friend
      FROM user_profiles up
      JOIN users u ON up.user_id = u.id
      LEFT JOIN avatar_appearances aa ON up.user_id = aa.user_id
      WHERE (
        up.privacy_setting = 'public' OR
        (up.privacy_setting = 'friends' AND up.user_id IN (${friendIdsStr})) OR
        up.user_id = $1
      )
      ${searchCondition}
      ORDER BY 
        CASE WHEN up.user_id = $1 THEN 0 ELSE 1 END,
        up.updated_at DESC
      LIMIT $2 OFFSET $3
    `;

    const profiles = await db.query(searchQuery, searchParams);

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM user_profiles up
      JOIN users u ON up.user_id = u.id
      WHERE (
        up.privacy_setting = 'public' OR
        (up.privacy_setting = 'friends' AND up.user_id IN (${friendIdsStr})) OR
        up.user_id = $1
      )
      ${searchCondition}
    `;

    const countResult = await db.query(countQuery, [userId, ...searchParams.slice(3)]);
    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      profiles: profiles.rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalResults: total,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('Error searching profiles:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/profiles/:userId - Get specific user's profile
router.get('/:userId', authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const targetUserId = req.params.userId;

    // Check if users are friends
    const friendshipResult = await db.query(`
      SELECT 1 FROM friendships 
      WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)
    `, [currentUserId, targetUserId]);
    
    const areFriends = friendshipResult.rows.length > 0;
    const isSelf = currentUserId === targetUserId;

    // Get profile with privacy check
    const profile = await db.query(`
      SELECT 
        up.*,
        u.username,
        aa.hue, aa.eyes, aa.ears, aa.fluff, aa.tail, aa.body
      FROM user_profiles up
      JOIN users u ON up.user_id = u.id
      LEFT JOIN avatar_appearances aa ON up.user_id = aa.user_id
      WHERE up.user_id = $1
      AND (
        up.privacy_setting = 'public' OR
        (up.privacy_setting = 'friends' AND $2) OR
        $3
      )
    `, [targetUserId, areFriends, isSelf]);

    if (profile.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Profile not found or private' });
    }

    res.json({ success: true, profile: profile.rows[0] });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
