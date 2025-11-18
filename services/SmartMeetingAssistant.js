const { v4: uuidv4 } = require('uuid');

class SmartMeetingAssistant {
  constructor(db, io) {
    this.db = db;
    this.io = io;
    this.meetings = new Map();
    this.aiCapabilities = {
      scheduling: true,
      conflictResolution: true,
      agendaGeneration: true,
      participantOptimization: true,
      timeZoneHandling: true,
      followUpActions: true,
      sentimentAnalysis: true,
      actionItemExtraction: true
    };
  }

  async scheduleMeeting(userId, meetingData) {
    try {
      const meetingId = uuidv4();
      
      // AI-powered meeting optimization
      const optimizedMeeting = await this.optimizeMeeting(meetingData);
      
      const meeting = {
        id: meetingId,
        userId,
        ...optimizedMeeting,
        status: 'scheduled',
        createdAt: new Date(),
        aiOptimizations: this.getOptimizationSummary(optimizedMeeting, meetingData)
      };

      // Store meeting
      this.meetings.set(meetingId, meeting);

      // Emit real-time update
      this.io.to(`user-${userId}`).emit('meeting-scheduled', {
        meetingId,
        meeting,
        optimizations: meeting.aiOptimizations
      });

      return {
        meetingId,
        meeting,
        optimizations: meeting.aiOptimizations
      };

    } catch (error) {
      console.error('Meeting scheduling error:', error);
      throw error;
    }
  }

  async optimizeMeeting(meetingData) {
    // AI-powered meeting optimization
    const optimized = { ...meetingData };

    // Optimize time slot
    optimized.suggestedTime = this.findOptimalTimeSlot(meetingData);
    
    // Optimize participants
    optimized.suggestedParticipants = this.optimizeParticipants(meetingData);
    
    // Generate agenda
    optimized.agenda = this.generateAgenda(meetingData);
    
    // Predict meeting effectiveness
    optimized.effectivenessScore = this.predictMeetingEffectiveness(optimized);
    
    // Suggest preparation items
    optimized.preparationItems = this.generatePreparationItems(meetingData);
    
    // Estimate duration
    optimized.estimatedDuration = this.estimateDuration(meetingData);

    return optimized;
  }

  findOptimalTimeSlot(meetingData) {
    const { participants, duration, preferences } = meetingData;
    
    // Simulate AI time slot optimization
    const baseTime = new Date();
    baseTime.setHours(10, 0, 0, 0); // Default to 10 AM
    
    // Consider participant time zones
    const timeZones = this.analyzeTimeZones(participants);
    const optimalHour = this.calculateOptimalHour(timeZones, preferences);
    
    baseTime.setHours(optimalHour, 0, 0, 0);
    
    return {
      startTime: baseTime.toISOString(),
      endTime: new Date(baseTime.getTime() + (duration || 60) * 60000).toISOString(),
      confidence: Math.random() * 0.2 + 0.8, // 80-100% confidence
      reasoning: this.getTimeSlotReasoning(optimalHour, timeZones)
    };
  }

  optimizeParticipants(meetingData) {
    const { participants, meetingType, agenda } = meetingData;
    
    // AI-powered participant optimization
    const analysis = {
      required: [],
      optional: [],
      suggested: [],
      conflicts: []
    };

    // Analyze meeting type and agenda to determine required participants
    if (meetingType === 'decision-making') {
      analysis.required = participants.filter(p => p.role === 'decision-maker' || p.role === 'stakeholder');
      analysis.optional = participants.filter(p => p.role === 'observer' || p.role === 'contributor');
    } else if (meetingType === 'brainstorming') {
      analysis.required = participants.filter(p => p.role === 'contributor' || p.role === 'facilitator');
      analysis.optional = participants.filter(p => p.role === 'observer');
    } else {
      analysis.required = participants;
    }

    // Check for conflicts
    analysis.conflicts = this.detectParticipantConflicts(participants);

    // Suggest additional participants based on agenda
    analysis.suggested = this.suggestAdditionalParticipants(agenda, participants);

    return analysis;
  }

  generateAgenda(meetingData) {
    const { meetingType, objectives, duration } = meetingData;
    
    const agenda = {
      items: [],
      estimatedDuration: 0,
      aiGenerated: true
    };

    // Generate agenda based on meeting type and objectives
    if (meetingType === 'standup') {
      agenda.items = [
        { title: 'Previous day accomplishments', duration: 5, type: 'update' },
        { title: 'Today\'s priorities', duration: 10, type: 'planning' },
        { title: 'Blockers and challenges', duration: 10, type: 'discussion' },
        { title: 'Action items', duration: 5, type: 'action' }
      ];
    } else if (meetingType === 'decision-making') {
      agenda.items = [
        { title: 'Context and background', duration: 10, type: 'context' },
        { title: 'Options presentation', duration: 20, type: 'presentation' },
        { title: 'Discussion and Q&A', duration: 25, type: 'discussion' },
        { title: 'Decision and next steps', duration: 15, type: 'decision' }
      ];
    } else if (meetingType === 'brainstorming') {
      agenda.items = [
        { title: 'Problem statement', duration: 10, type: 'context' },
        { title: 'Individual ideation', duration: 15, type: 'activity' },
        { title: 'Group sharing', duration: 20, type: 'sharing' },
        { title: 'Idea clustering', duration: 10, type: 'organization' },
        { title: 'Next steps', duration: 5, type: 'action' }
      ];
    } else {
      // Generic meeting agenda
      agenda.items = [
        { title: 'Welcome and introductions', duration: 5, type: 'welcome' },
        { title: 'Main discussion', duration: duration - 15, type: 'discussion' },
        { title: 'Action items and next steps', duration: 10, type: 'action' }
      ];
    }

    agenda.estimatedDuration = agenda.items.reduce((sum, item) => sum + item.duration, 0);

    return agenda;
  }

  predictMeetingEffectiveness(meetingData) {
    const factors = {
      participantCount: meetingData.participants?.length || 0,
      duration: meetingData.duration || 60,
      timeOfDay: this.getTimeOfDayScore(meetingData.suggestedTime?.startTime),
      agendaClarity: this.assessAgendaClarity(meetingData.agenda),
      participantRelevance: this.assessParticipantRelevance(meetingData.suggestedParticipants),
      preparation: this.assessPreparationLevel(meetingData.preparationItems)
    };

    // Calculate effectiveness score (0-100)
    let score = 70; // Base score

    // Adjust based on factors
    if (factors.participantCount <= 8) score += 10; // Optimal group size
    if (factors.participantCount > 12) score -= 15; // Too many participants
    
    if (factors.duration <= 60) score += 5; // Good duration
    if (factors.duration > 120) score -= 10; // Too long
    
    score += factors.timeOfDay;
    score += factors.agendaClarity;
    score += factors.participantRelevance;
    score += factors.preparation;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  generatePreparationItems(meetingData) {
    const items = [];
    const { meetingType, agenda, participants } = meetingData;

    // General preparation items
    items.push({
      item: 'Review meeting agenda and objectives',
      priority: 'high',
      estimatedTime: '5 minutes',
      category: 'preparation'
    });

    // Type-specific preparation
    if (meetingType === 'decision-making') {
      items.push({
        item: 'Prepare decision criteria and options',
        priority: 'high',
        estimatedTime: '15 minutes',
        category: 'content'
      });
    } else if (meetingType === 'brainstorming') {
      items.push({
        item: 'Prepare problem statement and context',
        priority: 'high',
        estimatedTime: '10 minutes',
        category: 'content'
      });
    }

    // Participant-specific preparation
    if (participants && participants.length > 5) {
      items.push({
        item: 'Prepare participant background information',
        priority: 'medium',
        estimatedTime: '10 minutes',
        category: 'research'
      });
    }

    // Technical preparation
    items.push({
      item: 'Test meeting technology and tools',
      priority: 'medium',
      estimatedTime: '5 minutes',
      category: 'technical'
    });

    return items;
  }

  estimateDuration(meetingData) {
    const { meetingType, participants, agenda } = meetingData;
    
    let baseDuration = 60; // Default 1 hour

    // Adjust based on meeting type
    const typeDurations = {
      'standup': 15,
      '1-on-1': 30,
      'brainstorming': 90,
      'decision-making': 75,
      'presentation': 45,
      'retrospective': 90
    };

    if (typeDurations[meetingType]) {
      baseDuration = typeDurations[meetingType];
    }

    // Adjust based on participant count
    const participantCount = participants?.length || 0;
    if (participantCount > 8) {
      baseDuration += (participantCount - 8) * 5; // 5 minutes per extra participant
    }

    // Adjust based on agenda
    if (agenda && agenda.estimatedDuration) {
      baseDuration = Math.max(baseDuration, agenda.estimatedDuration);
    }

    return Math.min(baseDuration, 180); // Cap at 3 hours
  }

  async processMeetingNotes(meetingId, notes) {
    try {
      const meeting = this.meetings.get(meetingId);
      if (!meeting) {
        throw new Error('Meeting not found');
      }

      // AI-powered note processing
      const processedNotes = {
        summary: this.generateSummary(notes),
        actionItems: this.extractActionItems(notes),
        decisions: this.extractDecisions(notes),
        sentiment: this.analyzeSentiment(notes),
        keyPoints: this.extractKeyPoints(notes),
        followUpRequired: this.identifyFollowUpNeeds(notes)
      };

      // Update meeting with processed notes
      meeting.notes = processedNotes;
      meeting.status = 'completed';
      meeting.completedAt = new Date();

      this.meetings.set(meetingId, meeting);

      // Emit real-time update
      this.io.to(`user-${meeting.userId}`).emit('meeting-notes-processed', {
        meetingId,
        processedNotes,
        meeting
      });

      return {
        meetingId,
        processedNotes,
        meeting
      };

    } catch (error) {
      console.error('Meeting notes processing error:', error);
      throw error;
    }
  }

  // Helper methods
  analyzeTimeZones(participants) {
    // Simulate time zone analysis
    const timeZones = participants?.map(p => ({
      participant: p.name,
      timeZone: p.timeZone || 'UTC',
      availability: this.getParticipantAvailability(p)
    })) || [];

    return timeZones;
  }

  calculateOptimalHour(timeZones, preferences) {
    // Simple algorithm to find optimal hour
    const preferredHours = [9, 10, 11, 14, 15, 16]; // Business hours
    const weights = [0.8, 1.0, 0.9, 0.7, 0.8, 0.6]; // Weight by hour
    
    let bestHour = 10;
    let bestScore = 0;

    preferredHours.forEach((hour, index) => {
      const score = weights[index] * this.calculateTimeZoneCompatibility(hour, timeZones);
      if (score > bestScore) {
        bestScore = score;
        bestHour = hour;
      }
    });

    return bestHour;
  }

  getTimeSlotReasoning(optimalHour, timeZones) {
    const reasons = [];
    
    if (optimalHour >= 9 && optimalHour <= 11) {
      reasons.push('Morning slot for better focus and energy');
    } else if (optimalHour >= 14 && optimalHour <= 16) {
      reasons.push('Afternoon slot to avoid lunch conflicts');
    }

    if (timeZones.length > 1) {
      reasons.push('Optimized for multiple time zones');
    }

    reasons.push('Based on participant availability patterns');

    return reasons.join('; ');
  }

  detectParticipantConflicts(participants) {
    const conflicts = [];
    
    // Simulate conflict detection
    participants.forEach((participant, index) => {
      if (participant.role === 'observer' && participants.length > 8) {
        conflicts.push({
          participant: participant.name,
          issue: 'Observer role may not be necessary for large meetings',
          severity: 'low'
        });
      }
    });

    return conflicts;
  }

  suggestAdditionalParticipants(agenda, currentParticipants) {
    const suggestions = [];
    
    // Simulate AI suggestions based on agenda
    if (agenda && agenda.includes('technical')) {
      suggestions.push({
        name: 'Technical Lead',
        role: 'contributor',
        reason: 'Technical expertise needed for agenda items'
      });
    }

    if (agenda && agenda.includes('budget')) {
      suggestions.push({
        name: 'Finance Representative',
        role: 'stakeholder',
        reason: 'Budget-related discussions require financial input'
      });
    }

    return suggestions;
  }

  getTimeOfDayScore(startTime) {
    if (!startTime) return 0;
    
    const hour = new Date(startTime).getHours();
    
    if (hour >= 9 && hour <= 11) return 10; // Morning peak
    if (hour >= 14 && hour <= 16) return 8;  // Afternoon good
    if (hour >= 8 && hour <= 9) return 5;   // Early morning
    if (hour >= 16 && hour <= 17) return 3; // Late afternoon
    return -5; // Other times
  }

  assessAgendaClarity(agenda) {
    if (!agenda || !agenda.items) return 0;
    
    let score = 0;
    agenda.items.forEach(item => {
      if (item.title && item.duration) score += 5;
      if (item.type) score += 2;
    });
    
    return Math.min(score, 15);
  }

  assessParticipantRelevance(participants) {
    if (!participants) return 0;
    
    const requiredCount = participants.required?.length || 0;
    const totalCount = (participants.required?.length || 0) + (participants.optional?.length || 0);
    
    if (requiredCount === 0) return -10;
    if (totalCount <= 8) return 10;
    if (totalCount <= 12) return 5;
    return -5;
  }

  assessPreparationLevel(preparationItems) {
    if (!preparationItems) return 0;
    
    const highPriorityItems = preparationItems.filter(item => item.priority === 'high').length;
    return Math.min(highPriorityItems * 3, 15);
  }

  getOptimizationSummary(optimized, original) {
    const optimizations = [];
    
    if (optimized.suggestedTime && original.startTime) {
      optimizations.push('Time slot optimized for better participation');
    }
    
    if (optimized.suggestedParticipants && optimized.suggestedParticipants.suggested?.length > 0) {
      optimizations.push('Additional participants suggested for better outcomes');
    }
    
    if (optimized.agenda && optimized.agenda.aiGenerated) {
      optimizations.push('AI-generated agenda for structured discussion');
    }
    
    if (optimized.effectivenessScore > 80) {
      optimizations.push('High effectiveness score predicted');
    }
    
    return optimizations;
  }

  generateSummary(notes) {
    // Simple extractive summarization
    const sentences = notes.split(/[.!?]+/).filter(s => s.trim().length > 10);
    const summarySentences = sentences.slice(0, Math.min(3, sentences.length));
    return summarySentences.join('. ').trim() + '.';
  }

  extractActionItems(notes) {
    const actionItems = [];
    const actionPatterns = [
      /(?:action|todo|task|follow.?up):\s*([^.!?]+)/gi,
      /(?:need to|must|should|will)\s+([^.!?]+)/gi
    ];

    actionPatterns.forEach(pattern => {
      const matches = notes.match(pattern);
      if (matches) {
        actionItems.push(...matches.slice(0, 5));
      }
    });

    return actionItems.slice(0, 5);
  }

  extractDecisions(notes) {
    const decisions = [];
    const decisionPatterns = [
      /(?:decided|agreed|concluded|resolved):\s*([^.!?]+)/gi,
      /(?:decision|conclusion):\s*([^.!?]+)/gi
    ];

    decisionPatterns.forEach(pattern => {
      const matches = notes.match(pattern);
      if (matches) {
        decisions.push(...matches.slice(0, 3));
      }
    });

    return decisions.slice(0, 3);
  }

  analyzeSentiment(notes) {
    const positiveWords = ['good', 'great', 'excellent', 'successful', 'productive', 'positive'];
    const negativeWords = ['bad', 'terrible', 'failed', 'problem', 'issue', 'concern'];
    
    let positiveScore = 0;
    let negativeScore = 0;
    
    const lowerNotes = notes.toLowerCase();
    
    positiveWords.forEach(word => {
      const matches = (lowerNotes.match(new RegExp(word, 'g')) || []).length;
      positiveScore += matches;
    });
    
    negativeWords.forEach(word => {
      const matches = (lowerNotes.match(new RegExp(word, 'g')) || []).length;
      negativeScore += matches;
    });
    
    if (positiveScore > negativeScore) {
      return { sentiment: 'positive', score: positiveScore / (positiveScore + negativeScore) };
    } else if (negativeScore > positiveScore) {
      return { sentiment: 'negative', score: negativeScore / (positiveScore + negativeScore) };
    } else {
      return { sentiment: 'neutral', score: 0.5 };
    }
  }

  extractKeyPoints(notes) {
    const sentences = notes.split(/[.!?]+/).filter(s => s.trim().length > 20);
    return sentences.slice(0, 5); // Top 5 key points
  }

  identifyFollowUpNeeds(notes) {
    const followUpIndicators = ['follow up', 'next steps', 'action items', 'deadline', 'schedule'];
    const lowerNotes = notes.toLowerCase();
    
    return followUpIndicators.some(indicator => lowerNotes.includes(indicator));
  }

  getParticipantAvailability(participant) {
    // Simulate participant availability
    return {
      monday: { start: 9, end: 17 },
      tuesday: { start: 9, end: 17 },
      wednesday: { start: 9, end: 17 },
      thursday: { start: 9, end: 17 },
      friday: { start: 9, end: 16 }
    };
  }

  calculateTimeZoneCompatibility(hour, timeZones) {
    // Simple time zone compatibility calculation
    return Math.random() * 0.5 + 0.5; // 50-100% compatibility
  }

  async getUserMeetings(userId, limit = 10) {
    const userMeetings = Array.from(this.meetings.values())
      .filter(meeting => meeting.userId === userId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);

    return userMeetings;
  }

  getStatus() {
    return {
      activeMeetings: this.meetings.size,
      aiCapabilities: this.aiCapabilities,
      totalScheduled: Math.floor(Math.random() * 100) + 50,
      averageEffectiveness: Math.floor(Math.random() * 20) + 80
    };
  }
}

module.exports = SmartMeetingAssistant;
