const express = require('express');
const router = express.Router();
const { db } = require('../database');
const authService = require('../auth');

// Get all shop items organized by category
router.get('/items', authService.authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Get all active shop items
    const shopItemsResult = await db.query(`
      SELECT si.*, 
             CASE WHEN up.user_id IS NOT NULL THEN true ELSE false END as is_purchased
      FROM shop_items si
      LEFT JOIN user_purchases up ON si.id = up.shop_item_id AND up.user_id = $1
      WHERE si.is_active = true
      ORDER BY si.category, si.price ASC
    `, [userId]);
    
    // Get user's current money
    const userResult = await db.query(`
      SELECT money FROM users WHERE id = $1
    `, [userId]);
    
    const userMoney = userResult.rows[0]?.money || 0;
    
    // Organize items by category
    const itemsByCategory = {
      cosmetics: [],
      themes: [],
      backgrounds: [],
      games: [],
      titles: [],
      misc: []
    };
    
    shopItemsResult.rows.forEach(item => {
      if (itemsByCategory[item.category]) {
        itemsByCategory[item.category].push({
          id: item.id,
          name: item.name,
          description: item.description,
          price: item.price,
          asset_path: item.asset_path,
          metadata: item.metadata,
          item_type: item.item_type,
          is_purchased: item.is_purchased
        });
      }
    });
    
    res.json({
      items: itemsByCategory,
      userMoney
    });
  } catch (error) {
    console.error('Error fetching shop items:', error);
    res.status(500).json({ error: 'Failed to load shop items' });
  }
});

// Purchase an item
router.post('/purchase', authService.authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { itemId } = req.body;
    
    if (!itemId) {
      return res.status(400).json({ error: 'Item ID is required' });
    }
    
    // Start transaction
    await db.query('BEGIN');
    
    try {
      // Get item details and check if it exists
      const itemResult = await db.query(`
        SELECT * FROM shop_items 
        WHERE id = $1 AND is_active = true
      `, [itemId]);
      
      if (itemResult.rows.length === 0) {
        await db.query('ROLLBACK');
        return res.status(404).json({ error: 'Item not found' });
      }
      
      const item = itemResult.rows[0];
      
      // Check if user already owns this item
      const purchaseCheck = await db.query(`
        SELECT 1 FROM user_purchases 
        WHERE user_id = $1 AND shop_item_id = $2
      `, [userId, itemId]);
      
      if (purchaseCheck.rows.length > 0) {
        await db.query('ROLLBACK');
        return res.status(400).json({ error: 'Item already purchased' });
      }
      
      // Get user's current money
      const userResult = await db.query(`
        SELECT money FROM users WHERE id = $1
      `, [userId]);
      
      const userMoney = userResult.rows[0]?.money || 0;
      
      if (userMoney < item.price) {
        await db.query('ROLLBACK');
        return res.status(400).json({ error: 'Insufficient funds' });
      }
      
      // Deduct money from user
      await db.query(`
        UPDATE users 
        SET money = money - $1 
        WHERE id = $2
      `, [item.price, userId]);
      
      // Record the purchase
      await db.query(`
        INSERT INTO user_purchases (user_id, shop_item_id, price_paid) 
        VALUES ($1, $2, $3)
      `, [userId, itemId, item.price]);
      
      // If it's a cosmetic item, also add to user_items for inventory integration
      if (item.item_type === 'item') {
        // Check if this item exists in the items table, if not create it
        const existingItemResult = await db.query(`
          SELECT id FROM items WHERE name = $1
        `, [item.name]);
        
        let inventoryItemId;
        if (existingItemResult.rows.length === 0) {
          // Create the item in the items table
          const newItemResult = await db.query(`
            INSERT INTO items (name, type, asset_path, cost, description, is_active)
            VALUES ($1, 'cosmetic', $2, $3, $4, true)
            RETURNING id
          `, [item.name, item.asset_path, item.price, item.description]);
          inventoryItemId = newItemResult.rows[0].id;
        } else {
          inventoryItemId = existingItemResult.rows[0].id;
        }
        
        // Add to user_items if not already there
        await db.query(`
          INSERT INTO user_items (user_id, item_id) 
          VALUES ($1, $2)
          ON CONFLICT (user_id, item_id) DO NOTHING
        `, [userId, inventoryItemId]);
      } else if (item.item_type === 'background') {
        // Background purchases are tracked only in user_purchases table
        // No additional inventory integration needed for backgrounds
        console.log(`Background "${item.name}" purchased by user ${userId}`);
      } else if (item.item_type === 'title') {
        // Ensure title exists in titles table
        const existingTitleResult = await db.query(`
          SELECT id FROM titles WHERE name = $1
        `, [item.name]);

        let titleId;
        if (existingTitleResult.rows.length === 0) {
          const styleConfig = item.metadata?.style_config || {};
          const newTitleResult = await db.query(`
            INSERT INTO titles (name, style_config, cost, description, is_active)
            VALUES ($1, $2, $3, $4, true)
            RETURNING id
          `, [item.name, JSON.stringify(styleConfig), item.price, item.description]);
          titleId = newTitleResult.rows[0].id;
        } else {
          titleId = existingTitleResult.rows[0].id;
        }

        // Grant title to user if not already owned
        await db.query(`
          INSERT INTO user_titles (user_id, title_id)
          VALUES ($1, $2)
          ON CONFLICT (user_id, title_id) DO NOTHING
        `, [userId, titleId]);
      }
      
      // Commit transaction
      await db.query('COMMIT');
      
      // Get updated user money
      const updatedUserResult = await db.query(`
        SELECT money FROM users WHERE id = $1
      `, [userId]);
      
      res.json({ 
        success: true, 
        newBalance: updatedUserResult.rows[0]?.money || 0,
        purchasedItem: {
          id: item.id,
          name: item.name,
          category: item.category,
          item_type: item.item_type
        }
      });
      
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    console.error('Error purchasing item:', error);
    res.status(500).json({ error: 'Failed to complete purchase' });
  }
});

// Get user's purchase history
router.get('/purchases', authService.authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const purchasesResult = await db.query(`
      SELECT up.*, si.name, si.category, si.item_type, si.asset_path
      FROM user_purchases up
      JOIN shop_items si ON up.shop_item_id = si.id
      WHERE up.user_id = $1
      ORDER BY up.purchased_at DESC
    `, [userId]);
    
    res.json({
      purchases: purchasesResult.rows
    });
  } catch (error) {
    console.error('Error fetching purchase history:', error);
    res.status(500).json({ error: 'Failed to load purchase history' });
  }
});

module.exports = router;
