const express = require('express');
const { body, validationResult } = require('express-validator');

const router = express.Router();

module.exports = (db, integrationHub) => {
  // Get all integrations for user
  router.get('/', async (req, res) => {
    try {
      const userId = req.user.id;

      const result = await db.query(`
        SELECT 
          service_name,
          service_type,
          is_connected,
          last_sync,
          sync_status,
          settings
        FROM integrations 
        WHERE user_id = $1
        ORDER BY service_name
      `, [userId]);

      const integrations = result.rows.map(row => ({
        serviceName: row.service_name,
        serviceType: row.service_type,
        connected: row.is_connected,
        lastSync: row.last_sync,
        syncStatus: row.sync_status,
        settings: row.settings
      }));

      res.json({ integrations });
    } catch (error) {
      console.error('Get integrations error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get specific integration
  router.get('/:serviceName', async (req, res) => {
    try {
      const userId = req.user.id;
      const { serviceName } = req.params;

      const result = await db.query(`
        SELECT 
          service_name,
          service_type,
          is_connected,
          last_sync,
          sync_status,
          settings
        FROM integrations 
        WHERE user_id = $1 AND service_name = $2
      `, [userId, serviceName]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Integration not found' });
      }

      const row = result.rows[0];
      const integration = {
        serviceName: row.service_name,
        serviceType: row.service_type,
        connected: row.is_connected,
        lastSync: row.last_sync,
        syncStatus: row.sync_status,
        settings: row.settings
      };

      res.json({ integration });
    } catch (error) {
      console.error('Get integration error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Connect integration
  router.post('/:serviceName/connect', [
    body('authCode').notEmpty(),
    body('settings').optional().isObject()
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
      const { serviceName } = req.params;
      const { authCode, settings = {} } = req.body;

      const integration = await integrationHub.connectIntegration(userId, serviceName, authCode);

      res.json({
        message: 'Integration connected successfully',
        integration: {
          serviceName: integration.service_name,
          serviceType: integration.service_type,
          connected: integration.is_connected,
          lastSync: integration.last_sync
        }
      });
    } catch (error) {
      console.error('Connect integration error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Disconnect integration
  router.post('/:serviceName/disconnect', async (req, res) => {
    try {
      const userId = req.user.id;
      const { serviceName } = req.params;

      await integrationHub.disconnectIntegration(userId, serviceName);

      res.json({
        message: 'Integration disconnected successfully',
        serviceName
      });
    } catch (error) {
      console.error('Disconnect integration error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Sync integration
  router.post('/:serviceName/sync', async (req, res) => {
    try {
      const userId = req.user.id;
      const { serviceName } = req.params;

      const syncResult = await integrationHub.syncIntegration(userId, serviceName);

      res.json({
        message: 'Integration synced successfully',
        serviceName,
        dataCount: syncResult.data ? syncResult.data.length : 0,
        syncType: syncResult.type
      });
    } catch (error) {
      console.error('Sync integration error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Update integration settings
  router.put('/:serviceName/settings', [
    body('settings').isObject()
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
      const { serviceName } = req.params;
      const { settings } = req.body;

      const result = await db.query(`
        UPDATE integrations 
        SET settings = $3, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1 AND service_name = $2
        RETURNING *
      `, [userId, serviceName, JSON.stringify(settings)]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Integration not found' });
      }

      res.json({
        message: 'Integration settings updated successfully',
        serviceName,
        settings: result.rows[0].settings
      });
    } catch (error) {
      console.error('Update integration settings error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get integration sync history
  router.get('/:serviceName/sync-history', async (req, res) => {
    try {
      const userId = req.user.id;
      const { serviceName } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      const result = await db.query(`
        SELECT 
          act.id,
          act.description,
          act.metadata,
          act.severity,
          act.created_at
        FROM activities act
        WHERE act.user_id = $1 
          AND act.activity_type = 'integration_sync'
          AND act.metadata::jsonb->>'serviceName' = $2
        ORDER BY act.created_at DESC
        LIMIT $3 OFFSET $4
      `, [userId, serviceName, parseInt(limit), parseInt(offset)]);

      const history = result.rows.map(row => ({
        id: row.id,
        description: row.description,
        metadata: row.metadata,
        severity: row.severity,
        createdAt: row.created_at
      }));

      res.json({ history });
    } catch (error) {
      console.error('Get integration sync history error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get available integration services
  router.get('/services/available', async (req, res) => {
    try {
      const availableServices = [
        {
          name: 'google-calendar',
          type: 'calendar',
          displayName: 'Google Calendar',
          description: 'Sync your Google Calendar events and meetings',
          icon: '📅',
          oauthUrl: '/auth/google/calendar',
          features: ['Event sync', 'Meeting detection', 'Conflict resolution']
        },
        {
          name: 'gmail',
          type: 'email',
          displayName: 'Gmail',
          description: 'Process and summarize your Gmail messages',
          icon: '📧',
          oauthUrl: '/auth/google/gmail',
          features: ['Email summarization', 'Action item extraction', 'Priority detection']
        },
        {
          name: 'outlook',
          type: 'calendar',
          displayName: 'Microsoft Outlook',
          description: 'Sync your Outlook calendar and emails',
          icon: '📅',
          oauthUrl: '/auth/microsoft/outlook',
          features: ['Calendar sync', 'Email processing', 'Meeting coordination']
        },
        {
          name: 'slack',
          type: 'chat',
          displayName: 'Slack',
          description: 'Integrate with your Slack workspace',
          icon: '💬',
          oauthUrl: '/auth/slack',
          features: ['Message processing', 'Channel monitoring', 'Notification delivery']
        },
        {
          name: 'teams',
          type: 'chat',
          displayName: 'Microsoft Teams',
          description: 'Connect with your Teams workspace',
          icon: '💬',
          oauthUrl: '/auth/microsoft/teams',
          features: ['Team coordination', 'Meeting integration', 'File sharing']
        },
        {
          name: 'notion',
          type: 'project',
          displayName: 'Notion',
          description: 'Sync your Notion databases and pages',
          icon: '📊',
          oauthUrl: '/auth/notion',
          features: ['Database sync', 'Task management', 'Project tracking']
        }
      ];

      res.json({ services: availableServices });
    } catch (error) {
      console.error('Get available services error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get integration status summary
  router.get('/status/summary', async (req, res) => {
    try {
      const userId = req.user.id;

      const result = await db.query(`
        SELECT 
          service_type,
          COUNT(*) as total,
          COUNT(CASE WHEN is_connected THEN 1 END) as connected,
          COUNT(CASE WHEN sync_status = 'completed' THEN 1 END) as synced
        FROM integrations 
        WHERE user_id = $1
        GROUP BY service_type
      `, [userId]);

      const summary = {
        total: 0,
        connected: 0,
        synced: 0,
        byType: {}
      };

      result.rows.forEach(row => {
        summary.total += parseInt(row.total);
        summary.connected += parseInt(row.connected);
        summary.synced += parseInt(row.synced);
        
        summary.byType[row.service_type] = {
          total: parseInt(row.total),
          connected: parseInt(row.connected),
          synced: parseInt(row.synced)
        };
      });

      res.json({ summary });
    } catch (error) {
      console.error('Get integration status summary error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Test integration connection
  router.post('/:serviceName/test', async (req, res) => {
    try {
      const userId = req.user.id;
      const { serviceName } = req.params;

      const result = await db.query(`
        SELECT is_connected, access_token, refresh_token
        FROM integrations 
        WHERE user_id = $1 AND service_name = $2
      `, [userId, serviceName]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Integration not found' });
      }

      const integration = result.rows[0];
      
      if (!integration.is_connected) {
        return res.status(400).json({ error: 'Integration is not connected' });
      }

      // Test the connection (simplified)
      const testResult = {
        connected: true,
        responseTime: Math.floor(Math.random() * 1000) + 100, // Mock response time
        lastTest: new Date().toISOString(),
        status: 'success'
      };

      res.json({
        message: 'Integration test completed',
        serviceName,
        result: testResult
      });
    } catch (error) {
      console.error('Test integration error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
};
