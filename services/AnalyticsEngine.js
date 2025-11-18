const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

class AnalyticsEngine {
  constructor(db) {
    this.db = db;
    this.metricsCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    this.realTimeMetrics = new Map();
    
    this.initializeMetrics();
    this.startMetricsCollection();
  }

  async initializeMetrics() {
    try {
      // Initialize default metrics
      await this.db.query(`
        INSERT INTO system_settings (key, value, description, is_public)
        VALUES 
        ('analytics_enabled', 'true', 'Enable analytics collection', true),
        ('metrics_retention_days', '90', 'Days to retain analytics data', false),
        ('real_time_metrics', 'true', 'Enable real-time metrics', true)
        ON CONFLICT (key) DO NOTHING
      `);
      
      console.log('📊 Analytics engine initialized');
    } catch (error) {
      console.error('Failed to initialize analytics:', error);
    }
  }

  async trackEvent(userId, eventType, eventData = {}, sessionId = null) {
    try {
      const event = {
        id: uuidv4(),
        userId,
        eventType,
        eventData: JSON.stringify(eventData),
        sessionId: sessionId || uuidv4(),
        timestamp: new Date(),
        userAgent: eventData.userAgent || 'unknown',
        ipAddress: eventData.ipAddress || '127.0.0.1'
      };

      await this.db.query(`
        INSERT INTO analytics_events (id, user_id, event_type, event_data, session_id, user_agent, ip_address, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        event.id,
        event.userId,
        event.eventType,
        event.eventData,
        event.sessionId,
        event.userAgent,
        event.ipAddress,
        event.timestamp
      ]);

      // Update real-time metrics
      this.updateRealTimeMetrics(userId, eventType, eventData);

      return event.id;
    } catch (error) {
      console.error('Failed to track event:', error);
      throw error;
    }
  }

  updateRealTimeMetrics(userId, eventType, eventData) {
    const userMetrics = this.realTimeMetrics.get(userId) || {
      totalEvents: 0,
      eventsByType: {},
      lastActivity: null,
      sessionDuration: 0,
      agentInteractions: 0
    };

    userMetrics.totalEvents++;
    userMetrics.eventsByType[eventType] = (userMetrics.eventsByType[eventType] || 0) + 1;
    userMetrics.lastActivity = new Date();

    if (eventType.includes('agent')) {
      userMetrics.agentInteractions++;
    }

    this.realTimeMetrics.set(userId, userMetrics);
  }

  async getUserAnalytics(userId, timeRange = '7d') {
    const cacheKey = `${userId}-${timeRange}`;
    const cached = this.metricsCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    try {
      const { startDate, endDate } = this.parseTimeRange(timeRange);
      
      const analytics = await Promise.all([
        this.getUserActivityMetrics(userId, startDate, endDate),
        this.getAgentPerformanceMetrics(userId, startDate, endDate),
        this.getProductivityMetrics(userId, startDate, endDate),
        this.getIntegrationMetrics(userId, startDate, endDate),
        this.getTaskMetrics(userId, startDate, endDate),
        this.getConflictResolutionMetrics(userId, startDate, endDate)
      ]);

      const result = {
        userId,
        timeRange,
        period: { startDate, endDate },
        activity: analytics[0],
        agentPerformance: analytics[1],
        productivity: analytics[2],
        integrations: analytics[3],
        tasks: analytics[4],
        conflicts: analytics[5],
        realTime: this.realTimeMetrics.get(userId) || {},
        generatedAt: new Date().toISOString()
      };

      // Cache the result
      this.metricsCache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });

      return result;
    } catch (error) {
      console.error('Failed to get user analytics:', error);
      throw error;
    }
  }

  async getUserActivityMetrics(userId, startDate, endDate) {
    const result = await this.db.query(`
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

    return {
      totalEvents: result.rows.reduce((sum, row) => sum + parseInt(row.count), 0),
      eventsByType,
      dailyActivity,
      mostActiveDay: Object.entries(dailyActivity)
        .sort(([,a], [,b]) => b - a)[0]?.[0] || null,
      averageEventsPerDay: Object.values(dailyActivity).reduce((sum, count) => sum + count, 0) / Object.keys(dailyActivity).length || 0
    };
  }

  async getAgentPerformanceMetrics(userId, startDate, endDate) {
    const result = await this.db.query(`
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

    return {
      agents: agentMetrics,
      averagePerformance: activeAgents > 0 ? totalPerformance / activeAgents : 0,
      totalAgents: result.rows.length,
      activeAgents,
      bestPerformingAgent: Object.entries(agentMetrics)
        .sort(([,a], [,b]) => b.performanceScore - a.performanceScore)[0]?.[0] || null
    };
  }

  async getProductivityMetrics(userId, startDate, endDate) {
    const [tasksResult, meetingsResult, emailsResult] = await Promise.all([
      this.db.query(`
        SELECT 
          status,
          COUNT(*) as count,
          AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/3600) as avg_completion_hours
        FROM tasks 
        WHERE user_id = $1 AND created_at BETWEEN $2 AND $3
        GROUP BY status
      `, [userId, startDate, endDate]),
      
      this.db.query(`
        SELECT COUNT(*) as total_meetings
        FROM shared_context 
        WHERE user_id = $1 
          AND context_type = 'schedule' 
          AND created_at BETWEEN $2 AND $3
      `, [userId, startDate, endDate]),
      
      this.db.query(`
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

    return {
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
      productivityScore: this.calculateProductivityScore(taskMetrics, meetingsResult.rows[0], emailsResult.rows[0])
    };
  }

  async getIntegrationMetrics(userId, startDate, endDate) {
    const result = await this.db.query(`
      SELECT 
        service_name,
        service_type,
        is_connected,
        last_sync,
        sync_status
      FROM integrations 
      WHERE user_id = $1
    `, [userId]);

    const integrationMetrics = {};
    let connectedCount = 0;
    let totalSyncs = 0;

    result.rows.forEach(row => {
      integrationMetrics[row.service_name] = {
        type: row.service_type,
        connected: row.is_connected,
        lastSync: row.last_sync,
        syncStatus: row.sync_status,
        daysSinceLastSync: row.last_sync ? 
          Math.floor((new Date() - new Date(row.last_sync)) / (1000 * 60 * 60 * 24)) : null
      };

      if (row.is_connected) {
        connectedCount++;
      }
      if (row.sync_status === 'completed') {
        totalSyncs++;
      }
    });

    return {
      integrations: integrationMetrics,
      totalIntegrations: result.rows.length,
      connectedIntegrations: connectedCount,
      connectionRate: result.rows.length > 0 ? (connectedCount / result.rows.length) * 100 : 0,
      successfulSyncs: totalSyncs
    };
  }

  async getTaskMetrics(userId, startDate, endDate) {
    const result = await this.db.query(`
      SELECT 
        priority,
        status,
        COUNT(*) as count,
        AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/3600) as avg_duration_hours
      FROM tasks 
      WHERE user_id = $1 AND created_at BETWEEN $2 AND $3
      GROUP BY priority, status
    `, [userId, startDate, endDate]);

    const taskMetrics = {
      byPriority: {},
      byStatus: {},
      total: 0,
      avgDuration: 0
    };

    let totalDuration = 0;
    let totalTasks = 0;

    result.rows.forEach(row => {
      const count = parseInt(row.count);
      const duration = parseFloat(row.avg_duration_hours) || 0;

      taskMetrics.byPriority[row.priority] = (taskMetrics.byPriority[row.priority] || 0) + count;
      taskMetrics.byStatus[row.status] = (taskMetrics.byStatus[row.status] || 0) + count;
      
      totalTasks += count;
      totalDuration += duration * count;
    });

    taskMetrics.total = totalTasks;
    taskMetrics.avgDuration = totalTasks > 0 ? totalDuration / totalTasks : 0;

    return taskMetrics;
  }

  async getConflictResolutionMetrics(userId, startDate, endDate) {
    const result = await this.db.query(`
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

    return conflictMetrics;
  }

  calculateProductivityScore(taskMetrics, meetingsData, emailsData) {
    const taskScore = taskMetrics.completed?.count || 0;
    const meetingScore = parseInt(meetingsData?.total_meetings) || 0;
    const emailScore = parseInt(emailsData?.processed_emails) || 0;
    
    // Weighted scoring: tasks (50%), meetings (30%), emails (20%)
    const score = (taskScore * 0.5) + (meetingScore * 0.3) + (emailScore * 0.2);
    
    // Normalize to 0-100 scale
    return Math.min(100, Math.max(0, score * 10));
  }

  parseTimeRange(timeRange) {
    const now = new Date();
    let startDate;

    switch (timeRange) {
      case '1d':
        startDate = moment(now).subtract(1, 'day').toDate();
        break;
      case '7d':
        startDate = moment(now).subtract(7, 'days').toDate();
        break;
      case '30d':
        startDate = moment(now).subtract(30, 'days').toDate();
        break;
      case '90d':
        startDate = moment(now).subtract(90, 'days').toDate();
        break;
      default:
        startDate = moment(now).subtract(7, 'days').toDate();
    }

    return { startDate, endDate: now };
  }

  startMetricsCollection() {
    // Collect system-wide metrics every 5 minutes
    setInterval(async () => {
      try {
        await this.collectSystemMetrics();
        await this.cleanupOldMetrics();
      } catch (error) {
        console.error('Metrics collection error:', error);
      }
    }, 5 * 60 * 1000);

    console.log('📊 Metrics collection started');
  }

  async collectSystemMetrics() {
    const [userCount, agentCount, taskCount, integrationCount] = await Promise.all([
      this.db.query('SELECT COUNT(*) FROM users WHERE is_active = true'),
      this.db.query('SELECT COUNT(*) FROM user_agents WHERE status IN ($1, $2)', ['idle', 'running']),
      this.db.query('SELECT COUNT(*) FROM tasks WHERE status = $1', ['pending']),
      this.db.query('SELECT COUNT(*) FROM integrations WHERE is_connected = true')
    ]);

    const systemMetrics = {
      timestamp: new Date().toISOString(),
      users: {
        active: parseInt(userCount.rows[0].count)
      },
      agents: {
        active: parseInt(agentCount.rows[0].count)
      },
      tasks: {
        pending: parseInt(taskCount.rows[0].count)
      },
      integrations: {
        connected: parseInt(integrationCount.rows[0].count)
      }
    };

    // Store system metrics
    await this.db.query(`
      INSERT INTO system_settings (key, value, description, is_public)
      VALUES ('system_metrics', $1, 'Current system metrics', true)
      ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = CURRENT_TIMESTAMP
    `, [JSON.stringify(systemMetrics)]);

    return systemMetrics;
  }

  async cleanupOldMetrics() {
    const retentionDays = await this.db.query(`
      SELECT value FROM system_settings WHERE key = 'metrics_retention_days'
    `);
    
    const days = parseInt(retentionDays.rows[0]?.value) || 90;
    const cutoffDate = moment().subtract(days, 'days').toDate();

    await this.db.query(`
      DELETE FROM analytics_events 
      WHERE created_at < $1
    `, [cutoffDate]);

    // Clear old cache entries
    const now = Date.now();
    for (const [key, value] of this.metricsCache) {
      if (now - value.timestamp > this.cacheTimeout * 2) {
        this.metricsCache.delete(key);
      }
    }
  }

  async getSystemAnalytics() {
    const systemMetrics = await this.db.query(`
      SELECT value FROM system_settings WHERE key = 'system_metrics'
    `);

    return systemMetrics.rows[0] ? JSON.parse(systemMetrics.rows[0].value) : null;
  }

  getStatus() {
    return {
      cacheSize: this.metricsCache.size,
      realTimeUsers: this.realTimeMetrics.size,
      isCollecting: true
    };
  }
}

module.exports = AnalyticsEngine;
