const express = require('express');
const { body, validationResult } = require('express-validator');

const router = express.Router();

module.exports = (db, analyticsEngine) => {
  // Get user analytics
  router.get('/user', async (req, res) => {
    try {
      const userId = req.user.id;
      const { timeRange = '7d' } = req.query;

      const analytics = await analyticsEngine.getUserAnalytics(userId, timeRange);

      res.json({ analytics });
    } catch (error) {
      console.error('Get user analytics error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Track custom event
  router.post('/track', [
    body('eventType').notEmpty().isLength({ min: 1, max: 100 }),
    body('eventData').optional().isObject()
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
      const { eventType, eventData = {} } = req.body;
      const sessionId = req.headers['x-session-id'] || null;

      const eventId = await analyticsEngine.trackEvent(userId, eventType, {
        ...eventData,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip
      }, sessionId);

      res.json({
        message: 'Event tracked successfully',
        eventId
      });
    } catch (error) {
      console.error('Track event error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get activity metrics
  router.get('/activity', async (req, res) => {
    try {
      const userId = req.user.id;
      const { timeRange = '7d' } = req.query;

      const { startDate, endDate } = analyticsEngine.parseTimeRange(timeRange);

      const result = await db.query(`
        SELECT 
          event_type,
          COUNT(*) as count,
          DATE(created_at) as date
        FROM analytics_events 
        WHERE user_id = $1 
          AND created_at BETWEEN $2 AND $3
        GROUP BY event_type, DATE(created_at)
        ORDER BY date DESC, count DESC
      `, [userId, startDate, endDate]);

      const eventsByType = {};
      const dailyActivity = {};

      result.rows.forEach(row => {
        eventsByType[row.event_type] = (eventsByType[row.event_type] || 0) + parseInt(row.count);
        dailyActivity[row.date] = (dailyActivity[row.date] || 0) + parseInt(row.count);
      });

      const activity = {
        totalEvents: result.rows.reduce((sum, row) => sum + parseInt(row.count), 0),
        eventsByType,
        dailyActivity,
        mostActiveDay: Object.entries(dailyActivity)
          .sort(([,a], [,b]) => b - a)[0]?.[0] || null,
        averageEventsPerDay: Object.values(dailyActivity).reduce((sum, count) => sum + count, 0) / Object.keys(dailyActivity).length || 0
      };

      res.json({ activity });
    } catch (error) {
      console.error('Get activity metrics error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get productivity metrics
  router.get('/productivity', async (req, res) => {
    try {
      const userId = req.user.id;
      const { timeRange = '7d' } = req.query;

      const { startDate, endDate } = analyticsEngine.parseTimeRange(timeRange);

      const [tasksResult, meetingsResult, emailsResult] = await Promise.all([
        db.query(`
          SELECT 
            status,
            COUNT(*) as count,
            AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/3600) as avg_completion_hours
          FROM tasks 
          WHERE user_id = $1 AND created_at BETWEEN $2 AND $3
          GROUP BY status
        `, [userId, startDate, endDate]),
        
        db.query(`
          SELECT COUNT(*) as total_meetings
          FROM shared_context 
          WHERE user_id = $1 
            AND context_type = 'schedule' 
            AND created_at BETWEEN $2 AND $3
        `, [userId, startDate, endDate]),
        
        db.query(`
          SELECT COUNT(*) as processed_emails
          FROM activities 
          WHERE user_id = $1 
            AND activity_type LIKE '%email%'
            AND created_at BETWEEN $2 AND $3
        `, [userId, startDate, endDate])
      ]);

      const taskMetrics = {};
      tasksResult.rows.forEach(row => {
        taskMetrics[row.status] = {
          count: parseInt(row.count),
          avgCompletionHours: parseFloat(row.avg_completion_hours) || 0
        };
      });

      const totalTasks = Object.values(taskMetrics).reduce((sum, metric) => sum + metric.count, 0);
      const completedTasks = taskMetrics.completed?.count || 0;

      const productivity = {
        tasks: {
          total: totalTasks,
          completed: completedTasks,
          inProgress: taskMetrics['in-progress']?.count || 0,
          pending: taskMetrics.pending?.count || 0,
          completionRate: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
          avgCompletionTime: taskMetrics.completed?.avgCompletionHours || 0
        },
        meetings: {
          total: parseInt(meetingsResult.rows[0]?.total_meetings) || 0
        },
        emails: {
          processed: parseInt(emailsResult.rows[0]?.processed_emails) || 0
        },
        productivityScore: analyticsEngine.calculateProductivityScore(taskMetrics, meetingsResult.rows[0], emailsResult.rows[0])
      };

      res.json({ productivity });
    } catch (error) {
      console.error('Get productivity metrics error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get agent performance metrics
  router.get('/agents', async (req, res) => {
    try {
      const userId = req.user.id;
      const { timeRange = '7d' } = req.query;

      const { startDate, endDate } = analyticsEngine.parseTimeRange(timeRange);

      const result = await db.query(`
        SELECT 
          a.name,
          a.type,
          ua.performance_score,
          ua.status,
          COUNT(act.id) as executions,
          AVG(EXTRACT(EPOCH FROM (act.created_at - LAG(act.created_at) OVER (PARTITION BY ua.id ORDER BY act.created_at)))) as avg_interval_seconds
        FROM user_agents ua
        JOIN agents a ON ua.agent_id = a.id
        LEFT JOIN activities act ON ua.id = act.agent_id 
          AND act.created_at BETWEEN $2 AND $3
        WHERE ua.user_id = $1
        GROUP BY a.id, a.name, a.type, ua.performance_score, ua.status
      `, [userId, startDate, endDate]);

      const agentMetrics = {};
      let totalPerformance = 0;
      let activeAgents = 0;

      result.rows.forEach(row => {
        agentMetrics[row.type] = {
          name: row.name,
          performanceScore: parseFloat(row.performance_score) || 0,
          status: row.status,
          executions: parseInt(row.executions) || 0,
          avgIntervalMinutes: Math.round((parseFloat(row.avg_interval_seconds) || 0) / 60)
        };

        if (row.status === 'idle' || row.status === 'running') {
          totalPerformance += parseFloat(row.performance_score) || 0;
          activeAgents++;
        }
      });

      const performance = {
        agents: agentMetrics,
        averagePerformance: activeAgents > 0 ? totalPerformance / activeAgents : 0,
        totalAgents: result.rows.length,
        activeAgents,
        bestPerformingAgent: Object.entries(agentMetrics)
          .sort(([,a], [,b]) => b.performanceScore - a.performanceScore)[0]?.[0] || null
      };

      res.json({ performance });
    } catch (error) {
      console.error('Get agent performance metrics error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get integration metrics
  router.get('/integrations', async (req, res) => {
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

      res.json({ integrations: summary });
    } catch (error) {
      console.error('Get integration metrics error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get conflict resolution metrics
  router.get('/conflicts', async (req, res) => {
    try {
      const userId = req.user.id;
      const { timeRange = '7d' } = req.query;

      const { startDate, endDate } = analyticsEngine.parseTimeRange(timeRange);

      const result = await db.query(`
        SELECT 
          conflict_type,
          severity,
          status,
          resolution_method,
          COUNT(*) as count,
          AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600) as avg_resolution_hours
        FROM conflicts 
        WHERE user_id = $1 AND created_at BETWEEN $2 AND $3
        GROUP BY conflict_type, severity, status, resolution_method
      `, [userId, startDate, endDate]);

      const conflictMetrics = {
        byType: {},
        bySeverity: {},
        byStatus: {},
        byResolution: {},
        total: 0,
        resolved: 0,
        avgResolutionTime: 0
      };

      let totalResolutionTime = 0;
      let resolvedCount = 0;

      result.rows.forEach(row => {
        const count = parseInt(row.count);
        const resolutionTime = parseFloat(row.avg_resolution_hours) || 0;

        conflictMetrics.byType[row.conflict_type] = (conflictMetrics.byType[row.conflict_type] || 0) + count;
        conflictMetrics.bySeverity[row.severity] = (conflictMetrics.bySeverity[row.severity] || 0) + count;
        conflictMetrics.byStatus[row.status] = (conflictMetrics.byStatus[row.status] || 0) + count;
        
        if (row.resolution_method) {
          conflictMetrics.byResolution[row.resolution_method] = (conflictMetrics.byResolution[row.resolution_method] || 0) + count;
        }

        conflictMetrics.total += count;
        
        if (row.status === 'resolved') {
          conflictMetrics.resolved += count;
          totalResolutionTime += resolutionTime * count;
          resolvedCount += count;
        }
      });

      conflictMetrics.avgResolutionTime = resolvedCount > 0 ? totalResolutionTime / resolvedCount : 0;
      conflictMetrics.resolutionRate = conflictMetrics.total > 0 ? (conflictMetrics.resolved / conflictMetrics.total) * 100 : 0;

      res.json({ conflicts: conflictMetrics });
    } catch (error) {
      console.error('Get conflict resolution metrics error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get system-wide analytics (admin only)
  router.get('/system', async (req, res) => {
    try {
      // Check if user is admin
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const systemAnalytics = await analyticsEngine.getSystemAnalytics();

      res.json({ system: systemAnalytics });
    } catch (error) {
      console.error('Get system analytics error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get analytics dashboard data
  router.get('/dashboard', async (req, res) => {
    try {
      const userId = req.user.id;
      const { timeRange = '7d' } = req.query;

      // Get all analytics data in parallel
      const [userAnalytics, activityMetrics, productivityMetrics, agentMetrics, integrationMetrics, conflictMetrics] = await Promise.all([
        analyticsEngine.getUserAnalytics(userId, timeRange),
        db.query(`
          SELECT 
            event_type,
            COUNT(*) as count
          FROM analytics_events 
          WHERE user_id = $1 
            AND created_at > NOW() - INTERVAL '7 days'
          GROUP BY event_type
          ORDER BY count DESC
        `, [userId]),
        db.query(`
          SELECT 
            COUNT(*) as total_tasks,
            COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks
          FROM tasks 
          WHERE user_id = $1 
            AND created_at > NOW() - INTERVAL '7 days'
        `, [userId]),
        db.query(`
          SELECT 
            AVG(performance_score) as avg_performance,
            COUNT(*) as total_agents
          FROM user_agents 
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
          SELECT 
            COUNT(*) as total_conflicts,
            COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_conflicts
          FROM conflicts 
          WHERE user_id = $1 
            AND created_at > NOW() - INTERVAL '7 days'
        `, [userId])
      ]);

      const dashboard = {
        overview: {
          totalEvents: activityMetrics.rows.reduce((sum, row) => sum + parseInt(row.count), 0),
          taskCompletionRate: productivityMetrics.rows[0]?.total_tasks > 0 ? 
            (productivityMetrics.rows[0].completed_tasks / productivityMetrics.rows[0].total_tasks) * 100 : 0,
          agentPerformance: parseFloat(agentMetrics.rows[0]?.avg_performance) || 0,
          integrationHealth: integrationMetrics.rows[0]?.total_integrations > 0 ? 
            (integrationMetrics.rows[0].connected_integrations / integrationMetrics.rows[0].total_integrations) * 100 : 0,
          conflictResolutionRate: conflictMetrics.rows[0]?.total_conflicts > 0 ? 
            (conflictMetrics.rows[0].resolved_conflicts / conflictMetrics.rows[0].total_conflicts) * 100 : 0
        },
        recentActivity: activityMetrics.rows.slice(0, 10),
        timeRange,
        generatedAt: new Date().toISOString()
      };

      res.json({ dashboard });
    } catch (error) {
      console.error('Get dashboard analytics error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
};
