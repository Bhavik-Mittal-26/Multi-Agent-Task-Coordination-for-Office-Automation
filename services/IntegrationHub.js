const axios = require('axios');
const { google } = require('googleapis');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

class IntegrationHub {
  constructor(db, io) {
    this.db = db;
    this.io = io;
    this.integrations = new Map();
    this.oauthClients = new Map();
    this.syncQueues = new Map();
    
    this.initializeIntegrations();
    this.setupOAuthClients();
    this.startSyncScheduler();
  }

  async initializeIntegrations() {
    try {
      const integrations = await this.db.query(`
        SELECT * FROM integrations WHERE is_connected = true
      `);

      for (const integration of integrations.rows) {
        await this.loadIntegration(integration);
      }

      console.log(`🔗 Initialized ${integrations.rows.length} connected integrations`);
    } catch (error) {
      console.error('Failed to initialize integrations:', error);
    }
  }

  setupOAuthClients() {
    // Google OAuth2 client
    const googleClient = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    this.oauthClients.set('google', googleClient);

    // Microsoft OAuth2 client (simplified)
    this.oauthClients.set('microsoft', {
      clientId: process.env.MICROSOFT_CLIENT_ID,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
      redirectUri: process.env.MICROSOFT_REDIRECT_URI
    });

    console.log('🔐 OAuth clients configured');
  }

  async loadIntegration(integration) {
    const client = this.createIntegrationClient(integration);
    this.integrations.set(integration.id, {
      ...integration,
      client,
      lastSync: integration.last_sync,
      syncStatus: integration.sync_status
    });
  }

  createIntegrationClient(integration) {
    switch (integration.service_name) {
      case 'google-calendar':
        return new GoogleCalendarClient(integration, this.oauthClients.get('google'));
      case 'gmail':
        return new GmailClient(integration, this.oauthClients.get('google'));
      case 'outlook':
        return new OutlookClient(integration, this.oauthClients.get('microsoft'));
      case 'slack':
        return new SlackClient(integration);
      case 'teams':
        return new TeamsClient(integration, this.oauthClients.get('microsoft'));
      case 'notion':
        return new NotionClient(integration);
      default:
        throw new Error(`Unsupported integration: ${integration.service_name}`);
    }
  }

  async connectIntegration(userId, serviceName, authCode) {
    try {
      const oauthClient = this.oauthClients.get(this.getOAuthProvider(serviceName));
      if (!oauthClient) {
        throw new Error(`OAuth client not found for ${serviceName}`);
      }

      // Exchange auth code for tokens
      const tokens = await this.exchangeAuthCode(oauthClient, authCode);
      
      // Store integration
      const result = await this.db.query(`
        INSERT INTO integrations (user_id, service_name, service_type, is_connected, access_token, refresh_token, token_expires_at, settings)
        VALUES ($1, $2, $3, true, $4, $5, $6, $7)
        ON CONFLICT (user_id, service_name) 
        DO UPDATE SET 
          is_connected = true,
          access_token = $4,
          refresh_token = $5,
          token_expires_at = $6,
          settings = $7,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `, [
        userId,
        serviceName,
        this.getServiceType(serviceName),
        tokens.access_token,
        tokens.refresh_token,
        tokens.expiry_date,
        JSON.stringify({ connected_at: new Date().toISOString() })
      ]);

      const integration = result.rows[0];
      await this.loadIntegration(integration);

      // Initial sync
      await this.syncIntegration(userId, serviceName);

      this.io.to(`user-${userId}`).emit('integration-connected', {
        serviceName,
        status: 'connected'
      });

      return integration;
    } catch (error) {
      console.error(`Failed to connect ${serviceName}:`, error);
      throw error;
    }
  }

  async disconnectIntegration(userId, serviceName) {
    try {
      await this.db.query(`
        UPDATE integrations 
        SET is_connected = false, access_token = NULL, refresh_token = NULL, token_expires_at = NULL
        WHERE user_id = $1 AND service_name = $2
      `, [userId, serviceName]);

      // Remove from memory
      for (const [id, integration] of this.integrations) {
        if (integration.user_id === userId && integration.service_name === serviceName) {
          this.integrations.delete(id);
          break;
        }
      }

      this.io.to(`user-${userId}`).emit('integration-disconnected', {
        serviceName,
        status: 'disconnected'
      });
    } catch (error) {
      console.error(`Failed to disconnect ${serviceName}:`, error);
      throw error;
    }
  }

  async syncIntegration(userId, serviceName) {
    try {
      const integration = Array.from(this.integrations.values())
        .find(i => i.user_id === userId && i.service_name === serviceName);

      if (!integration) {
        throw new Error(`Integration not found: ${serviceName}`);
      }

      // Update sync status
      await this.db.query(`
        UPDATE integrations 
        SET sync_status = 'syncing', last_sync = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [integration.id]);

      this.io.to(`user-${userId}`).emit('integration-sync-started', {
        serviceName,
        status: 'syncing'
      });

      // Perform sync based on service type
      const syncResult = await integration.client.sync();

      // Store synced data
      await this.storeSyncedData(userId, serviceName, syncResult);

      // Update sync status
      await this.db.query(`
        UPDATE integrations 
        SET sync_status = 'completed', last_sync = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [integration.id]);

      this.io.to(`user-${userId}`).emit('integration-sync-completed', {
        serviceName,
        status: 'completed',
        dataCount: syncResult.data ? syncResult.data.length : 0
      });

      return syncResult;
    } catch (error) {
      console.error(`Failed to sync ${serviceName}:`, error);
      
      await this.db.query(`
        UPDATE integrations 
        SET sync_status = 'failed'
        WHERE user_id = $1 AND service_name = $2
      `, [userId, serviceName]);

      this.io.to(`user-${userId}`).emit('integration-sync-failed', {
        serviceName,
        status: 'failed',
        error: error.message
      });

      throw error;
    }
  }

  async storeSyncedData(userId, serviceName, syncResult) {
    const serviceType = this.getServiceType(serviceName);
    
    for (const item of syncResult.data || []) {
      await this.db.query(`
        INSERT INTO shared_context (user_id, context_type, data, priority, tags)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT DO NOTHING
      `, [
        userId,
        serviceType,
        JSON.stringify(item),
        item.priority || 'medium',
        item.tags || []
      ]);
    }
  }

  async getIntegrationStatus(userId) {
    const integrations = await this.db.query(`
      SELECT service_name, service_type, is_connected, last_sync, sync_status
      FROM integrations 
      WHERE user_id = $1
    `, [userId]);

    return integrations.rows.map(row => ({
      serviceName: row.service_name,
      serviceType: row.service_type,
      connected: row.is_connected,
      lastSync: row.last_sync,
      syncStatus: row.sync_status
    }));
  }

  startSyncScheduler() {
    // Sync all integrations every 15 minutes
    setInterval(async () => {
      try {
        const connectedIntegrations = await this.db.query(`
          SELECT * FROM integrations 
          WHERE is_connected = true 
          AND (last_sync IS NULL OR last_sync < NOW() - INTERVAL '15 minutes')
        `);

        for (const integration of connectedIntegrations.rows) {
          await this.syncIntegration(integration.user_id, integration.service_name);
        }
      } catch (error) {
        console.error('Scheduled sync error:', error);
      }
    }, 15 * 60 * 1000); // 15 minutes

    console.log('⏰ Integration sync scheduler started');
  }

  getOAuthProvider(serviceName) {
    const providers = {
      'google-calendar': 'google',
      'gmail': 'google',
      'outlook': 'microsoft',
      'teams': 'microsoft'
    };
    return providers[serviceName] || 'google';
  }

  getServiceType(serviceName) {
    const types = {
      'google-calendar': 'schedule',
      'outlook': 'schedule',
      'gmail': 'email',
      'slack': 'chat',
      'teams': 'chat',
      'notion': 'project'
    };
    return types[serviceName] || 'general';
  }

  async exchangeAuthCode(oauthClient, authCode) {
    if (oauthClient.constructor.name === 'OAuth2') {
      // Google OAuth2
      const { tokens } = await oauthClient.getToken(authCode);
      return tokens;
    } else {
      // Microsoft OAuth2 (simplified)
      const response = await axios.post('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        client_id: oauthClient.clientId,
        client_secret: oauthClient.clientSecret,
        code: authCode,
        grant_type: 'authorization_code',
        redirect_uri: oauthClient.redirectUri
      });
      return response.data;
    }
  }

  getStatus() {
    return {
      totalIntegrations: this.integrations.size,
      connectedIntegrations: Array.from(this.integrations.values())
        .filter(i => i.is_connected).length,
      syncQueues: this.syncQueues.size
    };
  }
}

// Integration Client Classes
class BaseIntegrationClient {
  constructor(integration, oauthClient) {
    this.integration = integration;
    this.oauthClient = oauthClient;
  }

  async sync() {
    throw new Error('sync method must be implemented');
  }

  async refreshToken() {
    if (this.oauthClient && this.oauthClient.refreshAccessToken) {
      const { credentials } = await this.oauthClient.refreshAccessToken();
      return credentials;
    }
    return null;
  }
}

class GoogleCalendarClient extends BaseIntegrationClient {
  async sync() {
    try {
      this.oauthClient.setCredentials({
        access_token: this.integration.access_token,
        refresh_token: this.integration.refresh_token
      });

      const calendar = google.calendar({ version: 'v3', auth: this.oauthClient });
      
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: new Date().toISOString(),
        maxResults: 50,
        singleEvents: true,
        orderBy: 'startTime'
      });

      const events = response.data.items.map(event => ({
        id: event.id,
        title: event.summary,
        description: event.description,
        start: event.start.dateTime || event.start.date,
        end: event.end.dateTime || event.end.date,
        location: event.location,
        attendees: event.attendees?.map(a => a.email) || [],
        status: event.status,
        priority: this.determinePriority(event)
      }));

      return { data: events, type: 'calendar' };
    } catch (error) {
      console.error('Google Calendar sync error:', error);
      throw error;
    }
  }

  determinePriority(event) {
    if (event.attendees && event.attendees.length > 5) return 'high';
    if (event.summary?.toLowerCase().includes('urgent')) return 'high';
    return 'medium';
  }
}

class GmailClient extends BaseIntegrationClient {
  async sync() {
    try {
      this.oauthClient.setCredentials({
        access_token: this.integration.access_token,
        refresh_token: this.integration.refresh_token
      });

      const gmail = google.gmail({ version: 'v1', auth: this.oauthClient });
      
      const response = await gmail.users.messages.list({
        userId: 'me',
        maxResults: 50,
        q: 'is:unread'
      });

      const emails = [];
      for (const message of response.data.messages || []) {
        const email = await gmail.users.messages.get({
          userId: 'me',
          id: message.id
        });
        
        emails.push({
          id: message.id,
          subject: this.extractHeader(email.data.payload.headers, 'Subject'),
          from: this.extractHeader(email.data.payload.headers, 'From'),
          date: this.extractHeader(email.data.payload.headers, 'Date'),
          snippet: email.data.snippet,
          priority: this.determineEmailPriority(email.data)
        });
      }

      return { data: emails, type: 'email' };
    } catch (error) {
      console.error('Gmail sync error:', error);
      throw error;
    }
  }

  extractHeader(headers, name) {
    const header = headers.find(h => h.name === name);
    return header ? header.value : '';
  }

  determineEmailPriority(email) {
    const subject = this.extractHeader(email.payload.headers, 'Subject');
    if (subject.toLowerCase().includes('urgent') || subject.toLowerCase().includes('asap')) {
      return 'high';
    }
    return 'medium';
  }
}

class OutlookClient extends BaseIntegrationClient {
  async sync() {
    // Simplified Outlook integration
    return {
      data: [
        {
          id: 'outlook-1',
          title: 'Team Meeting',
          start: new Date().toISOString(),
          end: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          attendees: ['team@company.com'],
          priority: 'medium'
        }
      ],
      type: 'calendar'
    };
  }
}

class SlackClient extends BaseIntegrationClient {
  async sync() {
    // Simplified Slack integration
    return {
      data: [
        {
          id: 'slack-1',
          channel: '#general',
          message: 'Daily standup reminder',
          timestamp: new Date().toISOString(),
          priority: 'medium'
        }
      ],
      type: 'chat'
    };
  }
}

class TeamsClient extends BaseIntegrationClient {
  async sync() {
    // Simplified Teams integration
    return {
      data: [
        {
          id: 'teams-1',
          title: 'Project Review',
          start: new Date().toISOString(),
          participants: ['team@company.com'],
          priority: 'high'
        }
      ],
      type: 'chat'
    };
  }
}

class NotionClient extends BaseIntegrationClient {
  async sync() {
    // Simplified Notion integration
    return {
      data: [
        {
          id: 'notion-1',
          title: 'Project Tasks',
          type: 'database',
          lastModified: new Date().toISOString(),
          priority: 'medium'
        }
      ],
      type: 'project'
    };
  }
}

module.exports = IntegrationHub;
