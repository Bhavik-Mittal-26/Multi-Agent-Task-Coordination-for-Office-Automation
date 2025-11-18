const EventEmitter = require('events');
const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');

class AgentOrchestrator extends EventEmitter {
  constructor(db, io) {
    super();
    this.db = db;
    this.io = io;
    this.agents = new Map();
    this.agentInstances = new Map();
    this.coordinationRules = new Map();
    this.conflictResolver = new ConflictResolver();
    this.performanceTracker = new PerformanceTracker();
    this.isRunning = false;
    
    this.initializeAgents();
    this.setupCoordinationRules();
    this.startScheduler();
  }

  async initializeAgents() {
    try {
      // Load agent definitions from database
      const agentDefs = await this.db.query('SELECT * FROM agents WHERE is_active = true');
      
      for (const agentDef of agentDefs.rows) {
        const agentClass = this.getAgentClass(agentDef.type);
        if (agentClass) {
          this.agents.set(agentDef.id, {
            definition: agentDef,
            class: agentClass,
            instances: new Map()
          });
        }
      }
      
      console.log(`🤖 Initialized ${this.agents.size} agent types`);
    } catch (error) {
      console.error('Failed to initialize agents:', error);
    }
  }

  getAgentClass(type) {
    const agentClasses = {
      'meeting-agent': MeetingAgent,
      'mail-summarizer': MailSummarizerAgent,
      'report-generator': ReportGeneratorAgent,
      'task-router': TaskRouterAgent
    };
    return agentClasses[type];
  }

  setupCoordinationRules() {
    // Define how agents should coordinate with each other
    this.coordinationRules.set('meeting-agent', {
      dependencies: ['mail-summarizer'],
      conflicts: ['task-router'],
      priority: 1
    });
    
    this.coordinationRules.set('mail-summarizer', {
      dependencies: [],
      conflicts: [],
      priority: 2
    });
    
    this.coordinationRules.set('report-generator', {
      dependencies: ['meeting-agent', 'mail-summarizer', 'task-router'],
      conflicts: [],
      priority: 3
    });
    
    this.coordinationRules.set('task-router', {
      dependencies: ['mail-summarizer'],
      conflicts: ['meeting-agent'],
      priority: 2
    });
  }

  async createAgentInstance(userId, agentId, config = {}) {
    try {
      const agentDef = this.agents.get(agentId);
      if (!agentDef) {
        throw new Error(`Agent ${agentId} not found`);
      }

      const instanceId = uuidv4();
      const instance = new agentDef.class({
        id: instanceId,
        userId,
        agentId,
        config: { ...agentDef.definition.configuration, ...config },
        db: this.db,
        orchestrator: this
      });

      // Store instance
      agentDef.instances.set(instanceId, instance);
      this.agentInstances.set(instanceId, instance);

      // Save to database
      await this.db.query(`
        INSERT INTO user_agents (user_id, agent_id, status, settings)
        VALUES ($1, $2, 'idle', $3)
        ON CONFLICT (user_id, agent_id) 
        DO UPDATE SET settings = $3, updated_at = CURRENT_TIMESTAMP
      `, [userId, agentId, JSON.stringify(config)]);

      // Emit event
      this.emit('agent-created', { instanceId, userId, agentId });
      this.io.emit('agent-status-changed', { 
        userId, 
        agentId, 
        status: 'idle',
        instanceId 
      });

      return instanceId;
    } catch (error) {
      console.error('Failed to create agent instance:', error);
      throw error;
    }
  }

  async runAgent(instanceId, params = {}) {
    try {
      const instance = this.agentInstances.get(instanceId);
      if (!instance) {
        throw new Error(`Agent instance ${instanceId} not found`);
      }

      // Check for conflicts with other running agents
      const conflicts = await this.checkConflicts(instance);
      if (conflicts.length > 0) {
        await this.resolveConflicts(conflicts, instance);
      }

      // Update status
      await this.updateAgentStatus(instanceId, 'running');
      
      // Run the agent
      const result = await instance.run(params);
      
      // Update performance metrics
      await this.performanceTracker.recordExecution(instanceId, result);
      
      // Update status
      await this.updateAgentStatus(instanceId, 'idle');
      
      // Emit results
      this.emit('agent-completed', { instanceId, result });
      this.io.to(`user-${instance.userId}`).emit('agent-result', {
        instanceId,
        agentId: instance.agentId,
        result
      });

      return result;
    } catch (error) {
      console.error(`Failed to run agent ${instanceId}:`, error);
      await this.updateAgentStatus(instanceId, 'error');
      throw error;
    }
  }

  async checkConflicts(instance) {
    const rules = this.coordinationRules.get(instance.agentId);
    if (!rules) return [];

    const conflicts = [];
    for (const [otherInstanceId, otherInstance] of this.agentInstances) {
      if (otherInstance.userId === instance.userId && 
          otherInstance.status === 'running' &&
          rules.conflicts.includes(otherInstance.agentId)) {
        conflicts.push({
          type: 'agent-conflict',
          instance1: instance,
          instance2: otherInstance,
          severity: 'medium'
        });
      }
    }

    return conflicts;
  }

  async resolveConflicts(conflicts, instance) {
    for (const conflict of conflicts) {
      const resolution = await this.conflictResolver.resolve(conflict);
      
      if (resolution.action === 'pause') {
        await this.pauseAgent(conflict.instance2.id);
      } else if (resolution.action === 'queue') {
        await this.queueAgent(instance.id);
      }
    }
  }

  async updateAgentStatus(instanceId, status) {
    try {
      const instance = this.agentInstances.get(instanceId);
      if (!instance) return;

      instance.status = status;
      
      await this.db.query(`
        UPDATE user_agents 
        SET status = $1, last_run = CASE WHEN $1 = 'idle' THEN CURRENT_TIMESTAMP ELSE last_run END
        WHERE user_id = $2 AND agent_id = $3
      `, [status, instance.userId, instance.agentId]);

      this.io.to(`user-${instance.userId}`).emit('agent-status-changed', {
        instanceId,
        agentId: instance.agentId,
        status,
        userId: instance.userId
      });
    } catch (error) {
      console.error('Failed to update agent status:', error);
    }
  }

  async pauseAgent(instanceId) {
    const instance = this.agentInstances.get(instanceId);
    if (instance && instance.pause) {
      await instance.pause();
      await this.updateAgentStatus(instanceId, 'paused');
    }
  }

  async queueAgent(instanceId) {
    // Add to queue for later execution
    this.emit('agent-queued', { instanceId });
  }

  startScheduler() {
    // Run every minute to check for auto-run agents
    cron.schedule('* * * * *', async () => {
      if (!this.isRunning) return;
      
      try {
        const autoRunAgents = await this.db.query(`
          SELECT ua.*, a.type, a.name 
          FROM user_agents ua
          JOIN agents a ON ua.agent_id = a.id
          WHERE ua.auto_run_enabled = true 
          AND ua.status = 'idle'
          AND (ua.last_run IS NULL OR 
               ua.last_run < NOW() - INTERVAL '1 minute' * ua.auto_run_interval)
        `);

        for (const agent of autoRunAgents.rows) {
          const instanceId = await this.createAgentInstance(
            agent.user_id, 
            agent.agent_id, 
            agent.settings
          );
          await this.runAgent(instanceId);
        }
      } catch (error) {
        console.error('Scheduler error:', error);
      }
    });

    this.isRunning = true;
    console.log('⏰ Agent scheduler started');
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      totalAgents: this.agents.size,
      activeInstances: this.agentInstances.size,
      runningInstances: Array.from(this.agentInstances.values())
        .filter(instance => instance.status === 'running').length
    };
  }

  async getAgentPerformance(userId) {
    return await this.performanceTracker.getUserPerformance(userId);
  }
}

// Agent Base Class
class BaseAgent {
  constructor({ id, userId, agentId, config, db, orchestrator }) {
    this.id = id;
    this.userId = userId;
    this.agentId = agentId;
    this.config = config;
    this.db = db;
    this.orchestrator = orchestrator;
    this.status = 'idle';
    this.metrics = {
      totalRuns: 0,
      successRate: 0,
      averageExecutionTime: 0,
      lastRun: null
    };
  }

  async run(params = {}) {
    const startTime = Date.now();
    this.status = 'running';
    
    try {
      const result = await this.execute(params);
      this.updateMetrics(true, Date.now() - startTime);
      return result;
    } catch (error) {
      this.updateMetrics(false, Date.now() - startTime);
      throw error;
    } finally {
      this.status = 'idle';
    }
  }

  updateMetrics(success, executionTime) {
    this.metrics.totalRuns++;
    this.metrics.successRate = ((this.metrics.successRate * (this.metrics.totalRuns - 1)) + (success ? 1 : 0)) / this.metrics.totalRuns;
    this.metrics.averageExecutionTime = ((this.metrics.averageExecutionTime * (this.metrics.totalRuns - 1)) + executionTime) / this.metrics.totalRuns;
    this.metrics.lastRun = new Date();
  }

  async execute(params) {
    throw new Error('execute method must be implemented by subclass');
  }
}

// Specific Agent Implementations
class MeetingAgent extends BaseAgent {
  async execute(params) {
    // Simulate meeting scheduling logic
    const meetings = await this.db.query(`
      SELECT * FROM shared_context 
      WHERE user_id = $1 AND context_type = 'schedule'
      ORDER BY created_at DESC
    `, [this.userId]);

    // Detect conflicts
    const conflicts = this.detectScheduleConflicts(meetings.rows);
    
    // Auto-resolve if enabled
    if (this.config.auto_resolve_conflicts && conflicts.length > 0) {
      await this.resolveScheduleConflicts(conflicts);
    }

    return {
      meetingsProcessed: meetings.rows.length,
      conflictsDetected: conflicts.length,
      conflictsResolved: this.config.auto_resolve_conflicts ? conflicts.length : 0
    };
  }

  detectScheduleConflicts(meetings) {
    const conflicts = [];
    for (let i = 0; i < meetings.length; i++) {
      for (let j = i + 1; j < meetings.length; j++) {
        const meeting1 = meetings[i].data;
        const meeting2 = meetings[j].data;
        
        if (this.isTimeOverlap(meeting1, meeting2)) {
          conflicts.push({
            type: 'schedule_overlap',
            meeting1,
            meeting2,
            severity: 'medium'
          });
        }
      }
    }
    return conflicts;
  }

  isTimeOverlap(meeting1, meeting2) {
    // Simplified overlap detection
    return meeting1.date === meeting2.date && 
           meeting1.time === meeting2.time;
  }

  async resolveScheduleConflicts(conflicts) {
    for (const conflict of conflicts) {
      // Auto-resolve by rescheduling the second meeting
      const newTime = this.findNextAvailableSlot(conflict.meeting1);
      if (newTime) {
        await this.db.query(`
          UPDATE shared_context 
          SET data = jsonb_set(data, '{time}', $1)
          WHERE id = $2
        `, [JSON.stringify(newTime), conflict.meeting2.id]);
      }
    }
  }

  findNextAvailableSlot(conflictingMeeting) {
    // Simple slot finding logic
    const time = new Date(`1970-01-01T${conflictingMeeting.time}:00`);
    time.setMinutes(time.getMinutes() + 30);
    return time.toTimeString().slice(0, 5);
  }
}

class MailSummarizerAgent extends BaseAgent {
  async execute(params) {
    // Simulate email processing
    const emails = await this.db.query(`
      SELECT * FROM shared_context 
      WHERE user_id = $1 AND context_type = 'email'
      ORDER BY created_at DESC
      LIMIT 50
    `, [this.userId]);

    const summaries = [];
    for (const email of emails.rows) {
      const summary = await this.summarizeEmail(email.data);
      summaries.push(summary);
    }

    return {
      emailsProcessed: emails.rows.length,
      summariesGenerated: summaries.length,
      actionItemsExtracted: summaries.reduce((count, s) => count + s.actionItems.length, 0)
    };
  }

  async summarizeEmail(emailData) {
    // Simulate AI summarization
    return {
      subject: emailData.subject,
      summary: `Summary of ${emailData.subject}`,
      actionItems: ['Follow up on proposal', 'Schedule meeting'],
      sentiment: 'positive',
      priority: 'medium'
    };
  }
}

class ReportGeneratorAgent extends BaseAgent {
  async execute(params) {
    const reportData = await this.gatherReportData();
    const report = await this.generateReport(reportData, params.format || 'html');
    
    // Save report to database
    const result = await this.db.query(`
      INSERT INTO reports (user_id, name, type, format, data, status, generated_at)
      VALUES ($1, $2, $3, $4, $5, 'completed', CURRENT_TIMESTAMP)
      RETURNING id
    `, [
      this.userId,
      `Report ${new Date().toISOString().slice(0, 10)}`,
      'ad-hoc',
      params.format || 'html',
      JSON.stringify(report)
    ]);

    return {
      reportId: result.rows[0].id,
      format: params.format || 'html',
      sections: Object.keys(report).length
    };
  }

  async gatherReportData() {
    const [meetings, tasks, activities] = await Promise.all([
      this.db.query('SELECT COUNT(*) FROM shared_context WHERE user_id = $1 AND context_type = $2', [this.userId, 'schedule']),
      this.db.query('SELECT COUNT(*) FROM tasks WHERE user_id = $1', [this.userId]),
      this.db.query('SELECT COUNT(*) FROM activities WHERE user_id = $1 AND created_at > NOW() - INTERVAL \'7 days\'', [this.userId])
    ]);

    return {
      meetings: parseInt(meetings.rows[0].count),
      tasks: parseInt(tasks.rows[0].count),
      activities: parseInt(activities.rows[0].count)
    };
  }

  async generateReport(data, format) {
    return {
      title: 'Weekly Activity Report',
      generatedAt: new Date().toISOString(),
      summary: {
        totalMeetings: data.meetings,
        totalTasks: data.tasks,
        totalActivities: data.activities
      },
      sections: {
        meetings: { count: data.meetings, trend: 'up' },
        tasks: { count: data.tasks, trend: 'stable' },
        activities: { count: data.activities, trend: 'up' }
      }
    };
  }
}

class TaskRouterAgent extends BaseAgent {
  async execute(params) {
    const pendingTasks = await this.db.query(`
      SELECT * FROM tasks 
      WHERE user_id = $1 AND status = 'pending'
      ORDER BY priority DESC, created_at ASC
    `, [this.userId]);

    const routedTasks = [];
    for (const task of pendingTasks.rows) {
      const assignment = await this.routeTask(task);
      if (assignment) {
        await this.db.query(`
          UPDATE tasks 
          SET assigned_to = $1, status = 'in-progress', updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [assignment.assignee, task.id]);
        
        routedTasks.push({
          taskId: task.id,
          assignee: assignment.assignee,
          estimatedCompletion: assignment.estimatedCompletion
        });
      }
    }

    return {
      tasksProcessed: pendingTasks.rows.length,
      tasksRouted: routedTasks.length,
      assignments: routedTasks
    };
  }

  async routeTask(task) {
    // Simple routing logic based on task priority and type
    const assignees = ['John', 'Sarah', 'Mike', 'Lisa'];
    const randomAssignee = assignees[Math.floor(Math.random() * assignees.length)];
    
    return {
      assignee: randomAssignee,
      estimatedCompletion: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    };
  }
}

// Helper Classes
class ConflictResolver {
  async resolve(conflict) {
    switch (conflict.type) {
      case 'agent-conflict':
        return { action: 'pause', target: conflict.instance2.id };
      default:
        return { action: 'queue' };
    }
  }
}

class PerformanceTracker {
  constructor() {
    this.metrics = new Map();
  }

  async recordExecution(instanceId, result) {
    const metrics = this.metrics.get(instanceId) || {
      totalExecutions: 0,
      successfulExecutions: 0,
      totalExecutionTime: 0,
      lastExecution: null
    };

    metrics.totalExecutions++;
    if (result && !result.error) {
      metrics.successfulExecutions++;
    }
    metrics.totalExecutionTime += result.executionTime || 0;
    metrics.lastExecution = new Date();

    this.metrics.set(instanceId, metrics);
  }

  async getUserPerformance(userId) {
    // Aggregate performance metrics for user's agents
    return {
      totalAgents: 4,
      activeAgents: 3,
      averagePerformance: 0.92,
      totalExecutions: 156,
      successRate: 0.94
    };
  }
}

module.exports = AgentOrchestrator;
