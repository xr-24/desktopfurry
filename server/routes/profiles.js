const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { authenticateToken } = require('../auth');

// GET /api/profiles/me - Get current user's profile
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    console.log('Fetching profile for user:', userId);
    
    // First check if user profile exists, if not create it
    let profile;
    try {
      profile = await db.query(`
        SELECT 
          up.*,
          u.username,
          u.current_title_id,
          u.current_item_ids,
          COALESCE(aa.hue, 0) as hue, 
          COALESCE(aa.eyes, 'none') as eyes, 
          COALESCE(aa.ears, 'none') as ears, 
          COALESCE(aa.fluff, 'none') as fluff, 
          COALESCE(aa.tail, 'none') as tail, 
          COALESCE(aa.body, 'CustomBase') as body,
          COALESCE(up.avatar_crop_scale, 2.2) as avatar_crop_scale,
          COALESCE(up.avatar_crop_offset_x, -0.5) as avatar_crop_offset_x,
          COALESCE(up.avatar_crop_offset_y, -0.3) as avatar_crop_offset_y
        FROM user_profiles up
        JOIN users u ON up.user_id = u.id
        LEFT JOIN avatar_appearances aa ON up.user_id = aa.user_id
        WHERE up.user_id = $1
      `, [userId]);
      console.log('Profile query result:', profile.rows.length, 'rows');
    } catch (queryError) {
      console.error('Profile query failed:', queryError);
      return res.status(500).json({ 
        success: false, 
        error: 'Database query failed: ' + queryError.message 
      });
    }

    if (profile.rows.length === 0) {
      console.log('No profile found, creating one...');
      try {
        // Create profile if it doesn't exist
        await db.query(`
          INSERT INTO user_profiles (user_id, biography, interest_tags, privacy_setting)
          VALUES ($1, '', '', 'public')
        `, [userId]);
        console.log('Profile created successfully');
        
        // Try again
        profile = await db.query(`
          SELECT 
            up.*,
            u.username,
            u.current_title_id,
            u.current_item_ids,
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
        console.log('Profile refetch result:', profile.rows.length, 'rows');
      } catch (createError) {
        console.error('Profile creation failed:', createError);
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to create profile: ' + createError.message 
        });
      }
    }

    res.json({ success: true, profile: profile.rows[0] });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error: ' + error.message 
    });
  }
});

// PUT /api/profiles/me - Update current user's profile
router.put('/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { 
      biography, 
      profile_background_id, 
      interest_tags, 
      privacy_setting,
      avatar_crop_scale,
      avatar_crop_offset_x,
      avatar_crop_offset_y
    } = req.body;

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

    // Validate avatar crop values
    if (avatar_crop_scale !== undefined && (avatar_crop_scale < 1 || avatar_crop_scale > 5)) {
      return res.status(400).json({ success: false, error: 'Invalid avatar crop scale (must be between 1 and 5)' });
    }

    if (avatar_crop_offset_x !== undefined && (avatar_crop_offset_x < -2 || avatar_crop_offset_x > 2)) {
      return res.status(400).json({ success: false, error: 'Invalid avatar crop offset X (must be between -2 and 2)' });
    }

    if (avatar_crop_offset_y !== undefined && (avatar_crop_offset_y < -2 || avatar_crop_offset_y > 2)) {
      return res.status(400).json({ success: false, error: 'Invalid avatar crop offset Y (must be between -2 and 2)' });
    }

    console.log('Updating profile for user:', userId);
    console.log('Update data:', { biography, profile_background_id, interest_tags, privacy_setting, avatar_crop_scale, avatar_crop_offset_x, avatar_crop_offset_y });

    // Update profile
    const result = await db.query(`
      UPDATE user_profiles 
      SET 
        biography = COALESCE($2, biography),
        profile_background_id = COALESCE($3, profile_background_id),
        interest_tags = COALESCE($4, interest_tags),
        privacy_setting = COALESCE($5, privacy_setting),
        avatar_crop_scale = COALESCE($6, avatar_crop_scale),
        avatar_crop_offset_x = COALESCE($7, avatar_crop_offset_x),
        avatar_crop_offset_y = COALESCE($8, avatar_crop_offset_y),
        updated_at = NOW()
      WHERE user_id = $1
      RETURNING *
    `, [userId, biography, profile_background_id, interest_tags, privacy_setting, avatar_crop_scale, avatar_crop_offset_x, avatar_crop_offset_y]);

    console.log('Update result:', result.rows.length, 'rows affected');

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Profile not found' });
    }

    // Get the complete profile data including avatar appearance
    const completeProfile = await db.query(`
      SELECT 
        up.*,
        u.username,
        u.current_title_id,
        u.current_item_ids,
        COALESCE(aa.hue, 0) as hue, 
        COALESCE(aa.eyes, 'none') as eyes, 
        COALESCE(aa.ears, 'none') as ears, 
        COALESCE(aa.fluff, 'none') as fluff, 
        COALESCE(aa.tail, 'none') as tail, 
        COALESCE(aa.body, 'CustomBase') as body,
        COALESCE(up.avatar_crop_scale, 2.2) as avatar_crop_scale,
        COALESCE(up.avatar_crop_offset_x, -0.5) as avatar_crop_offset_x,
        COALESCE(up.avatar_crop_offset_y, -0.3) as avatar_crop_offset_y
      FROM user_profiles up
      JOIN users u ON up.user_id = u.id
      LEFT JOIN avatar_appearances aa ON up.user_id = aa.user_id
      WHERE up.user_id = $1
    `, [userId]);

    // Get equipped items details
    let equippedItems = [];
    if (completeProfile.rows[0]?.current_item_ids && completeProfile.rows[0].current_item_ids.length > 0) {
      const itemsResult = await db.query(`
        SELECT id, name, asset_path
        FROM items 
        WHERE id = ANY($1) AND is_active = true
      `, [completeProfile.rows[0].current_item_ids]);
      equippedItems = itemsResult.rows;
    }

    // Add equipped items to profile
    const profileWithItems = {
      ...completeProfile.rows[0],
      equippedItems
    };

    console.log('Complete profile data:', profileWithItems);

    res.json({ success: true, profile: profileWithItems });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/profiles/search - Search profiles
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { q = '', page = 1 } = req.query;
    const limit = 20;
    const offset = (parseInt(page) - 1) * limit;

    console.log('Search request:', { userId, q, page });

    // Get user's friends for privacy filtering
    const friendsResult = await db.query(`
      SELECT friend_id FROM friendships WHERE user_id = $1
      UNION
      SELECT user_id FROM friendships WHERE friend_id = $1
    `, [userId]);
    
    const friendIds = friendsResult.rows.map(row => row.friend_id || row.user_id);
    console.log('Friend IDs:', friendIds);

    // Build search query parameters
    let searchCondition = '';
    let searchParams = [userId];
    let friendsCondition = '';
    
    // Add friend IDs as parameters if any exist
    if (friendIds.length > 0) {
      const friendPlaceholders = friendIds.map((_, index) => `$${searchParams.length + index + 1}`).join(',');
      friendsCondition = `up.user_id IN (${friendPlaceholders})`;
      searchParams.push(...friendIds);
    } else {
      friendsCondition = 'FALSE'; // No friends, so friends condition is always false
    }
    
    if (q.trim()) {
      // Split search terms by comma and search in both username and interest_tags
      const terms = q.split(',').map(term => term.trim()).filter(term => term.length > 0);
      const searchClauses = terms.map((term) => {
        searchParams.push(`%${term}%`);
        const paramIndex = searchParams.length;
        return `(u.username ILIKE $${paramIndex} OR COALESCE(up.interest_tags, '') ILIKE $${paramIndex})`;
      });
      
      if (searchClauses.length > 0) {
        searchCondition = `AND (${searchClauses.join(' OR ')})`;
      }
    }

    // Add pagination parameters
    searchParams.push(limit, offset);
    const limitParam = searchParams.length - 1;
    const offsetParam = searchParams.length;

    // Search profiles with privacy filtering
    const searchQuery = `
      SELECT 
        up.*,
        u.username,
        u.current_title_id,
        u.current_item_ids,
        COALESCE(aa.hue, 0) as hue, 
        COALESCE(aa.eyes, 'none') as eyes, 
        COALESCE(aa.ears, 'none') as ears, 
        COALESCE(aa.fluff, 'none') as fluff, 
        COALESCE(aa.tail, 'none') as tail, 
        COALESCE(aa.body, 'CustomBase') as body,
        COALESCE(up.avatar_crop_scale, 2.2) as avatar_crop_scale,
        COALESCE(up.avatar_crop_offset_x, -0.5) as avatar_crop_offset_x,
        COALESCE(up.avatar_crop_offset_y, -0.3) as avatar_crop_offset_y,
        CASE 
          WHEN up.user_id = $1 THEN true
          WHEN ${friendsCondition} THEN true
          ELSE false
        END as is_friend
      FROM user_profiles up
      JOIN users u ON up.user_id = u.id
      LEFT JOIN avatar_appearances aa ON up.user_id = aa.user_id
      WHERE (
        up.privacy_setting = 'public' OR
        (up.privacy_setting = 'friends' AND (${friendsCondition})) OR
        up.user_id = $1
      )
      ${searchCondition}
      ORDER BY 
        CASE WHEN up.user_id = $1 THEN 0 ELSE 1 END,
        up.updated_at DESC
      LIMIT $${limitParam} OFFSET $${offsetParam}
    `;

    console.log('Search query:', searchQuery);
    console.log('Search params:', searchParams);

    const profiles = await db.query(searchQuery, searchParams);

    // Build count query with same conditions but without pagination
    const countParams = searchParams.slice(0, -2); // Remove limit and offset
    const countQuery = `
      SELECT COUNT(*) as total
      FROM user_profiles up
      JOIN users u ON up.user_id = u.id
      WHERE (
        up.privacy_setting = 'public' OR
        (up.privacy_setting = 'friends' AND (${friendsCondition})) OR
        up.user_id = $1
      )
      ${searchCondition}
    `;

    console.log('Count query:', countQuery);
    console.log('Count params:', countParams);

    const countResult = await db.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    console.log('Search results:', profiles.rows.length, 'profiles found');

    // Get equipped items for all profiles
    const profilesWithItems = await Promise.all(profiles.rows.map(async (profile) => {
      let equippedItems = [];
      if (profile.current_item_ids && profile.current_item_ids.length > 0) {
        const itemsResult = await db.query(`
          SELECT id, name, asset_path
          FROM items 
          WHERE id = ANY($1) AND is_active = true
        `, [profile.current_item_ids]);
        equippedItems = itemsResult.rows;
      }
      return {
        ...profile,
        equippedItems
      };
    }));

    res.json({
      success: true,
      profiles: profilesWithItems,
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
    console.error('Error stack:', error.stack);
    res.status(500).json({ success: false, error: 'Internal server error: ' + error.message });
  }
});

// GET /api/profiles/:userId - Get specific user's profile
router.get('/:userId', authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.userId;
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
