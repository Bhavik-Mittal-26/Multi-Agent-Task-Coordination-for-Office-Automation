const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcrypt');

const router = express.Router();

module.exports = (db) => {
  // Get user profile
  router.get('/profile', async (req, res) => {
    try {
      const userId = req.user.id;

      const result = await db.query(`
        SELECT 
          id,
          email,
          first_name,
          last_name,
          role,
          avatar_url,
          preferences,
          last_login,
          created_at
        FROM users 
        WHERE id = $1
      `, [userId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const user = result.rows[0];
      const profile = {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        avatarUrl: user.avatar_url,
        preferences: user.preferences,
        lastLogin: user.last_login,
        createdAt: user.created_at
      };

      res.json({ profile });
    } catch (error) {
      console.error('Get user profile error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Update user profile
  router.put('/profile', [
    body('firstName').optional().trim().isLength({ min: 2, max: 50 }),
    body('lastName').optional().trim().isLength({ min: 2, max: 50 }),
    body('preferences').optional().isObject()
  ], async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: errors.array() 
        });
      }

      const userId = req.user.id;
      const { firstName, lastName, preferences } = req.body;

      const updateFields = [];
      const updateValues = [];
      let paramCount = 1;

      if (firstName !== undefined) {
        updateFields.push(`first_name = $${paramCount++}`);
        updateValues.push(firstName);
      }

      if (lastName !== undefined) {
        updateFields.push(`last_name = $${paramCount++}`);
        updateValues.push(lastName);
      }

      if (preferences !== undefined) {
        updateFields.push(`preferences = $${paramCount++}`);
        updateValues.push(JSON.stringify(preferences));
      }

      if (updateFields.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      updateValues.push(userId);

      const result = await db.query(`
        UPDATE users 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING id, first_name, last_name, preferences, updated_at
      `, updateValues);

      res.json({
        message: 'Profile updated successfully',
        profile: {
          id: result.rows[0].id,
          firstName: result.rows[0].first_name,
          lastName: result.rows[0].last_name,
          preferences: result.rows[0].preferences,
          updatedAt: result.rows[0].updated_at
        }
      });
    } catch (error) {
      console.error('Update user profile error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Change password
  router.put('/password', [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
  ], async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: errors.array() 
        });
      }

      const userId = req.user.id;
      const { currentPassword, newPassword } = req.body;

      // Get current password hash
      const result = await db.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
      if (!isValidPassword) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(newPassword, 12);

      // Update password
      await db.query(`
        UPDATE users 
        SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [newPasswordHash, userId]);

      res.json({ message: 'Password changed successfully' });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Upload avatar
  router.post('/avatar', async (req, res) => {
    try {
      const userId = req.user.id;
      
      // In a real implementation, you would handle file upload here
      // For now, we'll just return a success message
      const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`;

      await db.query(`
        UPDATE users 
        SET avatar_url = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [avatarUrl, userId]);

      res.json({
        message: 'Avatar updated successfully',
        avatarUrl
      });
    } catch (error) {
      console.error('Upload avatar error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get user preferences
  router.get('/preferences', async (req, res) => {
    try {
      const userId = req.user.id;

      const result = await db.query('SELECT preferences FROM users WHERE id = $1', [userId]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const preferences = result.rows[0].preferences || {};

      res.json({ preferences });
    } catch (error) {
      console.error('Get user preferences error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Update user preferences
  router.put('/preferences', [
    body('preferences').isObject()
  ], async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: errors.array() 
        });
      }

      const userId = req.user.id;
      const { preferences } = req.body;

      await db.query(`
        UPDATE users 
        SET preferences = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [JSON.stringify(preferences), userId]);

      res.json({
        message: 'Preferences updated successfully',
        preferences
      });
    } catch (error) {
      console.error('Update user preferences error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get user activity summary
  router.get('/activity', async (req, res) => {
    try {
      const userId = req.user.id;
      const { limit = 50, offset = 0 } = req.query;

      const result = await db.query(`
        SELECT 
          id,
          activity_type,
          description,
          metadata,
          severity,
          created_at
        FROM activities 
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `, [userId, parseInt(limit), parseInt(offset)]);

      const activities = result.rows.map(row => ({
        id: row.id,
        activityType: row.activity_type,
        description: row.description,
        metadata: row.metadata,
        severity: row.severity,
        createdAt: row.created_at
      }));

      res.json({ activities });
    } catch (error) {
      console.error('Get user activity error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get user notifications
  router.get('/notifications', async (req, res) => {
    try {
      const userId = req.user.id;
      const { limit = 50, offset = 0, unreadOnly = false } = req.query;

      let query = `
        SELECT 
          id,
          title,
          message,
          type,
          is_read,
          action_url,
          metadata,
          created_at
        FROM notifications 
        WHERE user_id = $1
      `;

      const queryParams = [userId];

      if (unreadOnly === 'true') {
        query += ' AND is_read = false';
      }

      query += ' ORDER BY created_at DESC LIMIT $2 OFFSET $3';
      queryParams.push(parseInt(limit), parseInt(offset));

      const result = await db.query(query, queryParams);

      const notifications = result.rows.map(row => ({
        id: row.id,
        title: row.title,
        message: row.message,
        type: row.type,
        isRead: row.is_read,
        actionUrl: row.action_url,
        metadata: row.metadata,
        createdAt: row.created_at
      }));

      res.json({ notifications });
    } catch (error) {
      console.error('Get user notifications error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Mark notification as read
  router.put('/notifications/:notificationId/read', async (req, res) => {
    try {
      const userId = req.user.id;
      const { notificationId } = req.params;

      const result = await db.query(`
        UPDATE notifications 
        SET is_read = true 
        WHERE id = $1 AND user_id = $2
        RETURNING id
      `, [notificationId, userId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Notification not found' });
      }

      res.json({ message: 'Notification marked as read' });
    } catch (error) {
      console.error('Mark notification as read error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Mark all notifications as read
  router.put('/notifications/read-all', async (req, res) => {
    try {
      const userId = req.user.id;

      await db.query(`
        UPDATE notifications 
        SET is_read = true 
        WHERE user_id = $1 AND is_read = false
      `, [userId]);

      res.json({ message: 'All notifications marked as read' });
    } catch (error) {
      console.error('Mark all notifications as read error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get unread notification count
  router.get('/notifications/unread-count', async (req, res) => {
    try {
      const userId = req.user.id;

      const result = await db.query(`
        SELECT COUNT(*) as count
        FROM notifications 
        WHERE user_id = $1 AND is_read = false
      `, [userId]);

      const count = parseInt(result.rows[0].count);

      res.json({ unreadCount: count });
    } catch (error) {
      console.error('Get unread notification count error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Delete user account (soft delete)
  router.delete('/account', [
    body('password').notEmpty()
  ], async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: errors.array() 
        });
      }

      const userId = req.user.id;
      const { password } = req.body;

      // Verify password
      const result = await db.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const isValidPassword = await bcrypt.compare(password, result.rows[0].password_hash);
      if (!isValidPassword) {
        return res.status(400).json({ error: 'Password is incorrect' });
      }

      // Soft delete user
      await db.query(`
        UPDATE users 
        SET is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [userId]);

      res.json({ message: 'Account deactivated successfully' });
    } catch (error) {
      console.error('Delete user account error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get user statistics
  router.get('/stats', async (req, res) => {
    try {
      const userId = req.user.id;

      const [agentsResult, tasksResult, integrationsResult, activitiesResult] = await Promise.all([
        db.query(`
          SELECT 
            COUNT(*) as total_agents,
            COUNT(CASE WHEN status = 'idle' THEN 1 END) as idle_agents,
            COUNT(CASE WHEN status = 'running' THEN 1 END) as running_agents,
            AVG(performance_score) as avg_performance
          FROM user_agents 
          WHERE user_id = $1
        `, [userId]),
        
        db.query(`
          SELECT 
            COUNT(*) as total_tasks,
            COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
            COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_tasks
          FROM tasks 
          WHERE user_id = $1
        `, [userId]),
        
        db.query(`
          SELECT 
            COUNT(*) as total_integrations,
            COUNT(CASE WHEN is_connected THEN 1 END) as connected_integrations
          FROM integrations 
          WHERE user_id = $1
        `, [userId]),
        
        db.query(`
          SELECT COUNT(*) as total_activities
          FROM activities 
          WHERE user_id = $1 
            AND created_at > NOW() - INTERVAL '30 days'
        `, [userId])
      ]);

      const stats = {
        agents: {
          total: parseInt(agentsResult.rows[0].total_agents) || 0,
          idle: parseInt(agentsResult.rows[0].idle_agents) || 0,
          running: parseInt(agentsResult.rows[0].running_agents) || 0,
          avgPerformance: parseFloat(agentsResult.rows[0].avg_performance) || 0
        },
        tasks: {
          total: parseInt(tasksResult.rows[0].total_tasks) || 0,
          completed: parseInt(tasksResult.rows[0].completed_tasks) || 0,
          pending: parseInt(tasksResult.rows[0].pending_tasks) || 0
        },
        integrations: {
          total: parseInt(integrationsResult.rows[0].total_integrations) || 0,
          connected: parseInt(integrationsResult.rows[0].connected_integrations) || 0
        },
        activities: {
          last30Days: parseInt(activitiesResult.rows[0].total_activities) || 0
        }
      };

      res.json({ stats });
    } catch (error) {
      console.error('Get user stats error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
};
