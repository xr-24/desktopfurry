const express = require('express');
const { db } = require('../database');
const authService = require('../auth');

const router = express.Router();

// Get user's fish
router.get('/', authService.authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const result = await db.query(
      'SELECT * FROM user_fish WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.json({ fish: null });
    }

    res.json({ fish: result.rows[0] });
  } catch (error) {
    console.error('Error loading fish:', error);
    res.status(500).json({ error: 'Failed to load fish' });
  }
});

// Create new fish
router.post('/', authService.authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { fish_type, fish_name, tank_background } = req.body;
    
    console.log('CREATE FISH REQUEST - User ID:', userId);
    console.log('CREATE FISH REQUEST - Data:', { fish_type, fish_name, tank_background });

    // Validate required fields
    if (!fish_type || !fish_name || !tank_background) {
      console.log('CREATE FISH REQUEST - Missing required fields');
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if user already has a fish
    const existingFish = await db.query(
      'SELECT user_id FROM user_fish WHERE user_id = $1',
      [userId]
    );

    if (existingFish.rows.length > 0) {
      return res.status(400).json({ error: 'User already has a fish' });
    }

    // Validate fish_type
    const validFishTypes = ['fish1', 'fish2', 'fish3', 'fish4', 'fish5', 'fish6', 'fish7', 'fish8'];
    if (!validFishTypes.includes(fish_type)) {
      return res.status(400).json({ error: 'Invalid fish type' });
    }

    // Validate tank_background  
    const validTanks = ['tank-1', 'tank-2', 'tank-3', 'tank-4'];
    if (!validTanks.includes(tank_background)) {
      return res.status(400).json({ error: 'Invalid tank background' });
    }

    // Validate fish name length
    if (fish_name.trim().length === 0 || fish_name.length > 100) {
      return res.status(400).json({ error: 'Fish name must be 1-100 characters' });
    }

    // Create fish
    console.log('CREATE FISH REQUEST - About to insert fish into database');
    const result = await db.query(
      'INSERT INTO user_fish (user_id, fish_type, fish_name, tank_background) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, fish_type, fish_name.trim(), tank_background]
    );

    console.log('CREATE FISH REQUEST - Insert successful, rows:', result.rows.length);
    console.log('CREATE FISH REQUEST - Created fish:', result.rows[0]);
    res.json({ fish: result.rows[0] });
  } catch (error) {
    console.error('CREATE FISH REQUEST - Error creating fish:', error);
    res.status(500).json({ error: 'Failed to create fish' });
  }
});

// Feed fish
router.put('/feed', authService.authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await db.query(
      'UPDATE user_fish SET hunger_level = LEAST(100, hunger_level + 20), last_fed = NOW(), updated_at = NOW() WHERE user_id = $1 RETURNING hunger_level, last_fed',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Fish not found' });
    }

    res.json({ 
      hunger_level: result.rows[0].hunger_level,
      last_fed: result.rows[0].last_fed
    });
  } catch (error) {
    console.error('Error feeding fish:', error);
    res.status(500).json({ error: 'Failed to feed fish' });
  }
});

// Clean tank
router.put('/clean', authService.authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await db.query(
      'UPDATE user_fish SET tank_cleanliness = LEAST(100, tank_cleanliness + 25), last_cleaned = NOW(), updated_at = NOW() WHERE user_id = $1 RETURNING tank_cleanliness, last_cleaned',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Fish not found' });
    }

    res.json({ 
      tank_cleanliness: result.rows[0].tank_cleanliness,
      last_cleaned: result.rows[0].last_cleaned
    });
  } catch (error) {
    console.error('Error cleaning tank:', error);
    res.status(500).json({ error: 'Failed to clean tank' });
  }
});

// Clear/delete fish
router.delete('/clear', authService.authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const result = await db.query(
      'DELETE FROM user_fish WHERE user_id = $1 RETURNING fish_name',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Fish not found' });
    }

    res.json({ 
      message: 'Fish cleared successfully',
      fish_name: result.rows[0].fish_name
    });
  } catch (error) {
    console.error('Error clearing fish:', error);
    res.status(500).json({ error: 'Failed to clear fish' });
  }
});

// Debug endpoint to manually decay fish stats for testing
router.post('/decay', authService.authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    console.log('DECAY REQUEST - User ID:', userId);

    // First check if fish exists
    const checkResult = await db.query('SELECT * FROM user_fish WHERE user_id = $1', [userId]);
    console.log('DECAY REQUEST - Fish exists:', checkResult.rows.length > 0);
    console.log('DECAY REQUEST - Fish data:', checkResult.rows[0]);

    const result = await db.query(
      'UPDATE user_fish SET hunger_level = GREATEST(0, hunger_level - 10), tank_cleanliness = GREATEST(0, tank_cleanliness - 15), updated_at = NOW() WHERE user_id = $1 RETURNING hunger_level, tank_cleanliness',
      [userId]
    );

    if (result.rows.length === 0) {
      console.log('DECAY REQUEST - No fish found for user:', userId);
      return res.status(404).json({ error: 'Fish not found' });
    }

    res.json({ 
      message: 'Fish stats decayed',
      hunger_level: result.rows[0].hunger_level,
      tank_cleanliness: result.rows[0].tank_cleanliness
    });
  } catch (error) {
    console.error('Error decaying fish stats:', error);
    res.status(500).json({ error: 'Failed to decay fish stats' });
  }
});

module.exports = router; 