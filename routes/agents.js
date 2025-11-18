const express = require('express');
const { body, validationResult } = require('express-validator');

const router = express.Router();

module.exports = (db, agentOrchestrator) => {
  // Get all agents for user
  router.get('/', async (req, res) => {
    try {
      const userId = req.user.id;

      const result = await db.query(`
        SELECT 
          ua.*,
          a.name,
          a.type,
          a.description,
          a.configuration as default_config
        FROM user_agents ua
        JOIN agents a ON ua.agent_id = a.id
        WHERE ua.user_id = $1
        ORDER BY a.name
      `, [userId]);

      const agents = result.rows.map(row => ({
        id: row.agent_id,
        instanceId: row.id,
        name: row.name,
        type: row.type,
        description: row.description,
        status: row.status,
        lastRun: row.last_run,
        performanceScore: parseFloat(row.performance_score),
        autoRunEnabled: row.auto_run_enabled,
        autoRunInterval: row.auto_run_interval,
        settings: row.settings,
        defaultConfig: row.default_config
      }));

      res.json({ agents });
    } catch (error) {
      console.error('Get agents error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get specific agent
  router.get('/:agentId', async (req, res) => {
    try {
      const userId = req.user.id;
      const { agentId } = req.params;

      const result = await db.query(`
        SELECT 
          ua.*,
          a.name,
          a.type,
          a.description,
          a.configuration as default_config
        FROM user_agents ua
        JOIN agents a ON ua.agent_id = a.id
        WHERE ua.user_id = $1 AND ua.agent_id = $2
      `, [userId, agentId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Agent not found' });
      }

      const row = result.rows[0];
      const agent = {
        id: row.agent_id,
        instanceId: row.id,
        name: row.name,
        type: row.type,
        description: row.description,
        status: row.status,
        lastRun: row.last_run,
        performanceScore: parseFloat(row.performance_score),
        autoRunEnabled: row.auto_run_enabled,
        autoRunInterval: row.auto_run_interval,
        settings: row.settings,
        defaultConfig: row.default_config
      };

      res.json({ agent });
    } catch (error) {
      console.error('Get agent error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Run agent
  router.post('/:agentId/run', [
    body('params').optional().isObject()
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
      const { agentId } = req.params;
      const { params = {} } = req.body;

      // Get agent instance
      const result = await db.query(`
        SELECT ua.id as instance_id
        FROM user_agents ua
        WHERE ua.user_id = $1 AND ua.agent_id = $2
      `, [userId, agentId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Agent not found' });
      }

      const instanceId = result.rows[0].instance_id;

      // Run agent
      const agentResult = await agentOrchestrator.runAgent(instanceId, params);

      res.json({
        message: 'Agent executed successfully',
        result: agentResult
      });
    } catch (error) {
      console.error('Run agent error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Update agent settings
  router.put('/:agentId/settings', [
    body('settings').isObject(),
    body('autoRunEnabled').optional().isBoolean(),
    body('autoRunInterval').optional().isInt({ min: 5, max: 1440 })
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
      const { agentId } = req.params;
      const { settings, autoRunEnabled, autoRunInterval } = req.body;

      const result = await db.query(`
        UPDATE user_agents 
        SET 
          settings = COALESCE($3, settings),
          auto_run_enabled = COALESCE($4, auto_run_enabled),
          auto_run_interval = COALESCE($5, auto_run_interval),
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1 AND agent_id = $2
        RETURNING *
      `, [userId, agentId, JSON.stringify(settings), autoRunEnabled, autoRunInterval]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Agent not found' });
      }

      res.json({
        message: 'Agent settings updated successfully',
        agent: {
          id: result.rows[0].agent_id,
          settings: result.rows[0].settings,
          autoRunEnabled: result.rows[0].auto_run_enabled,
          autoRunInterval: result.rows[0].auto_run_interval
        }
      });
    } catch (error) {
      console.error('Update agent settings error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get agent performance metrics
  router.get('/:agentId/performance', async (req, res) => {
    try {
      const userId = req.user.id;
      const { agentId } = req.params;

      const result = await db.query(`
        SELECT 
          ua.performance_score,
          ua.last_run,
          COUNT(act.id) as total_executions,
          COUNT(CASE WHEN act.severity = 'error' THEN 1 END) as error_count,
          AVG(EXTRACT(EPOCH FROM (act.created_at - LAG(act.created_at) OVER (ORDER BY act.created_at)))) as avg_interval_seconds
        FROM user_agents ua
        LEFT JOIN activities act ON ua.id = act.agent_id 
          AND act.activity_type = 'agent_execution'
          AND act.created_at > NOW() - INTERVAL '30 days'
        WHERE ua.user_id = $1 AND ua.agent_id = $2
        GROUP BY ua.performance_score, ua.last_run
      `, [userId, agentId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Agent not found' });
      }

      const row = result.rows[0];
      const performance = {
        performanceScore: parseFloat(row.performance_score) || 0,
        lastRun: row.last_run,
        totalExecutions: parseInt(row.total_executions) || 0,
        errorCount: parseInt(row.error_count) || 0,
        successRate: row.total_executions > 0 ? 
          ((row.total_executions - row.error_count) / row.total_executions) * 100 : 0,
        avgIntervalMinutes: Math.round((parseFloat(row.avg_interval_seconds) || 0) / 60)
      };

      res.json({ performance });
    } catch (error) {
      console.error('Get agent performance error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get agent execution history
  router.get('/:agentId/history', async (req, res) => {
    try {
      const userId = req.user.id;
      const { agentId } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      const result = await db.query(`
        SELECT 
          act.id,
          act.description,
          act.metadata,
          act.severity,
          act.created_at
        FROM activities act
        JOIN user_agents ua ON act.agent_id = ua.id
        WHERE ua.user_id = $1 AND ua.agent_id = $2
          AND act.activity_type = 'agent_execution'
        ORDER BY act.created_at DESC
        LIMIT $3 OFFSET $4
      `, [userId, agentId, parseInt(limit), parseInt(offset)]);

      const history = result.rows.map(row => ({
        id: row.id,
        description: row.description,
        metadata: row.metadata,
        severity: row.severity,
        createdAt: row.created_at
      }));

      res.json({ history });
    } catch (error) {
      console.error('Get agent history error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Pause agent
  router.post('/:agentId/pause', async (req, res) => {
    try {
      const userId = req.user.id;
      const { agentId } = req.params;

      const result = await db.query(`
        UPDATE user_agents 
        SET status = 'paused', updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1 AND agent_id = $2
        RETURNING *
      `, [userId, agentId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Agent not found' });
      }

      res.json({
        message: 'Agent paused successfully',
        status: 'paused'
      });
    } catch (error) {
      console.error('Pause agent error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Resume agent
  router.post('/:agentId/resume', async (req, res) => {
    try {
      const userId = req.user.id;
      const { agentId } = req.params;

      const result = await db.query(`
        UPDATE user_agents 
        SET status = 'idle', updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1 AND agent_id = $2
        RETURNING *
      `, [userId, agentId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Agent not found' });
      }

      res.json({
        message: 'Agent resumed successfully',
        status: 'idle'
      });
    } catch (error) {
      console.error('Resume agent error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get agent status
  router.get('/:agentId/status', async (req, res) => {
    try {
      const userId = req.user.id;
      const { agentId } = req.params;

      const result = await db.query(`
        SELECT 
          ua.status,
          ua.last_run,
          ua.performance_score,
          ua.auto_run_enabled,
          a.name,
          a.type
        FROM user_agents ua
        JOIN agents a ON ua.agent_id = a.id
        WHERE ua.user_id = $1 AND ua.agent_id = $2
      `, [userId, agentId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Agent not found' });
      }

      const row = result.rows[0];
      const status = {
        name: row.name,
        type: row.type,
        status: row.status,
        lastRun: row.last_run,
        performanceScore: parseFloat(row.performance_score) || 0,
        autoRunEnabled: row.auto_run_enabled
      };

      res.json({ status });
    } catch (error) {
      console.error('Get agent status error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get all agent types (for creating new agents)
  router.get('/types/available', async (req, res) => {
    try {
      const result = await db.query(`
        SELECT id, name, type, description, configuration
        FROM agents 
        WHERE is_active = true
        ORDER BY name
      `);

      const agentTypes = result.rows.map(row => ({
        id: row.id,
        name: row.name,
        type: row.type,
        description: row.description,
        configuration: row.configuration
      }));

      res.json({ agentTypes });
    } catch (error) {
      console.error('Get agent types error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
};
