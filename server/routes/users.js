const express = require('express');
const router = express.Router();

const { db } = require('../database');

// GET /api/users/search?q=term
router.get('/search', async (req, res) => {
  try {
    const q = req.query.q || '';
    if (!q) return res.status(400).json({ success: false, error: 'Missing query' });

    const users = await db.searchUsers(q);
    return res.json({ success: true, users });
  } catch (err) {
    console.error('Error searching users:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router; 