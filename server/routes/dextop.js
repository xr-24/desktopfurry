const express = require('express');
const router = express.Router();
const { db } = require('../database');
const authService = require('../auth');

// Get user's dextop
router.get('/my-dextop', authService.authenticateToken, async (req, res) => {
  try {
    const dextop = await db.getUserDextop(req.user.userId);
    const programs = await db.getDextopPrograms(dextop.id);
    const achievements = await db.getUserAchievements(req.user.userId);
    const unlockedPrograms = await db.getUnlockedPrograms(req.user.userId);
    
    res.json({
      dextop: {
        id: dextop.id,
        name: dextop.name,
        backgroundId: dextop.background_id,
        isPublic: dextop.is_public,
        allowVisitors: dextop.allow_visitors,
        allowVisitorInteraction: dextop.allow_visitor_interaction,
        visitCount: dextop.visit_count
      },
      programs: programs.map(p => ({
        id: p.id,
        type: p.program_type,
        position: { x: p.position_x, y: p.position_y },
        size: { width: p.width, height: p.height },
        zIndex: p.z_index,
        isMinimized: p.is_minimized,
        state: p.program_data
      })),
      avatar: {
        hue: dextop.hue || 0,
        eyes: dextop.eyes || 'none',
        ears: dextop.ears || 'none',
        fluff: dextop.fluff || 'none',
        tail: dextop.tail || 'none',
        body: dextop.body || 'CustomBase'
      },
      achievements,
      unlockedPrograms: ['paint', 'notepad', 'winamp', 'bdemediaplayer', 'checkers', 'snake', 'characterEditor', ...unlockedPrograms]
    });
  } catch (error) {
    console.error('Error fetching dextop:', error);
    res.status(500).json({ error: 'Failed to load dextop' });
  }
});

// Save program state
router.post('/save-program', authService.authenticateToken, async (req, res) => {
  try {
    const { programType, position, size, zIndex, isMinimized, programData } = req.body;
    
    const dextop = await db.getUserDextop(req.user.userId);
    
    await db.saveProgramState(
      dextop.id,
      programType,
      position,
      size,
      zIndex,
      isMinimized,
      programData || {}
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving program state:', error);
    res.status(500).json({ error: 'Failed to save program state' });
  }
});

// Delete program state
router.delete('/program/:programType', authService.authenticateToken, async (req, res) => {
  try {
    const { programType } = req.params;
    const dextop = await db.getUserDextop(req.user.userId);
    
    await db.deleteProgramState(dextop.id, programType);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting program state:', error);
    res.status(500).json({ error: 'Failed to delete program state' });
  }
});

// Update dextop background
router.post('/background', authService.authenticateToken, async (req, res) => {
  try {
    const { backgroundId } = req.body;
    
    if (!backgroundId) {
      return res.status(400).json({ error: 'Background ID required' });
    }
    
    await db.updateDextopBackground(req.user.userId, backgroundId);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating background:', error);
    res.status(500).json({ error: 'Failed to update background' });
  }
});

// Update avatar appearance
router.post('/avatar', authService.authenticateToken, async (req, res) => {
  try {
    const { appearance } = req.body;
    
    if (!appearance) {
      return res.status(400).json({ error: 'Appearance data required' });
    }
    
    await db.updateAvatarAppearance(req.user.userId, appearance);
    
    // Check for customizer achievement
    await db.unlockAchievement(req.user.userId, 'CUSTOMIZER');
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating avatar:', error);
    res.status(500).json({ error: 'Failed to update avatar' });
  }
});

// Unlock achievement
router.post('/achievement', authService.authenticateToken, async (req, res) => {
  try {
    const { achievementCode, context } = req.body;
    
    const unlocked = await db.unlockAchievement(req.user.userId, achievementCode);
    
    if (unlocked) {
      // Get the achievement details
      const achievements = await db.getUserAchievements(req.user.userId);
      const newAchievement = achievements.find(a => a.code === achievementCode);
      
      res.json({ 
        success: true, 
        unlocked: true,
        achievement: newAchievement
      });
    } else {
      res.json({ success: true, unlocked: false });
    }
  } catch (error) {
    console.error('Error unlocking achievement:', error);
    res.status(500).json({ error: 'Failed to unlock achievement' });
  }
});

// Get public dextops (for browsing/visiting)
router.get('/public', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT d.id, d.name, d.background_id, d.visit_count, d.updated_at,
             u.username as owner_username
      FROM dextops d
      JOIN users u ON d.user_id = u.id
      WHERE d.is_public = true AND d.allow_visitors = true
      ORDER BY d.visit_count DESC, d.updated_at DESC
      LIMIT 20
    `);
    
    res.json(result.rows.map(row => ({
      id: row.id,
      name: row.name,
      backgroundId: row.background_id,
      visitCount: row.visit_count,
      lastUpdated: row.updated_at,
      ownerUsername: row.owner_username
    })));
  } catch (error) {
    console.error('Error fetching public dextops:', error);
    res.status(500).json({ error: 'Failed to load public dextops' });
  }
});

// Visit a dextop
router.get('/visit/:dextopId', authService.authenticateToken, async (req, res) => {
  try {
    const { dextopId } = req.params;
    
    // Get dextop info
    const dextopResult = await db.query(`
      SELECT d.*, u.username as owner_username,
             aa.hue, aa.eyes, aa.ears, aa.fluff, aa.tail, aa.body
      FROM dextops d
      JOIN users u ON d.user_id = u.id
      LEFT JOIN avatar_appearances aa ON d.user_id = aa.user_id
      WHERE d.id = $1
    `, [dextopId]);
    
    if (dextopResult.rows.length === 0) {
      return res.status(404).json({ error: 'Dextop not found' });
    }
    
    const dextop = dextopResult.rows[0];
    
    // Check if visiting is allowed
    if (!dextop.allow_visitors && dextop.user_id !== req.user.userId) {
      return res.status(403).json({ error: 'Visits not allowed on this dextop' });
    }
    
    // Record visit if not the owner
    if (dextop.user_id !== req.user.userId) {
      await db.recordDextopVisit(dextopId, req.user.userId);
    }
    
    const programs = await db.getDextopPrograms(dextopId);
    
    res.json({
      dextop: {
        id: dextop.id,
        name: dextop.name,
        backgroundId: dextop.background_id,
        isPublic: dextop.is_public,
        allowVisitorInteraction: dextop.allow_visitor_interaction,
        visitCount: dextop.visit_count,
        ownerUsername: dextop.owner_username,
        isOwner: dextop.user_id === req.user.userId
      },
      programs: programs.map(p => ({
        id: p.id,
        type: p.program_type,
        position: { x: p.position_x, y: p.position_y },
        size: { width: p.width, height: p.height },
        zIndex: p.z_index,
        isMinimized: p.is_minimized,
        state: p.program_data
      })),
      ownerAvatar: {
        hue: dextop.hue || 0,
        eyes: dextop.eyes || 'none',
        ears: dextop.ears || 'none',
        fluff: dextop.fluff || 'none',
        tail: dextop.tail || 'none',
        body: dextop.body || 'CustomBase'
      }
    });
  } catch (error) {
    console.error('Error visiting dextop:', error);
    res.status(500).json({ error: 'Failed to visit dextop' });
  }
});

module.exports = router; 