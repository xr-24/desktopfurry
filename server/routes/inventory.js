const express = require('express');
const router = express.Router();
const { db } = require('../database');
const authService = require('../auth');

// Get user's inventory (titles, items, money, current selections)
router.get('/', authService.authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Get user data including money and current selections
    const userResult = await db.query(`
      SELECT money, current_title_id, current_item_ids 
      FROM users 
      WHERE id = $1
    `, [userId]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userData = userResult.rows[0];
    
    // Get user's unlocked titles
    const titlesResult = await db.query(`
      SELECT t.*, ut.unlocked_at
      FROM titles t
      JOIN user_titles ut ON t.id = ut.title_id
      WHERE ut.user_id = $1 AND t.is_active = true
      ORDER BY ut.unlocked_at ASC
    `, [userId]);
    
    // Get user's unlocked items
    const itemsResult = await db.query(`
      SELECT i.*, ui.unlocked_at
      FROM items i
      JOIN user_items ui ON i.id = ui.item_id
      WHERE ui.user_id = $1 AND i.is_active = true
      ORDER BY ui.unlocked_at ASC
    `, [userId]);
    
    res.json({
      money: userData.money || 1000,
      currentTitleId: userData.current_title_id,
      currentItemIds: userData.current_item_ids || [],
      titles: titlesResult.rows,
      items: itemsResult.rows
    });
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({ error: 'Failed to load inventory' });
  }
});

// Update current title
router.post('/title', authService.authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { titleId } = req.body;
    
    // Validate title ownership if titleId is not null
    if (titleId) {
      const titleCheck = await db.query(`
        SELECT 1 FROM user_titles ut
        JOIN titles t ON ut.title_id = t.id
        WHERE ut.user_id = $1 AND ut.title_id = $2 AND t.is_active = true
      `, [userId, titleId]);
      
      if (titleCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Title not owned or invalid' });
      }
    }
    
    // Update current title
    await db.query(`
      UPDATE users 
      SET current_title_id = $1 
      WHERE id = $2
    `, [titleId, userId]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating current title:', error);
    res.status(500).json({ error: 'Failed to update title' });
  }
});

// Update current items
router.post('/items', authService.authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { itemIds } = req.body;
    
    if (!Array.isArray(itemIds)) {
      return res.status(400).json({ error: 'Item IDs must be an array' });
    }
    
    // Validate all item ownership
    if (itemIds.length > 0) {
      const itemCheck = await db.query(`
        SELECT COUNT(*) as count
        FROM user_items ui
        JOIN items i ON ui.item_id = i.id
        WHERE ui.user_id = $1 AND ui.item_id = ANY($2) AND i.is_active = true
      `, [userId, itemIds]);
      
      if (parseInt(itemCheck.rows[0].count) !== itemIds.length) {
        return res.status(400).json({ error: 'Some items not owned or invalid' });
      }
    }
    
    // Update current items
    await db.query(`
      UPDATE users 
      SET current_item_ids = $1 
      WHERE id = $2
    `, [JSON.stringify(itemIds), userId]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating current items:', error);
    res.status(500).json({ error: 'Failed to update items' });
  }
});

// Purchase item (for future store functionality)
router.post('/purchase/item', authService.authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { itemId } = req.body;
    
    // Check if item exists and get cost
    const itemResult = await db.query(`
      SELECT cost FROM items 
      WHERE id = $1 AND is_active = true
    `, [itemId]);
    
    if (itemResult.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    const itemCost = itemResult.rows[0].cost;
    
    // Check if user already owns the item
    const ownershipCheck = await db.query(`
      SELECT 1 FROM user_items 
      WHERE user_id = $1 AND item_id = $2
    `, [userId, itemId]);
    
    if (ownershipCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Item already owned' });
    }
    
    // Check if user has enough money
    const userResult = await db.query(`
      SELECT money FROM users WHERE id = $1
    `, [userId]);
    
    const userMoney = userResult.rows[0]?.money || 0;
    
    if (userMoney < itemCost) {
      return res.status(400).json({ error: 'Insufficient funds' });
    }
    
    // Begin transaction
    await db.query('BEGIN');
    
    try {
      // Deduct money
      await db.query(`
        UPDATE users 
        SET money = money - $1 
        WHERE id = $2
      `, [itemCost, userId]);
      
      // Grant item
      await db.query(`
        INSERT INTO user_items (user_id, item_id) 
        VALUES ($1, $2)
      `, [userId, itemId]);
      
      await db.query('COMMIT');
      
      res.json({ success: true });
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error purchasing item:', error);
    res.status(500).json({ error: 'Failed to purchase item' });
  }
});

// Purchase title (for future store functionality)
router.post('/purchase/title', authService.authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { titleId } = req.body;
    
    // Check if title exists and get cost
    const titleResult = await db.query(`
      SELECT cost FROM titles 
      WHERE id = $1 AND is_active = true
    `, [titleId]);
    
    if (titleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Title not found' });
    }
    
    const titleCost = titleResult.rows[0].cost;
    
    // Check if user already owns the title
    const ownershipCheck = await db.query(`
      SELECT 1 FROM user_titles 
      WHERE user_id = $1 AND title_id = $2
    `, [userId, titleId]);
    
    if (ownershipCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Title already owned' });
    }
    
    // Check if user has enough money
    const userResult = await db.query(`
      SELECT money FROM users WHERE id = $1
    `, [userId]);
    
    const userMoney = userResult.rows[0]?.money || 0;
    
    if (userMoney < titleCost) {
      return res.status(400).json({ error: 'Insufficient funds' });
    }
    
    // Begin transaction
    await db.query('BEGIN');
    
    try {
      // Deduct money
      await db.query(`
        UPDATE users 
        SET money = money - $1 
        WHERE id = $2
      `, [titleCost, userId]);
      
      // Grant title
      await db.query(`
        INSERT INTO user_titles (user_id, title_id) 
        VALUES ($1, $2)
      `, [userId, titleId]);
      
      await db.query('COMMIT');
      
      res.json({ success: true });
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error purchasing title:', error);
    res.status(500).json({ error: 'Failed to purchase title' });
  }
});

// Grant a special title to the current user (used by secret terminal codes)
router.post('/grant-title', authService.authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { titleName, styleConfig } = req.body;

    if (!titleName) {
      return res.status(400).json({ success: false, error: 'titleName required' });
    }

    // Ensure title exists in titles table
    const existingTitle = await db.query('SELECT id FROM titles WHERE name = $1', [titleName]);
    let titleId;
    if (existingTitle.rows.length === 0) {
      const newTitle = await db.query(
        `INSERT INTO titles (name, style_config, cost, description, is_active)
         VALUES ($1, $2, 0, 'Special title', true)
         RETURNING id`,
        [titleName, JSON.stringify(styleConfig || {})]
      );
      titleId = newTitle.rows[0].id;
    } else {
      titleId = existingTitle.rows[0].id;
    }

    // Grant title to user if not already
    await db.query(
      `INSERT INTO user_titles (user_id, title_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, title_id) DO NOTHING`,
      [userId, titleId]
    );

    // Optionally set as current title
    await db.query('UPDATE users SET current_title_id = $1 WHERE id = $2', [titleId, userId]);

    res.json({ success: true, titleId });
  } catch (error) {
    console.error('Error granting title:', error);
    res.status(500).json({ success: false, error: 'Failed to grant title' });
  }
});

// Adjust money (earn or spend)
router.post('/money', authService.authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    let { amount } = req.body;
    amount = Number(amount);
    if (isNaN(amount)) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Update money (can be positive or negative but prevent going below zero)
    await db.query(`
      UPDATE users 
      SET money = GREATEST(0, money + $1) 
      WHERE id = $2
    `, [amount, userId]);

    const result = await db.query(`SELECT money FROM users WHERE id = $1`, [userId]);
    res.json({ success: true, newBalance: result.rows[0].money });
  } catch (error) {
    console.error('Error adjusting money:', error);
    res.status(500).json({ error: 'Failed to adjust money' });
  }
});

module.exports = router; 