// Frontend Integration for Multi-Agent Office Backend
// This file shows how to integrate your existing frontend with the new backend

class MultiAgentAPI {
  constructor(baseURL = 'http://localhost:5000/api') {
    this.baseURL = baseURL;
    this.token = localStorage.getItem('authToken');
    this.socket = null;
    this.eventListeners = new Map();
  }

  // Authentication
  async login(email, password) {
    try {
      const response = await fetch(`${this.baseURL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      
      if (response.ok) {
        this.token = data.token;
        localStorage.setItem('authToken', data.token);
        this.connectWebSocket();
        return data;
      } else {
        throw new Error(data.error || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async register(userData) {
    try {
      const response = await fetch(`${this.baseURL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      const data = await response.json();
      
      if (response.ok) {
        this.token = data.token;
        localStorage.setItem('authToken', data.token);
        this.connectWebSocket();
        return data;
      } else {
        throw new Error(data.error || 'Registration failed');
      }
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  logout() {
    this.token = null;
    localStorage.removeItem('authToken');
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  // HTTP Request helper
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(this.token && { Authorization: `Bearer ${this.token}` }),
        ...options.headers,
      },
    };

    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    return data;
  }

  // WebSocket Connection
  connectWebSocket() {
    if (!this.token) return;

    this.socket = io('http://localhost:5000', {
      auth: {
        token: this.token,
      },
    });

    this.socket.on('connect', () => {
      console.log('Connected to WebSocket');
      this.socket.emit('join-user-room', this.getUserId());
    });

    this.socket.on('agent-status-changed', (data) => {
      this.emit('agent-status-changed', data);
    });

    this.socket.on('agent-result', (data) => {
      this.emit('agent-result', data);
    });

    this.socket.on('notification', (data) => {
      this.emit('notification', data);
    });

    this.socket.on('integration-sync-completed', (data) => {
      this.emit('integration-sync-completed', data);
    });
  }

  getUserId() {
    if (!this.token) return null;
    try {
      const payload = JSON.parse(atob(this.token.split('.')[1]));
      return payload.userId;
    } catch {
      return null;
    }
  }

  // Event System
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.eventListeners.has(event)) {
      const listeners = this.eventListeners.get(event);
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach(callback => callback(data));
    }
  }

  // Agents API
  async getAgents() {
    return this.request('/agents');
  }

  async runAgent(agentId, params = {}) {
    return this.request(`/agents/${agentId}/run`, {
      method: 'POST',
      body: JSON.stringify({ params }),
    });
  }

  async updateAgentSettings(agentId, settings) {
    return this.request(`/agents/${agentId}/settings`, {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  async getAgentPerformance(agentId) {
    return this.request(`/agents/${agentId}/performance`);
  }

  // Integrations API
  async getIntegrations() {
    return this.request('/integrations');
  }

  async connectIntegration(serviceName, authCode, settings = {}) {
    return this.request(`/integrations/${serviceName}/connect`, {
      method: 'POST',
      body: JSON.stringify({ authCode, settings }),
    });
  }

  async syncIntegration(serviceName) {
    return this.request(`/integrations/${serviceName}/sync`, {
      method: 'POST',
    });
  }

  async getAvailableServices() {
    return this.request('/integrations/services/available');
  }

  // Analytics API
  async getUserAnalytics(timeRange = '7d') {
    return this.request(`/analytics/user?timeRange=${timeRange}`);
  }

  async trackEvent(eventType, eventData = {}) {
    return this.request('/analytics/track', {
      method: 'POST',
      body: JSON.stringify({ eventType, eventData }),
    });
  }

  async getDashboardData(timeRange = '7d') {
    return this.request(`/analytics/dashboard?timeRange=${timeRange}`);
  }

  // Users API
  async getUserProfile() {
    return this.request('/users/profile');
  }

  async updateProfile(profileData) {
    return this.request('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  }

  async getNotifications(limit = 50, unreadOnly = false) {
    return this.request(`/users/notifications?limit=${limit}&unreadOnly=${unreadOnly}`);
  }

  async markNotificationAsRead(notificationId) {
    return this.request(`/users/notifications/${notificationId}/read`, {
      method: 'PUT',
    });
  }
}

// Integration with your existing frontend
class FrontendIntegration {
  constructor() {
    this.api = new MultiAgentAPI();
    this.state = {
      user: null,
      agents: [],
      integrations: [],
      notifications: [],
      analytics: null,
    };
    
    this.initializeIntegration();
  }

  async initializeIntegration() {
    // Check if user is already logged in
    const token = localStorage.getItem('authToken');
    if (token) {
      this.api.token = token;
      this.api.connectWebSocket();
      await this.loadUserData();
    }

    // Set up event listeners
    this.setupEventListeners();
  }

  async loadUserData() {
    try {
      const [profile, agents, integrations, notifications] = await Promise.all([
        this.api.getUserProfile(),
        this.api.getAgents(),
        this.api.getIntegrations(),
        this.api.getNotifications(20, true),
      ]);

      this.state.user = profile.profile;
      this.state.agents = agents.agents;
      this.state.integrations = integrations.integrations;
      this.state.notifications = notifications.notifications;

      this.updateUI();
    } catch (error) {
      console.error('Failed to load user data:', error);
    }
  }

  setupEventListeners() {
    // Agent status changes
    this.api.on('agent-status-changed', (data) => {
      this.updateAgentStatus(data);
    });

    // Agent results
    this.api.on('agent-result', (data) => {
      this.handleAgentResult(data);
    });

    // Notifications
    this.api.on('notification', (data) => {
      this.addNotification(data);
    });

    // Integration sync
    this.api.on('integration-sync-completed', (data) => {
      this.handleIntegrationSync(data);
    });
  }

  updateAgentStatus(data) {
    const agent = this.state.agents.find(a => a.id === data.agentId);
    if (agent) {
      agent.status = data.status;
      this.updateAgentUI(agent);
    }
  }

  handleAgentResult(data) {
    // Update your existing activity feed
    if (window.addActivity) {
      window.addActivity(`Agent ${data.agentId} completed: ${JSON.stringify(data.result)}`);
    }

    // Update KPIs if needed
    this.updateKPIs();
  }

  addNotification(notification) {
    this.state.notifications.unshift(notification);
    this.updateNotificationUI();
    
    // Show toast if available
    if (window.showToast) {
      window.showToast(notification.message);
    }
  }

  handleIntegrationSync(data) {
    // Update integration status
    const integration = this.state.integrations.find(i => i.serviceName === data.serviceName);
    if (integration) {
      integration.syncStatus = 'completed';
      integration.lastSync = new Date();
      this.updateIntegrationUI(integration);
    }
  }

  updateUI() {
    this.updateAgentCards();
    this.updateIntegrationStatus();
    this.updateNotificationCount();
  }

  updateAgentCards() {
    // Update your existing agent cards with real data
    this.state.agents.forEach(agent => {
      const card = document.querySelector(`[data-agent="${agent.type}"]`);
      if (card) {
        const statusBadge = card.querySelector('.badge.state');
        const lastRun = card.querySelector('.last-run');
        const performanceScore = card.querySelector('.performance-score');

        if (statusBadge) statusBadge.textContent = agent.status;
        if (lastRun) lastRun.textContent = agent.lastRun ? new Date(agent.lastRun).toLocaleTimeString() : 'never';
        if (performanceScore) performanceScore.textContent = `${Math.round(agent.performanceScore * 100)}%`;
      }
    });
  }

  updateIntegrationStatus() {
    // Update integration status indicators
    this.state.integrations.forEach(integration => {
      const indicator = document.querySelector(`[data-integration="${integration.serviceName}"] .status-indicator`);
      if (indicator) {
        indicator.className = `status-indicator ${integration.connected ? 'connected' : 'disconnected'}`;
      }
    });
  }

  updateNotificationCount() {
    const unreadCount = this.state.notifications.filter(n => !n.isRead).length;
    const countElement = document.getElementById('notif-count');
    if (countElement) {
      countElement.textContent = unreadCount;
      countElement.classList.toggle('hidden', unreadCount === 0);
    }
  }

  updateKPIs() {
    // Update your existing KPI values with real data
    if (window.renderKPIs) {
      // You can modify your existing renderKPIs function to use real data
      window.renderKPIs();
    }
  }

  // Authentication methods
  async login(email, password) {
    try {
      const result = await this.api.login(email, password);
      await this.loadUserData();
      return result;
    } catch (error) {
      throw error;
    }
  }

  async register(userData) {
    try {
      const result = await this.api.register(userData);
      await this.loadUserData();
      return result;
    } catch (error) {
      throw error;
    }
  }

  logout() {
    this.api.logout();
    this.state = {
      user: null,
      agents: [],
      integrations: [],
      notifications: [],
      analytics: null,
    };
    this.updateUI();
  }

  // Agent methods
  async runAgent(agentId, params = {}) {
    try {
      const result = await this.api.runAgent(agentId, params);
      
      // Update your existing simulateAgentRun function
      if (window.simulateAgentRun) {
        // You can modify this to use real agent data
        window.simulateAgentRun(agentId);
      }
      
      return result;
    } catch (error) {
      console.error('Failed to run agent:', error);
      throw error;
    }
  }

  // Integration methods
  async connectIntegration(serviceName, authCode) {
    try {
      const result = await this.api.connectIntegration(serviceName, authCode);
      await this.loadUserData(); // Reload to get updated integration status
      return result;
    } catch (error) {
      console.error('Failed to connect integration:', error);
      throw error;
    }
  }

  async syncIntegration(serviceName) {
    try {
      const result = await this.api.syncIntegration(serviceName);
      return result;
    } catch (error) {
      console.error('Failed to sync integration:', error);
      throw error;
    }
  }

  // Analytics methods
  async loadAnalytics(timeRange = '7d') {
    try {
      const analytics = await this.api.getUserAnalytics(timeRange);
      this.state.analytics = analytics.analytics;
      this.updateAnalyticsUI();
      return analytics;
    } catch (error) {
      console.error('Failed to load analytics:', error);
      throw error;
    }
  }

  updateAnalyticsUI() {
    if (!this.state.analytics) return;

    // Update your existing analytics displays
    const { activity, productivity, agentPerformance } = this.state.analytics;

    // Update activity metrics
    if (activity) {
      // Update your existing activity displays
    }

    // Update productivity metrics
    if (productivity) {
      // Update your existing productivity displays
    }

    // Update agent performance
    if (agentPerformance) {
      // Update your existing agent performance displays
    }
  }
}

// Initialize the integration
const frontendIntegration = new FrontendIntegration();

// Make it available globally
window.MultiAgentAPI = MultiAgentAPI;
window.FrontendIntegration = FrontendIntegration;
window.frontendIntegration = frontendIntegration;

// Override your existing functions to use the backend
window.originalSimulateAgentRun = window.simulateAgentRun;
window.simulateAgentRun = async function(agent) {
  try {
    // Find the agent ID
    const agentData = frontendIntegration.state.agents.find(a => a.type === agent);
    if (agentData) {
      await frontendIntegration.runAgent(agentData.id);
    } else {
      // Fallback to original function
      window.originalSimulateAgentRun(agent);
    }
  } catch (error) {
    console.error('Agent run failed:', error);
    // Fallback to original function
    window.originalSimulateAgentRun(agent);
  }
};

// Override your existing KPI rendering
window.originalRenderKPIs = window.renderKPIs;
window.renderKPIs = function() {
  // Use real data from the backend
  if (frontendIntegration.state.analytics) {
    const { productivity, agentPerformance } = frontendIntegration.state.analytics;
    
    // Update KPIs with real data
    const meetingsElement = document.querySelector('[data-hook="meetings-count"]');
    const emailsElement = document.querySelector('[data-hook="unread-emails"]');
    const tasksElement = document.querySelector('[data-hook="open-tasks"]');
    const satisfactionElement = document.querySelector('[data-hook="satisfaction"]');

    if (meetingsElement && productivity.meetings) {
      meetingsElement.textContent = productivity.meetings.total;
    }
    if (emailsElement && productivity.emails) {
      emailsElement.textContent = productivity.emails.processed;
    }
    if (tasksElement && productivity.tasks) {
      tasksElement.textContent = productivity.tasks.pending;
    }
    if (satisfactionElement && productivity.productivityScore) {
      satisfactionElement.textContent = `${Math.round(productivity.productivityScore)}%`;
    }
  } else {
    // Fallback to original function
    window.originalRenderKPIs();
  }
};

console.log('🚀 Multi-Agent Office Backend Integration Loaded!');
console.log('Available methods:');
console.log('- frontendIntegration.login(email, password)');
console.log('- frontendIntegration.runAgent(agentId, params)');
console.log('- frontendIntegration.connectIntegration(serviceName, authCode)');
console.log('- frontendIntegration.loadAnalytics(timeRange)');
