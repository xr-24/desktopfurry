const express = require('express');
const { db } = require('../database');
const authService = require('../auth');

const router = express.Router();

// Get user's fish
router.get('/', authService.verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    
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
router.post('/', authService.verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { fish_type, fish_name, tank_background } = req.body;

    // Validate required fields
    if (!fish_type || !fish_name || !tank_background) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if user already has a fish
    const existingFish = await db.query(
      'SELECT id FROM user_fish WHERE user_id = $1',
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
    const result = await db.query(`
      INSERT INTO user_fish (user_id, fish_type, fish_name, tank_background)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [userId, fish_type, fish_name.trim(), tank_background]);

    res.json({ fish: result.rows[0] });
  } catch (error) {
    console.error('Error creating fish:', error);
    res.status(500).json({ error: 'Failed to create fish' });
  }
});

// Feed fish
router.put('/feed', authService.verifyToken, async (req, res) => {
  try {
    const userId = req.userId;

    const result = await db.query(`
      UPDATE user_fish 
      SET 
        hunger_level = LEAST(100, hunger_level + 20),
        last_fed = NOW(),
        updated_at = NOW()
      WHERE user_id = $1
      RETURNING hunger_level, last_fed
    `, [userId]);

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
router.put('/clean', authService.verifyToken, async (req, res) => {
  try {
    const userId = req.userId;

    const result = await db.query(`
      UPDATE user_fish 
      SET 
        tank_cleanliness = LEAST(100, tank_cleanliness + 25),
        last_cleaned = NOW(),
        updated_at = NOW()
      WHERE user_id = $1
      RETURNING tank_cleanliness, last_cleaned
    `, [userId]);

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

// Delete fish (if needed for resetting)
router.delete('/', authService.verifyToken, async (req, res) => {
  try {
    const userId = req.userId;

    const result = await db.query(
      'DELETE FROM user_fish WHERE user_id = $1 RETURNING *',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Fish not found' });
    }

    res.json({ message: 'Fish deleted successfully' });
  } catch (error) {
    console.error('Error deleting fish:', error);
    res.status(500).json({ error: 'Failed to delete fish' });
  }
});

// Update fish position (for movement animation sync)
router.put('/move', authService.verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { fish_x, fish_y } = req.body;

    // Validate coordinates
    if (fish_x < 0 || fish_x > 100 || fish_y < 0 || fish_y > 100) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    const result = await db.query(`
      UPDATE user_fish 
      SET 
        fish_x = $2,
        fish_y = $3,
        updated_at = NOW()
      WHERE user_id = $1
      RETURNING fish_x, fish_y
    `, [userId, fish_x, fish_y]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Fish not found' });
    }

    res.json({ 
      fish_x: result.rows[0].fish_x,
      fish_y: result.rows[0].fish_y
    });
  } catch (error) {
    console.error('Error updating fish position:', error);
    res.status(500).json({ error: 'Failed to update fish position' });
  }
});

// Debug/testing endpoint to manually decay fish stats
router.post('/decay', authService.verifyToken, async (req, res) => {
  try {
    const userId = req.userId;

    const result = await db.query(`
      UPDATE user_fish 
      SET 
        hunger_level = GREATEST(0, hunger_level - 10),
        tank_cleanliness = GREATEST(0, tank_cleanliness - 15),
        updated_at = NOW()
      WHERE user_id = $1
      RETURNING hunger_level, tank_cleanliness
    `, [userId]);

    if (result.rows.length === 0) {
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