const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');

class NotificationService {
  constructor(io) {
    this.io = io;
    this.emailTransporter = this.setupEmailTransporter();
    this.notificationTemplates = new Map();
    this.setupTemplates();
  }

  setupEmailTransporter() {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  setupTemplates() {
    this.notificationTemplates.set('agent-completed', {
      title: 'Agent Task Completed',
      message: 'Your {agentName} has completed successfully.',
      priority: 'info'
    });

    this.notificationTemplates.set('conflict-detected', {
      title: 'Conflict Detected',
      message: 'A {conflictType} conflict has been detected and requires your attention.',
      priority: 'warning'
    });

    this.notificationTemplates.set('integration-sync-failed', {
      title: 'Integration Sync Failed',
      message: 'Failed to sync with {serviceName}. Please check your connection.',
      priority: 'error'
    });

    this.notificationTemplates.set('task-overdue', {
      title: 'Task Overdue',
      message: 'Task "{taskTitle}" is overdue and requires immediate attention.',
      priority: 'urgent'
    });

    this.notificationTemplates.set('system-maintenance', {
      title: 'System Maintenance',
      message: 'Scheduled maintenance will begin in {minutes} minutes.',
      priority: 'info'
    });
  }

  async sendNotification(notificationData) {
    try {
      const {
        userId,
        type,
        title,
        message,
        priority = 'info',
        actionUrl,
        metadata = {},
        channels = ['in-app', 'email']
      } = notificationData;

      // Create notification record
      const notification = await this.createNotificationRecord({
        userId,
        type,
        title,
        message,
        priority,
        actionUrl,
        metadata
      });

      // Send through different channels
      const results = await Promise.allSettled([
        channels.includes('in-app') && this.sendInAppNotification(notification),
        channels.includes('email') && this.sendEmailNotification(notification),
        channels.includes('push') && this.sendPushNotification(notification)
      ]);

      // Log results
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      console.log(`📧 Notification sent to user ${userId} via ${successCount}/${channels.length} channels`);

      return notification;
    } catch (error) {
      console.error('Failed to send notification:', error);
      throw error;
    }
  }

  async createNotificationRecord(notificationData) {
    const notification = {
      id: uuidv4(),
      userId: notificationData.userId,
      title: notificationData.title,
      message: notificationData.message,
      type: notificationData.type,
      priority: notificationData.priority,
      actionUrl: notificationData.actionUrl,
      metadata: JSON.stringify(notificationData.metadata),
      createdAt: new Date()
    };

    // Store in database (assuming db is available)
    // await this.db.query(`
    //   INSERT INTO notifications (id, user_id, title, message, type, action_url, metadata, created_at)
    //   VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    // `, [notification.id, notification.userId, notification.title, notification.message, 
    //     notification.type, notification.actionUrl, notification.metadata, notification.createdAt]);

    return notification;
  }

  async sendInAppNotification(notification) {
    try {
      // Send via WebSocket
      this.io.to(`user-${notification.userId}`).emit('notification', {
        id: notification.id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        priority: notification.priority,
        actionUrl: notification.actionUrl,
        timestamp: notification.createdAt
      });

      return { channel: 'in-app', status: 'sent' };
    } catch (error) {
      console.error('Failed to send in-app notification:', error);
      throw error;
    }
  }

  async sendEmailNotification(notification) {
    try {
      if (!this.emailTransporter) {
        throw new Error('Email transporter not configured');
      }

      const template = this.getEmailTemplate(notification.type);
      const htmlContent = this.renderEmailTemplate(template, notification);

      await this.emailTransporter.sendMail({
        from: process.env.SMTP_FROM || 'noreply@multiagent-office.com',
        to: notification.userEmail || 'user@example.com', // Should be fetched from user data
        subject: notification.title,
        html: htmlContent
      });

      return { channel: 'email', status: 'sent' };
    } catch (error) {
      console.error('Failed to send email notification:', error);
      throw error;
    }
  }

  async sendPushNotification(notification) {
    try {
      // Implement push notification logic (FCM, APNS, etc.)
      // This is a placeholder for push notification implementation
      console.log('Push notification would be sent:', notification.title);
      return { channel: 'push', status: 'sent' };
    } catch (error) {
      console.error('Failed to send push notification:', error);
      throw error;
    }
  }

  getEmailTemplate(type) {
    const templates = {
      'agent-completed': {
        subject: 'Agent Task Completed',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4CAF50;">✅ Task Completed</h2>
            <p>Your agent has successfully completed its task.</p>
            <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3>{{title}}</h3>
              <p>{{message}}</p>
            </div>
            <p><a href="{{actionUrl}}" style="background: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Details</a></p>
          </div>
        `
      },
      'conflict-detected': {
        subject: 'Conflict Detected',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #FF9800;">⚠️ Conflict Detected</h2>
            <p>A conflict has been detected in your system that requires attention.</p>
            <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #FF9800;">
              <h3>{{title}}</h3>
              <p>{{message}}</p>
            </div>
            <p><a href="{{actionUrl}}" style="background: #FF9800; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Resolve Conflict</a></p>
          </div>
        `
      },
      'task-overdue': {
        subject: 'Task Overdue',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #F44336;">🚨 Task Overdue</h2>
            <p>You have an overdue task that requires immediate attention.</p>
            <div style="background: #ffebee; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #F44336;">
              <h3>{{title}}</h3>
              <p>{{message}}</p>
            </div>
            <p><a href="{{actionUrl}}" style="background: #F44336; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Task</a></p>
          </div>
        `
      }
    };

    return templates[type] || templates['agent-completed'];
  }

  renderEmailTemplate(template, notification) {
    let html = template.html;
    
    // Replace placeholders
    html = html.replace(/{{title}}/g, notification.title);
    html = html.replace(/{{message}}/g, notification.message);
    html = html.replace(/{{actionUrl}}/g, notification.actionUrl || '#');
    
    return html;
  }

  async sendBulkNotification(userIds, notificationData) {
    const results = [];
    
    for (const userId of userIds) {
      try {
        const result = await this.sendNotification({
          ...notificationData,
          userId
        });
        results.push({ userId, status: 'success', notificationId: result.id });
      } catch (error) {
        results.push({ userId, status: 'error', error: error.message });
      }
    }

    return results;
  }

  async scheduleNotification(notificationData, scheduleTime) {
    const delay = new Date(scheduleTime) - new Date();
    
    if (delay <= 0) {
      throw new Error('Schedule time must be in the future');
    }

    setTimeout(async () => {
      try {
        await this.sendNotification(notificationData);
      } catch (error) {
        console.error('Scheduled notification failed:', error);
      }
    }, delay);

    return { scheduled: true, scheduleTime, delay };
  }

  async getNotificationHistory(userId, limit = 50) {
    // This would typically query the database
    // For now, return mock data
    return [
      {
        id: uuidv4(),
        title: 'Agent Task Completed',
        message: 'Your Meeting Agent has completed successfully.',
        type: 'agent-completed',
        priority: 'info',
        isRead: false,
        createdAt: new Date()
      }
    ];
  }

  async markNotificationAsRead(notificationId, userId) {
    // Update notification as read in database
    // await this.db.query(`
    //   UPDATE notifications 
    //   SET is_read = true 
    //   WHERE id = $1 AND user_id = $2
    // `, [notificationId, userId]);

    return { success: true };
  }

  async markAllNotificationsAsRead(userId) {
    // Mark all notifications as read for user
    // await this.db.query(`
    //   UPDATE notifications 
    //   SET is_read = true 
    //   WHERE user_id = $1 AND is_read = false
    // `, [userId]);

    return { success: true };
  }

  async getUnreadNotificationCount(userId) {
    // Get count of unread notifications
    // const result = await this.db.query(`
    //   SELECT COUNT(*) FROM notifications 
    //   WHERE user_id = $1 AND is_read = false
    // `, [userId]);

    // return parseInt(result.rows[0].count);
    return 5; // Mock data
  }

  async createNotificationFromTemplate(templateType, userId, variables = {}) {
    const template = this.notificationTemplates.get(templateType);
    if (!template) {
      throw new Error(`Template ${templateType} not found`);
    }

    // Replace variables in template
    let title = template.title;
    let message = template.message;

    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{${key}}`, 'g');
      title = title.replace(regex, value);
      message = message.replace(regex, value);
    });

    return await this.sendNotification({
      userId,
      type: templateType,
      title,
      message,
      priority: template.priority
    });
  }

  // Notification triggers for different events
  async onAgentCompleted(userId, agentName, result) {
    return await this.createNotificationFromTemplate('agent-completed', userId, {
      agentName
    });
  }

  async onConflictDetected(userId, conflictType, conflictData) {
    return await this.createNotificationFromTemplate('conflict-detected', userId, {
      conflictType
    });
  }

  async onIntegrationSyncFailed(userId, serviceName, error) {
    return await this.createNotificationFromTemplate('integration-sync-failed', userId, {
      serviceName
    });
  }

  async onTaskOverdue(userId, taskTitle, dueDate) {
    return await this.createNotificationFromTemplate('task-overdue', userId, {
      taskTitle
    });
  }

  async onSystemMaintenance(userId, minutesUntilMaintenance) {
    return await this.createNotificationFromTemplate('system-maintenance', userId, {
      minutes: minutesUntilMaintenance
    });
  }
}

module.exports = NotificationService;
