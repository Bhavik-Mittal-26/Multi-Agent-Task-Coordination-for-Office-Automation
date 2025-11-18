const { v4: uuidv4 } = require('uuid');

class PredictiveAnalytics {
  constructor(db, io) {
    this.db = db;
    this.io = io;
    this.predictions = new Map();
    this.models = {
      workload: 'active',
      productivity: 'active',
      meetingConflicts: 'active',
      taskCompletion: 'active',
      resourceUtilization: 'active'
    };
  }

  async generatePredictions(userId, timeRange = '7d') {
    try {
      const predictionId = uuidv4();
      
      // Simulate prediction generation
      const predictions = await this.performPredictiveAnalysis(timeRange);
      
      // Store predictions
      this.predictions.set(predictionId, {
        id: predictionId,
        userId,
        timeRange,
        predictions,
        generatedAt: new Date(),
        accuracy: this.calculateAccuracy()
      });

      // Emit real-time update
      this.io.to(`user-${userId}`).emit('predictions-generated', {
        predictionId,
        predictions,
        timestamp: new Date()
      });

      return {
        predictionId,
        predictions,
        accuracy: this.calculateAccuracy(),
        generatedAt: new Date()
      };

    } catch (error) {
      console.error('Prediction generation error:', error);
      throw error;
    }
  }

  async performPredictiveAnalysis(timeRange) {
    // Simulate AI-powered predictive analysis
    const predictions = {
      workload: this.predictWorkload(timeRange),
      productivity: this.predictProductivity(timeRange),
      meetingConflicts: this.predictMeetingConflicts(timeRange),
      taskCompletion: this.predictTaskCompletion(timeRange),
      resourceUtilization: this.predictResourceUtilization(timeRange),
      trends: this.analyzeTrends(timeRange),
      recommendations: this.generateRecommendations(timeRange)
    };

    return predictions;
  }

  predictWorkload(timeRange) {
    const days = this.parseTimeRange(timeRange);
    const baseWorkload = 75; // Base workload percentage
    const variance = 15; // Variance in workload
    
    const workloadData = [];
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      
      // Simulate workload patterns (higher on weekdays, lower on weekends)
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const dayMultiplier = isWeekend ? 0.6 : 1.0;
      
      // Add some randomness and trends
      const randomFactor = (Math.random() - 0.5) * variance;
      const trendFactor = Math.sin(i * 0.3) * 5; // Weekly trend
      
      const workload = Math.max(0, Math.min(100, 
        baseWorkload * dayMultiplier + randomFactor + trendFactor
      ));
      
      workloadData.push({
        date: date.toISOString().split('T')[0],
        workload: Math.round(workload),
        confidence: Math.random() * 0.2 + 0.8 // 80-100% confidence
      });
    }

    return {
      data: workloadData,
      average: Math.round(workloadData.reduce((sum, d) => sum + d.workload, 0) / workloadData.length),
      peak: Math.max(...workloadData.map(d => d.workload)),
      trend: this.calculateTrend(workloadData.map(d => d.workload))
    };
  }

  predictProductivity(timeRange) {
    const days = this.parseTimeRange(timeRange);
    const baseProductivity = 85;
    const variance = 10;
    
    const productivityData = [];
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      
      const randomFactor = (Math.random() - 0.5) * variance;
      const weeklyPattern = Math.sin(i * 0.3) * 3; // Weekly productivity pattern
      
      const productivity = Math.max(0, Math.min(100, 
        baseProductivity + randomFactor + weeklyPattern
      ));
      
      productivityData.push({
        date: date.toISOString().split('T')[0],
        productivity: Math.round(productivity),
        factors: {
          meetings: Math.round(Math.random() * 30 + 20),
          interruptions: Math.round(Math.random() * 20 + 10),
          focusTime: Math.round(Math.random() * 40 + 60)
        }
      });
    }

    return {
      data: productivityData,
      average: Math.round(productivityData.reduce((sum, d) => sum + d.productivity, 0) / productivityData.length),
      trend: this.calculateTrend(productivityData.map(d => d.productivity)),
      insights: [
        'Productivity peaks on Tuesday and Wednesday',
        'Meeting load affects focus time significantly',
        'Interruptions are highest on Monday mornings'
      ]
    };
  }

  predictMeetingConflicts(timeRange) {
    const days = this.parseTimeRange(timeRange);
    const conflicts = [];
    
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      
      if (!isWeekend) {
        const conflictProbability = Math.random() * 0.3 + 0.1; // 10-40% chance
        const meetingCount = Math.floor(Math.random() * 8 + 2); // 2-10 meetings
        const expectedConflicts = Math.floor(meetingCount * conflictProbability);
        
        if (expectedConflicts > 0) {
          conflicts.push({
            date: date.toISOString().split('T')[0],
            conflicts: expectedConflicts,
            meetings: meetingCount,
            probability: Math.round(conflictProbability * 100),
            suggestedActions: this.getConflictResolutionSuggestions(expectedConflicts)
          });
        }
      }
    }

    return {
      data: conflicts,
      totalConflicts: conflicts.reduce((sum, c) => sum + c.conflicts, 0),
      highRiskDays: conflicts.filter(c => c.probability > 30).length,
      recommendations: [
        'Schedule buffer time between meetings',
        'Use AI scheduling to optimize time slots',
        'Consider async alternatives for low-priority meetings'
      ]
    };
  }

  predictTaskCompletion(timeRange) {
    const days = this.parseTimeRange(timeRange);
    const tasks = [];
    
    // Simulate different types of tasks
    const taskTypes = [
      { name: 'Development', avgDuration: 4, priority: 'high' },
      { name: 'Code Review', avgDuration: 1, priority: 'medium' },
      { name: 'Documentation', avgDuration: 2, priority: 'low' },
      { name: 'Testing', avgDuration: 3, priority: 'high' },
      { name: 'Planning', avgDuration: 1, priority: 'medium' }
    ];
    
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      
      const dayTasks = [];
      const taskCount = Math.floor(Math.random() * 5 + 3); // 3-8 tasks per day
      
      for (let j = 0; j < taskCount; j++) {
        const taskType = taskTypes[Math.floor(Math.random() * taskTypes.length)];
        const completionProbability = this.calculateTaskCompletionProbability(taskType, i);
        
        dayTasks.push({
          id: uuidv4(),
          name: `${taskType.name} Task ${j + 1}`,
          type: taskType.name,
          priority: taskType.priority,
          estimatedDuration: taskType.avgDuration,
          completionProbability: Math.round(completionProbability * 100),
          deadline: this.calculateTaskDeadline(date, taskType.avgDuration)
        });
      }
      
      tasks.push({
        date: date.toISOString().split('T')[0],
        tasks: dayTasks,
        totalTasks: dayTasks.length,
        avgCompletionRate: Math.round(dayTasks.reduce((sum, t) => sum + t.completionProbability, 0) / dayTasks.length)
      });
    }

    return {
      data: tasks,
      totalTasks: tasks.reduce((sum, d) => sum + d.totalTasks, 0),
      avgCompletionRate: Math.round(tasks.reduce((sum, d) => sum + d.avgCompletionRate, 0) / tasks.length),
      riskTasks: tasks.flatMap(d => d.tasks).filter(t => t.completionProbability < 70).length,
      insights: [
        'High-priority tasks have 15% higher completion rates',
        'Tasks scheduled for Tuesday-Thursday show better outcomes',
        'Complex tasks benefit from breaking into smaller subtasks'
      ]
    };
  }

  predictResourceUtilization(timeRange) {
    const days = this.parseTimeRange(timeRange);
    const resources = {
      cpu: [],
      memory: [],
      storage: [],
      network: []
    };
    
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      
      // Simulate resource usage patterns
      const baseUsage = {
        cpu: 45,
        memory: 60,
        storage: 75,
        network: 30
      };
      
      const variance = 15;
      const dayPattern = Math.sin(i * 0.3) * 5; // Weekly pattern
      
      Object.keys(resources).forEach(resource => {
        const randomFactor = (Math.random() - 0.5) * variance;
        const usage = Math.max(0, Math.min(100, 
          baseUsage[resource] + randomFactor + dayPattern
        ));
        
        resources[resource].push({
          date: date.toISOString().split('T')[0],
          usage: Math.round(usage),
          status: usage > 80 ? 'critical' : usage > 60 ? 'warning' : 'normal'
        });
      });
    }

    return {
      data: resources,
      alerts: this.generateResourceAlerts(resources),
      recommendations: [
        'Consider scaling CPU resources for peak usage periods',
        'Memory usage is trending upward - monitor closely',
        'Storage cleanup recommended within 2 weeks',
        'Network capacity is sufficient for current load'
      ]
    };
  }

  analyzeTrends(timeRange) {
    return {
      productivity: {
        direction: 'increasing',
        rate: 2.3,
        confidence: 0.87
      },
      workload: {
        direction: 'stable',
        rate: 0.1,
        confidence: 0.92
      },
      meetingEfficiency: {
        direction: 'improving',
        rate: 1.8,
        confidence: 0.79
      },
      taskCompletion: {
        direction: 'increasing',
        rate: 3.2,
        confidence: 0.85
      }
    };
  }

  generateRecommendations(timeRange) {
    const recommendations = [
      {
        category: 'Productivity',
        priority: 'high',
        title: 'Optimize Meeting Schedule',
        description: 'Reduce meeting conflicts by 25% by implementing AI scheduling',
        impact: 'High',
        effort: 'Medium',
        timeline: '1 week'
      },
      {
        category: 'Resource Management',
        priority: 'medium',
        title: 'Scale Infrastructure',
        description: 'CPU usage trending upward - consider scaling resources',
        impact: 'Medium',
        effort: 'Low',
        timeline: '2 weeks'
      },
      {
        category: 'Task Management',
        priority: 'high',
        title: 'Implement Task Batching',
        description: 'Group similar tasks to improve completion rates',
        impact: 'High',
        effort: 'Low',
        timeline: '3 days'
      },
      {
        category: 'Workload',
        priority: 'medium',
        title: 'Distribute Workload',
        description: 'Balance workload across team members for better efficiency',
        impact: 'Medium',
        effort: 'Medium',
        timeline: '1 week'
      }
    ];

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  // Helper methods
  parseTimeRange(timeRange) {
    const match = timeRange.match(/(\d+)([dwmy])/);
    if (!match) return 7; // Default to 7 days
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    switch (unit) {
      case 'd': return value;
      case 'w': return value * 7;
      case 'm': return value * 30;
      case 'y': return value * 365;
      default: return 7;
    }
  }

  calculateTrend(data) {
    if (data.length < 2) return 'stable';
    
    const first = data[0];
    const last = data[data.length - 1];
    const change = ((last - first) / first) * 100;
    
    if (change > 5) return 'increasing';
    if (change < -5) return 'decreasing';
    return 'stable';
  }

  calculateTaskCompletionProbability(taskType, dayOffset) {
    const baseProbability = {
      'Development': 0.75,
      'Code Review': 0.90,
      'Documentation': 0.85,
      'Testing': 0.80,
      'Planning': 0.95
    };
    
    const priorityMultiplier = {
      'high': 1.1,
      'medium': 1.0,
      'low': 0.9
    };
    
    const dayMultiplier = Math.sin(dayOffset * 0.3) * 0.1 + 1.0; // Weekly pattern
    
    return Math.min(0.95, 
      baseProbability[taskType.name] * priorityMultiplier[taskType.priority] * dayMultiplier
    );
  }

  calculateTaskDeadline(date, duration) {
    const deadline = new Date(date);
    deadline.setDate(deadline.getDate() + Math.ceil(duration / 2)); // Half the estimated duration
    return deadline.toISOString().split('T')[0];
  }

  getConflictResolutionSuggestions(conflictCount) {
    const suggestions = [
      'Use AI scheduling to find optimal time slots',
      'Implement meeting buffer times',
      'Consider async alternatives for non-critical meetings',
      'Use calendar integration to detect conflicts early'
    ];
    
    return suggestions.slice(0, Math.min(conflictCount, suggestions.length));
  }

  generateResourceAlerts(resources) {
    const alerts = [];
    
    Object.keys(resources).forEach(resource => {
      const latest = resources[resource][resources[resource].length - 1];
      if (latest.status === 'critical') {
        alerts.push({
          resource,
          level: 'critical',
          message: `${resource.toUpperCase()} usage is at ${latest.usage}%`,
          action: 'Immediate scaling required'
        });
      } else if (latest.status === 'warning') {
        alerts.push({
          resource,
          level: 'warning',
          message: `${resource.toUpperCase()} usage is at ${latest.usage}%`,
          action: 'Monitor closely'
        });
      }
    });
    
    return alerts;
  }

  calculateAccuracy() {
    // Simulate model accuracy based on historical performance
    return Math.random() * 0.1 + 0.85; // 85-95% accuracy
  }

  async getPredictionHistory(userId, limit = 10) {
    // Mock prediction history
    return Array.from(this.predictions.values())
      .filter(p => p.userId === userId)
      .sort((a, b) => b.generatedAt - a.generatedAt)
      .slice(0, limit);
  }

  getStatus() {
    return {
      activeModels: Object.keys(this.models).length,
      totalPredictions: this.predictions.size,
      modelAccuracy: this.calculateAccuracy(),
      lastUpdated: new Date()
    };
  }
}

module.exports = PredictiveAnalytics;
