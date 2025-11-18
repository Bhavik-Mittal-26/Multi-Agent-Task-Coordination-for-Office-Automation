/* app.js — interactive behavior for dashboard (vanilla JS) */

const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

/* state */
const state = {
  meetings: 2,
  unreadEmails: 5,
  openTasks: 7,
  satisfaction: 87,
  conflicts: [],
  context: [],
  activities: [],
  notifications: [],
  // Enhanced shared context
  sharedMemory: {
    schedules: [],
    deadlines: [],
    commitments: [],
    resources: [],
    lastUpdated: Date.now()
  },
  // Agent coordination
  agentStates: {
    'meeting-agent': { status: 'idle', lastRun: null, performance: 0.95 },
    'mail-summarizer': { status: 'idle', lastRun: null, performance: 0.88 },
    'report-generator': { status: 'idle', lastRun: null, performance: 0.92 },
    'task-router': { status: 'idle', lastRun: null, performance: 0.90 },
    'document-processor': { status: 'idle', lastRun: null, performance: 0.96 },
    'attendance-analyzer': { status: 'idle', lastRun: null, performance: 0.94 }
  },
  // Integration status
  integrations: {
    calendar: { connected: false, lastSync: null },
    email: { connected: false, lastSync: null },
    chat: { connected: false, lastSync: null },
    project: { connected: false, lastSync: null }
  },
  // User feedback
  feedback: [],
  overrides: []
};

/* init DOM references */
const panels = $$('section.panel');
const navItems = $$('.nav-item, .side-nav .nav-item');
const pageTitle = $('#page-title');
const notifCount = $('#notif-count');

const activityList = $('[data-hook="activity-list"]');
const contextSummary = $('[data-hook="context-summary"]');
const conflictsList = $('[data-hook="conflicts"]');
const toasts = $('#toasts');
const notificationsPanel = $('#notifications');
const notifList = $('#notif-list');

/* helper rendering functions */
function renderKPIs() {
  $('[data-hook="meetings-count"]').textContent = state.meetings;
  $('[data-hook="unread-emails"]').textContent = state.unreadEmails;
  $('[data-hook="open-tasks"]').textContent = state.openTasks;
  $('[data-hook="satisfaction"]').textContent = `${state.satisfaction}%`;
}

/* activity + notification */
function addActivity(text, type = 'info') {
  const li = document.createElement('li');
  li.className = 'activity-item';
  li.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
  if (type === 'error') li.style.color = '#f87171';
  activityList.prepend(li);
  state.activities.unshift({ text, time: Date.now(), type });
  pushNotification(text);
}

function pushNotification(text) {
  state.notifications.unshift({ text, time: Date.now() });
  updateNotifPanel();
  showToast(text);
}

function updateNotifPanel() {
  notifList.innerHTML = '';
  state.notifications.slice(0, 20).forEach(n => {
    const li = document.createElement('li');
    li.textContent = `${new Date(n.time).toLocaleTimeString()} — ${n.text}`;
    li.style.padding = '8px';
    li.style.borderBottom = '1px dashed rgba(255,255,255,0.02)';
    notifList.appendChild(li);
  });
  notifCount.textContent = state.notifications.length;
  if (state.notifications.length === 0) notifCount.classList.add('hidden');
  else notifCount.classList.remove('hidden');
}

/* toast */
function showToast(text, ms = 3000) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = text;
  toasts.appendChild(t);
  t.animate([{opacity:0, transform:'translateY(8px)'},{opacity:1, transform:'none'}], {duration:180});
  setTimeout(()=> {
    t.animate([{opacity:1},{opacity:0}], {duration:180}).onfinish = ()=> t.remove();
  }, ms);
}

/* agent run simulation with loader -> success */
function simulateAgentRun(agent) {
  const card = document.querySelector(`[data-agent="${agent}"]`);
  if (!card) return;
  const stateBadge = card.querySelector('.badge.state');
  const runBtn = card.querySelector('.run');
  const lastRun = card.querySelector('.last-run');

  // UI: show loading spinner inside button
  runBtn.disabled = true;
  const spinner = document.createElement('span');
  spinner.className = 'loader-small';
  spinner.style.marginRight = '8px';
  runBtn.prepend(spinner);
  stateBadge.textContent = 'running';
  stateBadge.style.background = 'linear-gradient(90deg,var(--accent),var(--accent-2))';
  addActivity(`${humanize(agent)} started.`);

  // random processing time
  const duration = 1000 + Math.floor(Math.random()*2000);
  setTimeout(()=> {
    // finish
    spinner.remove();
    runBtn.disabled = false;
    stateBadge.textContent = 'idle';
    stateBadge.style.background = '';
    addActivity(`${humanize(agent)} completed.`);
    lastRun.textContent = new Date().toLocaleTimeString();

    // change state based on agent
    switch(agent) {
      case 'meeting-agent':
        state.meetings += 1;
        detectConflicts();
      break;
      case 'mail-summarizer':
        state.unreadEmails = Math.max(0, state.unreadEmails - 2);
        state.satisfaction = Math.min(100, state.satisfaction + 1);
      break;
      case 'report-generator':
        addActivity('New report generated and saved.');
        state.satisfaction = Math.min(100, state.satisfaction + 2);
      break;
      case 'task-router':
        state.openTasks = Math.max(0, state.openTasks - 1);
        state.satisfaction = Math.min(100, state.satisfaction + 1);
      break;
    }
    renderKPIs();
    pushNotification(`${humanize(agent)} finished.`);
  }, duration);
}

/* Enhanced conflict detection and resolution */
function detectConflicts(){
  // Use the advanced conflict detection
  detectAdvancedConflicts();
}

function renderConflicts(){
  conflictsList.innerHTML = '';
  if (state.conflicts.length === 0){
    conflictsList.innerHTML = '<p class="muted">No conflicts detected.</p>';
  } else {
    state.conflicts.forEach((conflict, index) => {
      const div = document.createElement('div');
      div.className = `conflict-item severity-${conflict.severity}`;
      
      const icon = conflict.type === 'schedule_overlap' ? '📅' : 
                   conflict.type === 'deadline_clash' ? '⏰' : '🔧';
      
      div.innerHTML = `
        <div class="conflict-header">
          <span class="conflict-icon">${icon}</span>
          <span class="conflict-message">${conflict.message}</span>
          <span class="severity-badge severity-${conflict.severity}">${conflict.severity}</span>
        </div>
        <div class="conflict-actions">
          <button class="btn primary resolve-conflict" data-index="${index}">Auto-Resolve</button>
          <button class="btn ghost manual-resolve" data-index="${index}">Manual Fix</button>
          <button class="btn ghost ignore-conflict" data-index="${index}">Ignore</button>
        </div>
      `;
      
      conflictsList.appendChild(div);
    });
    
    // Add event listeners for conflict resolution
    conflictsList.querySelectorAll('.resolve-conflict').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        resolveConflict(index, 'auto');
      });
    });
    
    conflictsList.querySelectorAll('.manual-resolve').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        resolveConflict(index, 'manual');
      });
    });
    
    conflictsList.querySelectorAll('.ignore-conflict').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        resolveConflict(index, 'ignore');
      });
    });
  }
}

function resolveConflict(index, method) {
  const conflict = state.conflicts[index];
  
  switch (method) {
    case 'auto':
      // Simulate automatic resolution
      if (conflict.type === 'schedule_overlap') {
        addActivity(`Auto-resolved: Rescheduled ${conflict.participants[0]}'s meeting to avoid conflict.`);
      } else if (conflict.type === 'deadline_clash') {
        addActivity(`Auto-resolved: Prioritized ${conflict.tasks[0].task} and rescheduled others.`);
      } else if (conflict.type === 'resource_conflict') {
        addActivity(`Auto-resolved: Reallocated ${conflict.resource.name} usage.`);
      }
      break;
      
    case 'manual':
      addActivity(`Manual resolution required for: ${conflict.message}`);
      // In a real system, this would open a resolution interface
      showToast('Manual resolution interface would open here');
      break;
      
    case 'ignore':
      addActivity(`Ignored conflict: ${conflict.message}`, 'error');
      break;
  }
  
  // Remove resolved conflict
  state.conflicts.splice(index, 1);
  renderConflicts();
}

/* Enhanced Shared Context Management */
function updateSharedMemory(type, data) {
  state.sharedMemory[type] = data;
  state.sharedMemory.lastUpdated = Date.now();
  broadcastToAgents(type, data);
  addActivity(`Shared memory updated: ${type}`);
  renderContext();
}

function broadcastToAgents(type, data) {
  // Simulate inter-agent communication
  Object.keys(state.agentStates).forEach(agent => {
    if (state.agentStates[agent].status === 'idle') {
      addActivity(`${humanize(agent)} received context update: ${type}`);
    }
  });
}

function detectAdvancedConflicts() {
  const conflicts = [];
  
  // Check for schedule overlaps
  const schedules = state.sharedMemory.schedules;
  for (let i = 0; i < schedules.length; i++) {
    for (let j = i + 1; j < schedules.length; j++) {
      const a = schedules[i];
      const b = schedules[j];
      if (!a || !b) continue;
      const sameDay = (a.date && b.date) ? a.date === b.date : true;
      if (sameDay && a.time === b.time) {
        conflicts.push({
          type: 'schedule_overlap',
          message: `Meeting conflict: ${a.title} and ${b.title} on ${a.date || 'same day'} at ${a.time}`,
          severity: 'high',
          participants: [...(a.participants||[]), ...(b.participants||[])]
        });
      }
    }
  }
  
  // Check for deadline clashes
  const deadlines = state.sharedMemory.deadlines;
  const today = new Date();
  const urgentDeadlines = deadlines.filter(d => {
    const deadline = new Date(d.date);
    const daysDiff = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
    return daysDiff <= 1 && daysDiff >= 0;
  });
  
  if (urgentDeadlines.length > 2) {
    conflicts.push({
      type: 'deadline_clash',
      message: `Multiple urgent deadlines: ${urgentDeadlines.map(d => d.task).join(', ')}`,
      severity: 'medium',
      tasks: urgentDeadlines
    });
  }
  
  // Check for resource conflicts
  const resources = state.sharedMemory.resources;
  const resourceConflicts = resources.filter(r => r.usage > r.capacity);
  resourceConflicts.forEach(r => {
    conflicts.push({
      type: 'resource_conflict',
      message: `Resource overload: ${r.name} (${r.usage}/${r.capacity})`,
      severity: 'medium',
      resource: r
    });
  });
  
  state.conflicts = conflicts;
  renderConflicts();
}

$('#btn-import')?.addEventListener('click', ()=> {
  // Simulate importing from various sources
  const mockData = {
    schedules: [
      { title: 'HR Sync', date: new Date().toISOString().slice(0,10), time: '10:00', participants: ['John', 'Sarah'], duration: 60 },
      { title: 'Client Review', date: new Date().toISOString().slice(0,10), time: '15:00', participants: ['Mike', 'Lisa'], duration: 90 },
      { title: 'Team Standup', date: new Date(Date.now()+86400000).toISOString().slice(0,10), time: '09:00', participants: ['Team'], duration: 30 }
    ],
    deadlines: [
      { task: 'Q4 Report', date: '2024-01-15', priority: 'high' },
      { task: 'Budget Review', date: '2024-01-16', priority: 'medium' },
      { task: 'Client Proposal', date: '2024-01-14', priority: 'high' }
    ],
    commitments: [
      { type: 'meeting', description: 'Weekly team sync', frequency: 'weekly' },
      { type: 'deadline', description: 'Monthly report submission', frequency: 'monthly' }
    ],
    resources: [
      { name: 'Conference Room A', capacity: 8, usage: 6 },
      { name: 'Project Manager', capacity: 1, usage: 1 },
      { name: 'Designer', capacity: 1, usage: 2 }
    ]
  };
  
  Object.keys(mockData).forEach(key => {
    updateSharedMemory(key, mockData[key]);
  });
  
  addActivity('Context imported from Calendar, Email, and Project Management.');
  detectAdvancedConflicts();
});

$('#btn-clear-context')?.addEventListener('click', ()=> {
  state.sharedMemory = {
    schedules: [],
    deadlines: [],
    commitments: [],
    resources: [],
    lastUpdated: Date.now()
  };
  state.conflicts = [];
  renderContext();
  renderConflicts();
  addActivity('Shared context cleared.', 'error');
});

function renderContext() {
  if (!contextSummary) return;
  
  const memory = state.sharedMemory;
  if (Object.values(memory).every(v => Array.isArray(v) ? v.length === 0 : typeof v === 'number')) {
    contextSummary.innerHTML = '<p class="muted">No shared context loaded yet.</p>';
    return;
  }
  
  contextSummary.innerHTML = '';
  
  // Render schedules
  if (memory.schedules.length > 0) {
    const div = document.createElement('div');
    div.className = 'context-section';
    div.innerHTML = `
      <h4>📅 Schedules (${memory.schedules.length})</h4>
      <div class="context-items">
        ${memory.schedules.map(s => `
          <div class="context-item">
            <strong>${s.title}</strong> at ${s.time}
            <small>${s.participants.join(', ')}</small>
          </div>
        `).join('')}
      </div>
    `;
    contextSummary.appendChild(div);
  }
  
  // Render deadlines
  if (memory.deadlines.length > 0) {
    const div = document.createElement('div');
    div.className = 'context-section';
    div.innerHTML = `
      <h4>⏰ Deadlines (${memory.deadlines.length})</h4>
      <div class="context-items">
        ${memory.deadlines.map(d => `
          <div class="context-item priority-${d.priority}">
            <strong>${d.task}</strong> - ${d.date}
            <small>Priority: ${d.priority}</small>
          </div>
        `).join('')}
      </div>
    `;
    contextSummary.appendChild(div);
  }
  
  // Render resources
  if (memory.resources.length > 0) {
    const div = document.createElement('div');
    div.className = 'context-section';
    div.innerHTML = `
      <h4>🔧 Resources (${memory.resources.length})</h4>
      <div class="context-items">
        ${memory.resources.map(r => `
          <div class="context-item">
            <strong>${r.name}</strong>
            <div class="resource-usage">
              <div class="usage-bar">
                <div class="usage-fill" style="width: ${(r.usage/r.capacity)*100}%"></div>
              </div>
              <small>${r.usage}/${r.capacity}</small>
            </div>
          </div>
        `).join('')}
      </div>
    `;
    contextSummary.appendChild(div);
  }
  
  // Show last updated
  const lastUpdate = document.createElement('div');
  lastUpdate.className = 'context-update-time';
  lastUpdate.innerHTML = `<small class="muted">Last updated: ${new Date(memory.lastUpdated).toLocaleTimeString()}</small>`;
  contextSummary.appendChild(lastUpdate);
}

/* UI interactions: nav */
$$('.nav-item').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const panelName = btn.dataset.panel || btn.getAttribute('data-panel');
    // switch active class
    $$('.nav-item').forEach(n => n.classList.remove('active'));
    btn.classList.add('active');
    // show panel
    panels.forEach(p => p.classList.remove('active-panel'));
    const show = document.getElementById(`panel-${panelName}`);
    if (show) show.classList.add('active-panel');
    pageTitle.textContent = btn.textContent.trim();
  });
});

/* Enhanced Agent Card Interactions */
$$('.agent-card').forEach(card => {
  const agent = card.dataset.agent;
  
  // Make entire card clickable (except buttons)
  card.addEventListener('click', (e) => {
    // Don't trigger if clicking on buttons or interactive elements
    if (e.target.closest('button') || e.target.closest('.agent-actions')) {
      return;
    }
    
    // Toggle expanded state
    const footer = card.querySelector('.agent-footer');
    const expandBtn = card.querySelector('.expand');
    
    footer.classList.toggle('hidden');
    expandBtn.textContent = footer.classList.contains('hidden') ? 'Details' : 'Hide';
    
    // Add visual feedback
    card.style.transform = 'scale(0.98)';
    setTimeout(() => {
      card.style.transform = '';
    }, 150);
    
    // Show agent details modal
    showAgentDetailsModal(agent);
  });
  
  // Enhanced expand/collapse functionality
  const expandBtn = card.querySelector('.expand');
  expandBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const footer = card.querySelector('.agent-footer');
    footer.classList.toggle('hidden');
    expandBtn.textContent = footer.classList.contains('hidden') ? 'Details' : 'Hide';
    
    // Add animation
    if (!footer.classList.contains('hidden')) {
      footer.style.opacity = '0';
      footer.style.transform = 'translateY(-10px)';
      setTimeout(() => {
        footer.style.opacity = '1';
        footer.style.transform = 'translateY(0)';
      }, 100);
    }
  });
  
  // Add hover effects
  card.addEventListener('mouseenter', () => {
    if (!card.classList.contains('running')) {
      card.style.transform = 'translateY(-2px)';
      card.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
    }
  });
  
  card.addEventListener('mouseleave', () => {
    if (!card.classList.contains('running')) {
      card.style.transform = '';
      card.style.boxShadow = '';
    }
  });
});

/* Enhanced run buttons */
$$('.agent-card .run').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const agent = btn.dataset.agent;
    
    // Add loading state
    btn.disabled = true;
    btn.innerHTML = '<span class="loader-small"></span>Running...';
    
    // Simulate agent execution
    setTimeout(() => {
      btn.disabled = false;
      btn.innerHTML = 'Run Again';
      
      // Execute agent-specific functionality
      if (agent === 'meeting-agent') {
        showCalendarModal();
        addActivity('Meeting Agent executed successfully', 'success');
      } else if (agent === 'report-generator') {
        showReportModal();
        addActivity('Report Generator executed successfully', 'success');
      } else if (agent === 'mail-summarizer') {
        showMailSummarizerModal();
        addActivity('Mail Summarizer executed successfully', 'success');
      } else if (agent === 'task-router') {
        showTaskRouterModal();
        addActivity('Task Router executed successfully', 'success');
      } else if (agent === 'document-processor') {
        showDocumentProcessorModal();
        addActivity('Document Processor executed successfully', 'success');
      } else if (agent === 'attendance-analyzer') {
        showAttendanceAnalyzerModal();
        addActivity('Attendance Analyzer executed successfully', 'success');
      } else {
        simulateAgentRun(agent);
      }
      
      // Update last run time
      const lastRunElement = btn.closest('.agent-card').querySelector('.last-run');
      lastRunElement.textContent = new Date().toLocaleTimeString();
      
      // Update agent state
      updateAgentState(agent, 'completed');
      
    }, 1500);
  });
});

/* Enhanced settings and integrations */
$$('.agent-card .settings').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const agent = e.target.closest('.agent-card').dataset.agent;
    showAgentSettings(agent);
  });
});

// New function: Show detailed agent information modal
function showAgentDetailsModal(agent) {
  const agentInfo = getAgentInfo(agent);
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content agent-details-modal">
      <div class="modal-header">
        <h3>${agentInfo.name} - Details</h3>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <div class="agent-info-grid">
          <div class="info-section">
            <h4>📋 Description</h4>
            <p>${agentInfo.description}</p>
          </div>
          <div class="info-section">
            <h4>⚡ Capabilities</h4>
            <ul class="capabilities-list">
              ${agentInfo.capabilities.map(cap => `<li>${cap}</li>`).join('')}
            </ul>
          </div>
          <div class="info-section">
            <h4>📊 Performance</h4>
            <div class="performance-metrics">
              <div class="metric">
                <span class="metric-label">Success Rate</span>
                <span class="metric-value">${agentInfo.successRate}%</span>
              </div>
              <div class="metric">
                <span class="metric-label">Avg Runtime</span>
                <span class="metric-value">${agentInfo.avgRuntime}</span>
              </div>
              <div class="metric">
                <span class="metric-label">Last Run</span>
                <span class="metric-value">${agentInfo.lastRun}</span>
              </div>
            </div>
          </div>
          <div class="info-section">
            <h4>🔧 Configuration</h4>
            <div class="config-options">
              <label>
                <input type="checkbox" ${agentInfo.autoRun ? 'checked' : ''}>
                Auto-run when triggered
              </label>
              <label>
                <input type="checkbox" ${agentInfo.notifications ? 'checked' : ''}>
                Send notifications
              </label>
              <label>
                <input type="checkbox" ${agentInfo.logging ? 'checked' : ''}>
                Enable detailed logging
              </label>
            </div>
          </div>
        </div>
        <div class="agent-actions-detailed">
          <button class="btn primary run-agent" data-agent="${agent}">🚀 Run Agent</button>
          <button class="btn ghost configure-agent" data-agent="${agent}">⚙️ Configure</button>
          <button class="btn ghost view-logs" data-agent="${agent}">📋 View Logs</button>
          <button class="btn ghost test-agent" data-agent="${agent}">🧪 Test</button>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn ghost modal-close">Close</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Add event listeners for modal actions
  modal.querySelector('.run-agent').addEventListener('click', () => {
    const runBtn = document.querySelector(`[data-agent="${agent}"].run`);
    runBtn?.click();
    modal.remove();
  });
  
  modal.querySelector('.configure-agent').addEventListener('click', () => {
    showAgentSettings(agent);
    modal.remove();
  });
  
  modal.querySelector('.view-logs').addEventListener('click', () => {
    showAgentLogs(agent);
    modal.remove();
  });
  
  modal.querySelector('.test-agent').addEventListener('click', () => {
    testAgent(agent);
    modal.remove();
  });
  
  // Close modal
  modal.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => modal.remove());
  });
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
}

// Helper function to get agent information
function getAgentInfo(agent) {
  const agentData = {
    'meeting-agent': {
      name: 'Meeting Agent',
      description: 'Intelligent meeting scheduler that analyzes calendars, preferences, and availability to optimize meeting times and participants.',
      capabilities: [
        'Smart scheduling based on availability',
        'Conflict detection and resolution',
        'Participant preference analysis',
        'Meeting room optimization',
        'Time zone handling'
      ],
      successRate: 94,
      avgRuntime: '2.3s',
      lastRun: '2 minutes ago',
      autoRun: true,
      notifications: true,
      logging: false
    },
    'mail-summarizer': {
      name: 'Mail Summarizer',
      description: 'AI-powered email analysis that extracts key information, action items, and sentiment from email threads.',
      capabilities: [
        'Email thread summarization',
        'Action item extraction',
        'Sentiment analysis',
        'Priority classification',
        'Auto-reply suggestions'
      ],
      successRate: 89,
      avgRuntime: '1.8s',
      lastRun: '5 minutes ago',
      autoRun: false,
      notifications: true,
      logging: true
    },
    'report-generator': {
      name: 'Report Generator',
      description: 'Automated report creation that aggregates data from multiple sources and generates professional reports.',
      capabilities: [
        'Multi-source data aggregation',
        'Custom report templates',
        'PDF/Excel export',
        'Scheduled report generation',
        'Data visualization'
      ],
      successRate: 96,
      avgRuntime: '4.2s',
      lastRun: '1 hour ago',
      autoRun: true,
      notifications: false,
      logging: true
    },
    'task-router': {
      name: 'Task Router',
      description: 'Intelligent task assignment system that routes tasks to the most suitable team members based on skills and availability.',
      capabilities: [
        'Skill-based task matching',
        'Workload balancing',
        'SLA monitoring',
        'Escalation management',
        'Performance tracking'
      ],
      successRate: 91,
      avgRuntime: '3.1s',
      lastRun: '15 minutes ago',
      autoRun: true,
      notifications: true,
      logging: true
    },
    'document-processor': {
      name: 'Document Processor',
      description: 'AI-powered document analysis system that extracts insights, entities, and actionable information from various document types.',
      capabilities: [
        'OCR text extraction from images',
        'Smart document classification',
        'Entity extraction (people, organizations, dates)',
        'Sentiment analysis',
        'Action item identification',
        'Multi-language support'
      ],
      successRate: 96,
      avgRuntime: '2.8s',
      lastRun: '3 minutes ago',
      autoRun: false,
      notifications: true,
      logging: true
    },
    'attendance-analyzer': {
      name: 'Attendance Analyzer',
      description: 'AI-powered attendance tracking and analysis system that provides insights into employee attendance patterns, productivity correlation, and compliance monitoring.',
      capabilities: [
        'Daily, weekly, and monthly attendance analysis',
        'Punch-in/out time tracking and validation',
        'Productivity correlation analysis',
        'Attendance pattern recognition',
        'Compliance monitoring and alerts',
        'Predictive attendance forecasting'
      ],
      successRate: 94,
      avgRuntime: '1.5s',
      lastRun: '5 minutes ago',
      autoRun: false,
      notifications: true,
      logging: true
    }
  };
  
  return agentData[agent] || {
    name: 'Unknown Agent',
    description: 'Agent information not available.',
    capabilities: ['Unknown capabilities'],
    successRate: 0,
    avgRuntime: 'N/A',
    lastRun: 'Never',
    autoRun: false,
    notifications: false,
    logging: false
  };
}

// Helper functions for agent management
function showAgentLogs(agent) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>${getAgentInfo(agent).name} - Logs</h3>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <div class="logs-container">
          <div class="log-entry success">
            <span class="timestamp">${new Date().toLocaleTimeString()}</span>
            <span class="message">Agent executed successfully</span>
          </div>
          <div class="log-entry info">
            <span class="timestamp">${new Date(Date.now() - 300000).toLocaleTimeString()}</span>
            <span class="message">Configuration updated</span>
          </div>
          <div class="log-entry warning">
            <span class="timestamp">${new Date(Date.now() - 600000).toLocaleTimeString()}</span>
            <span class="message">Minor performance degradation detected</span>
          </div>
          <div class="log-entry success">
            <span class="timestamp">${new Date(Date.now() - 900000).toLocaleTimeString()}</span>
            <span class="message">Agent started successfully</span>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn ghost modal-close">Close</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  modal.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => modal.remove());
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
}

function testAgent(agent) {
  const agentInfo = getAgentInfo(agent);
  showToast(`Testing ${agentInfo.name}...`, 'info');
  
  // Simulate test execution
  setTimeout(() => {
    const success = Math.random() > 0.1; // 90% success rate
    if (success) {
      showToast(`${agentInfo.name} test passed! ✅`, 'success');
      addActivity(`${agentInfo.name} test completed successfully`, 'success');
    } else {
      showToast(`${agentInfo.name} test failed! ❌`, 'error');
      addActivity(`${agentInfo.name} test failed - check configuration`, 'error');
    }
  }, 2000);
}

function updateAgentState(agent, newState) {
  const card = document.querySelector(`[data-agent="${agent}"]`);
  if (!card) return;
  
  const stateBadge = card.querySelector('.badge.state');
  if (stateBadge) {
    stateBadge.textContent = newState;
    stateBadge.className = `badge state ${newState}`;
  }
  
  // Add visual feedback
  card.classList.add('running');
  setTimeout(() => {
    card.classList.remove('running');
  }, 2000);
}

function showAgentSettings(agent) {
  const agentState = state.agentStates[agent];
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>${humanize(agent)} Settings</h3>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <div class="setting-group">
          <h4>Performance</h4>
          <div class="performance-meter">
            <div class="meter-bar">
              <div class="meter-fill" style="width: ${agentState.performance * 100}%"></div>
            </div>
            <span>${Math.round(agentState.performance * 100)}%</span>
          </div>
        </div>
        <div class="setting-group">
          <h4>Auto-run Schedule</h4>
          <label class="setting-line">
            <span>Enable auto-run</span>
            <input type="checkbox" ${agentState.autoRun ? 'checked' : ''}>
          </label>
          <label class="setting-line">
            <span>Run interval (minutes)</span>
            <input type="number" value="30" min="5" max="1440">
          </label>
        </div>
        <div class="setting-group">
          <h4>Feedback</h4>
          <div class="feedback-buttons">
            <button class="btn primary feedback-btn" data-rating="5">👍 Great</button>
            <button class="btn ghost feedback-btn" data-rating="3">👌 OK</button>
            <button class="btn ghost feedback-btn" data-rating="1">👎 Poor</button>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn primary save-settings">Save Settings</button>
        <button class="btn ghost modal-close">Cancel</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Event listeners
  modal.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => modal.remove());
  });
  
  modal.querySelectorAll('.feedback-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const rating = parseInt(e.target.dataset.rating);
      submitFeedback(agent, rating);
      showToast(`Feedback submitted: ${rating}/5 stars`);
      modal.remove();
    });
  });
  
  modal.querySelector('.save-settings').addEventListener('click', () => {
    const autoRun = modal.querySelector('input[type="checkbox"]').checked;
    const interval = modal.querySelector('input[type="number"]').value;
    
    agentState.autoRun = autoRun;
    agentState.interval = parseInt(interval);
    
    addActivity(`Settings updated for ${humanize(agent)}`);
    modal.remove();
  });
}

function submitFeedback(agent, rating) {
  const feedback = {
    agent,
    rating,
    timestamp: Date.now(),
    user: 'Bhavik'
  };
  
  state.feedback.push(feedback);
  
  // Update agent performance based on feedback
  const agentState = state.agentStates[agent];
  const feedbackWeight = 0.1;
  const newPerformance = agentState.performance * (1 - feedbackWeight) + (rating / 5) * feedbackWeight;
  agentState.performance = Math.max(0.1, Math.min(1.0, newPerformance));
  
  // Update overall satisfaction
  const recentFeedback = state.feedback.slice(-10);
  const avgRating = recentFeedback.reduce((sum, f) => sum + f.rating, 0) / recentFeedback.length;
  state.satisfaction = Math.round((avgRating / 5) * 100);
  
  renderKPIs();
}

/* KPI clickable behavior */
$('#kpi-unreads')?.addEventListener('click', ()=> {
  // run mail summarizer when user clicks unread KPI
  const mailBtn = document.querySelector('.run[data-agent="mail-summarizer"]');
  mailBtn?.click();
});

/* notifications UI toggle */
$('#open-notifications')?.addEventListener('click', ()=> {
  notificationsPanel.classList.toggle('hidden');
});

/* theme toggle (basic) */
$('#mode-toggle')?.addEventListener('click', (e) => {
  const el = e.currentTarget;
  document.documentElement.classList.toggle('light-mode');
  if (document.documentElement.classList.contains('light-mode')) {
    el.textContent = '☀️';
  } else el.textContent = '🌙';
});

/* Feedback viewer */
$('#view-feedback')?.addEventListener('click', () => {
  showFeedbackModal();
});

function showFeedbackModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>Feedback & Overrides</h3>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <div class="feedback-tabs">
          <button class="tab-btn active" data-tab="feedback">Recent Feedback</button>
          <button class="tab-btn" data-tab="overrides">User Overrides</button>
          <button class="tab-btn" data-tab="analytics">Analytics</button>
        </div>
        
        <div class="tab-content" id="feedback-tab">
          <div class="feedback-list">
            ${state.feedback.slice(-10).map(f => `
              <div class="feedback-item">
                <div class="feedback-header">
                  <span class="agent-name">${humanize(f.agent)}</span>
                  <span class="feedback-rating">${'⭐'.repeat(f.rating)}</span>
                  <span class="feedback-time">${new Date(f.timestamp).toLocaleTimeString()}</span>
                </div>
                <div class="feedback-user">by ${f.user}</div>
              </div>
            `).join('') || '<p class="muted">No feedback yet.</p>'}
          </div>
        </div>
        
        <div class="tab-content hidden" id="overrides-tab">
          <div class="overrides-list">
            ${state.overrides.map(o => `
              <div class="override-item">
                <div class="override-header">
                  <span class="override-type">${o.type}</span>
                  <span class="override-time">${new Date(o.timestamp).toLocaleTimeString()}</span>
                </div>
                <div class="override-description">${o.description}</div>
              </div>
            `).join('') || '<p class="muted">No overrides yet.</p>'}
          </div>
        </div>
        
        <div class="tab-content hidden" id="analytics-tab">
          <div class="analytics-grid">
            <div class="analytics-item">
              <h4>Average Satisfaction</h4>
              <div class="analytics-value">${state.satisfaction}%</div>
            </div>
            <div class="analytics-item">
              <h4>Total Feedback</h4>
              <div class="analytics-value">${state.feedback.length}</div>
            </div>
            <div class="analytics-item">
              <h4>System Uptime</h4>
              <div class="analytics-value">99.2%</div>
            </div>
            <div class="analytics-item">
              <h4>Auto-Resolutions</h4>
              <div class="analytics-value">${state.conflicts.length === 0 ? '3' : '0'}</div>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn ghost modal-close">Close</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Tab switching
  modal.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tabName = e.target.dataset.tab;
      
      // Update active tab
      modal.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      
      // Show/hide content
      modal.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
      });
      modal.querySelector(`#${tabName}-tab`).classList.remove('hidden');
    });
  });
  
  // Close modal
  modal.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => modal.remove());
  });
}

/* small utilities */
function humanize(agent) {
  return agent.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/* Mail Summarizer Modal */
function showMailSummarizerModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>Mail & Chat Summary</h3>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <div class="setting-group">
          <h4>Account & Range</h4>
          <label class="setting-line">
            <span>Gmail address</span>
            <input type="email" class="mail-email" placeholder="you@example.com" required>
          </label>
          <label class="setting-line">
            <span>Summarize till date</span>
            <input type="date" class="mail-until" required>
          </label>
        </div>
        <div class="setting-group">
          <h4>Key Decisions</h4>
          <div class="mail-decisions">${renderList([])}</div>
        </div>
        <div class="setting-group">
          <h4>Action Items</h4>
          <div class="mail-actions">${renderList([])}</div>
        </div>
        <div class="setting-group">
          <h4>Upcoming Deadlines</h4>
          <div class="mail-deadlines">${renderList([])}</div>
        </div>
        <div class="setting-group">
          <h4>Short Summary</h4>
          <div class="context-section"><div class="context-items" id="summary-points">
            <p class="muted">Enter Gmail and date, then click Summarize.</p>
          </div></div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn primary do-summarize">Summarize</button>
        <button class="btn ghost copy-summary" disabled>Copy</button>
        <button class="btn ghost mark-summarized" disabled>Mark Summarized</button>
        <button class="btn ghost modal-close">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  function renderList(items){
    if (!items || items.length === 0) return '<p class="muted">None</p>';
    return `<ul style="margin:0;padding-left:18px">${items.map(i => `<li>${i}</li>`).join('')}</ul>`;
  }

  function extractMailInsights(untilDate){
    const deadlines = state.sharedMemory.deadlines || [];
    const schedules = state.sharedMemory.schedules || [];
    const until = untilDate ? new Date(untilDate) : null;
    const inRangeSchedules = until ? schedules.filter(s => !s.date || new Date(s.date) <= until) : schedules;
    const inRangeDeadlines = until ? deadlines.filter(d => d.date && new Date(d.date) <= until) : deadlines;
    // Decisions: heuristic from recent activity & schedules titles
    const recentActivities = state.activities.slice(0, 5).map(a => a.text);
    const decisions = [];
    inRangeSchedules.slice(-5).forEach(s => {
      if (/review|approve|decision|final/i.test(s.title)) {
        decisions.push(`Decision pending on "${s.title}" (${s.date||''} ${s.time||''})`);
      }
    });
    recentActivities.forEach(t => {
      if (/completed|approved|generated/i.test(t)) decisions.push(t.replace(/^\[[^\]]+\]\s*/, ''));
    });

    const actionItems = [];
    // From deadlines
    inRangeDeadlines.forEach(d => actionItems.push(`Prepare ${d.task} by ${d.date} (${d.priority} priority)`));
    // From schedules
    inRangeSchedules.forEach(s => {
      if (/standup|sync|meeting/i.test(s.title)) actionItems.push(`Attend ${s.title} at ${s.time} on ${s.date||'—'}`);
    });

    // Upcoming deadlines (next 7 days)
    const now = new Date();
    const soon = inRangeDeadlines.filter(d => {
      const dt = new Date(d.date);
      const diff = (dt - now) / (1000*60*60*24);
      return diff >= 0 && diff <= 7;
    }).map(d => `${d.task} — ${d.date} (${d.priority})`);

    const summaryPoints = [];
    if (actionItems.length) summaryPoints.push(`Action items identified: ${actionItems.length}`);
    if (soon.length) summaryPoints.push(`${soon.length} upcoming deadlines within 7 days`);
    if (decisions.length) summaryPoints.push(`Key decisions: ${decisions.slice(0,3).length}`);

    return { actions: actionItems.slice(0,8), deadlines: soon.slice(0,8), decisions: decisions.slice(0,8), summary: summaryPoints };
  }

  // Elements and interactions
  const emailEl = modal.querySelector('.mail-email');
  const untilEl = modal.querySelector('.mail-until');
  const decisionsBox = modal.querySelector('.mail-decisions');
  const actionsBox = modal.querySelector('.mail-actions');
  const deadlinesBox = modal.querySelector('.mail-deadlines');
  const summaryBox = modal.querySelector('#summary-points');
  const copyBtn = modal.querySelector('.copy-summary');
  const markBtn = modal.querySelector('.mark-summarized');
  const summarizeBtn = modal.querySelector('.do-summarize');

  // defaults
  untilEl.value = new Date().toISOString().slice(0,10);

  function validate(){
    const email = emailEl.value.trim();
    const date = untilEl.value;
    let ok = true;
    if (!email || !/.+@.+\..+/.test(email)) { ok = false; emailEl.style.borderColor = '#ef4444'; }
    else emailEl.style.borderColor = '';
    if (!date) { ok = false; untilEl.style.borderColor = '#ef4444'; }
    else untilEl.style.borderColor = '';
    return ok;
  }

  modal.querySelectorAll('.modal-close').forEach(b => b.addEventListener('click', ()=> modal.remove()));

  summarizeBtn.addEventListener('click', ()=>{
    if (!validate()) { showToast('Enter a valid Gmail and date'); return; }
    const email = emailEl.value.trim();
    const date = untilEl.value;
    addActivity(`Fetching emails for ${email} up to ${date}...`);
    setTimeout(()=> {
      const extracted = extractMailInsights(date);
      const decisions = extracted.decisions && extracted.decisions.length ? extracted.decisions : [
        'No explicit decisions detected in the selected range.'
      ];
      const actions = extracted.actions && extracted.actions.length ? extracted.actions : [
        'No actionable items identified; consider checking newer messages.'
      ];
      const dls = extracted.deadlines && extracted.deadlines.length ? extracted.deadlines : [
        'No upcoming deadlines within the selected timeframe.'
      ];
      const summaryLines = extracted.summary && extracted.summary.length ? extracted.summary : [
        `Reviewed mailbox for ${email} up to ${date}.`,
        'No urgent items detected in the selected range.'
      ];

      decisionsBox.innerHTML = renderList(decisions);
      actionsBox.innerHTML = renderList(actions);
      deadlinesBox.innerHTML = renderList(dls);
      summaryBox.innerHTML = summaryLines.map(p => `<div class=\"context-item\">${p}</div>`).join('');
      copyBtn.disabled = false;
      markBtn.disabled = false;
      addActivity('Mail summarization completed.');
    }, 600);
  });

  copyBtn.addEventListener('click', ()=>{
    const text = Array.from(modal.querySelectorAll('#summary-points .context-item')).map(x => x.textContent).join('\n');
    navigator.clipboard?.writeText(text).then(()=> showToast('Summary copied')).catch(()=> showToast('Copy failed'));
  });
  markBtn.addEventListener('click', ()=>{
    state.unreadEmails = Math.max(0, state.unreadEmails - 3);
    state.satisfaction = Math.min(100, state.satisfaction + 1);
    renderKPIs();
    addActivity('Mail summarized. Unread count reduced.');
    modal.remove();
  });
}

/* Integration Management */
function initializeIntegrations() {
  // Simulate integration status checks
  Object.keys(state.integrations).forEach(integration => {
    const status = state.integrations[integration];
    status.connected = Math.random() > 0.3; // 70% chance of being connected
    if (status.connected) {
      status.lastSync = new Date(Date.now() - Math.random() * 3600000); // Random time in last hour
    }
  });
  
  renderIntegrations();
}

function renderIntegrations() {
  const integrationsPanel = document.getElementById('integrations-panel');
  if (!integrationsPanel) return;
  
  integrationsPanel.innerHTML = '';
  
  Object.entries(state.integrations).forEach(([name, status]) => {
    const div = document.createElement('div');
    div.className = 'integration-item';
    div.innerHTML = `
      <div class="integration-header">
        <div class="integration-info">
          <span class="integration-icon">${getIntegrationIcon(name)}</span>
          <div>
            <strong>${humanize(name)}</strong>
            <small class="muted">${status.connected ? 'Connected' : 'Disconnected'}</small>
          </div>
        </div>
        <div class="integration-status">
          <span class="status-indicator ${status.connected ? 'connected' : 'disconnected'}"></span>
          <button class="btn ghost connect-btn" data-integration="${name}">
            ${status.connected ? 'Disconnect' : 'Connect'}
          </button>
        </div>
      </div>
      ${status.connected ? `
        <div class="integration-details">
          <small class="muted">Last sync: ${status.lastSync ? status.lastSync.toLocaleTimeString() : 'Never'}</small>
          <button class="btn ghost sync-btn" data-integration="${name}">Sync Now</button>
        </div>
      ` : ''}
    `;
    
    integrationsPanel.appendChild(div);
  });
  
  // Add event listeners
  integrationsPanel.querySelectorAll('.connect-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const integration = e.target.dataset.integration;
      toggleIntegration(integration);
    });
  });
  
  integrationsPanel.querySelectorAll('.sync-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const integration = e.target.dataset.integration;
      syncIntegration(integration);
    });
  });
}

function getIntegrationIcon(name) {
  const icons = {
    calendar: '📅',
    email: '📧',
    chat: '💬',
    project: '📊'
  };
  return icons[name] || '🔗';
}

function toggleIntegration(integration) {
  const status = state.integrations[integration];
  status.connected = !status.connected;
  
  if (status.connected) {
    status.lastSync = new Date();
    addActivity(`${humanize(integration)} integration connected.`);
    
    // Simulate importing data when connecting
    setTimeout(() => {
      if (integration === 'calendar') {
        updateSharedMemory('schedules', [
          { title: 'Team Meeting', time: '14:00', participants: ['Team'], duration: 60 }
        ]);
      } else if (integration === 'email') {
        state.unreadEmails += 3;
        renderKPIs();
      } else if (integration === 'project') {
        updateSharedMemory('deadlines', [
          { task: 'Sprint Review', date: '2024-01-20', priority: 'high' }
        ]);
      }
    }, 1000);
  } else {
    addActivity(`${humanize(integration)} integration disconnected.`, 'error');
  }
  
  renderIntegrations();
}

function syncIntegration(integration) {
  const status = state.integrations[integration];
  if (!status.connected) return;
  
  addActivity(`Syncing ${humanize(integration)}...`);
  
  // Simulate sync process
  setTimeout(() => {
    status.lastSync = new Date();
    addActivity(`${humanize(integration)} sync completed.`);
    renderIntegrations();
  }, 2000);
}

/* Auto-run functionality */
function startAutoRun() {
  // Check for auto-run enabled agents every 30 seconds
  setInterval(() => {
    Object.entries(state.agentStates).forEach(([agent, config]) => {
      if (config.autoRun && config.status === 'idle') {
        const lastRun = config.lastRun;
        const now = Date.now();
        const interval = (config.interval || 30) * 60 * 1000; // Convert to milliseconds
        
        if (!lastRun || (now - lastRun) > interval) {
          addActivity(`Auto-running ${humanize(agent)}...`);
          simulateAgentRun(agent);
          config.lastRun = now;
        }
      }
    });
  }, 30000); // Check every 30 seconds
}

/* System health monitoring */
function updateSystemHealth() {
  const health = calculateSystemHealth();
  const healthBar = document.querySelector('.health-fill');
  if (healthBar) {
    healthBar.style.width = `${health}%`;
  }
  
  // Update health percentage
  const healthText = document.querySelector('.health-indicator span');
  if (healthText) {
    healthText.textContent = `${health}%`;
  }
}

function calculateSystemHealth() {
  const agentPerformance = Object.values(state.agentStates)
    .reduce((sum, agent) => sum + agent.performance, 0) / Object.keys(state.agentStates).length;
  
  const integrationHealth = Object.values(state.integrations)
    .filter(integration => integration.connected).length / Object.keys(state.integrations).length;
  
  const conflictHealth = state.conflicts.length === 0 ? 1 : Math.max(0, 1 - (state.conflicts.length * 0.1));
  
  return Math.round((agentPerformance * 0.4 + integrationHealth * 0.3 + conflictHealth * 0.3) * 100);
}

/* initialize */
function init() {
  renderKPIs();
  renderContext();
  renderConflicts();
  updateNotifPanel();
  initializeIntegrations();
  initializePredictiveAnalytics();
  initializeAIInsights();
  initializeClearActivity();
  initializeDynamicEffects();
  updateSystemHealth();
  startAutoRun();
  addActivity('Dashboard initialized.');
  
  // Update system health every 10 seconds
  setInterval(updateSystemHealth, 10000);
  
  // set year
  const y = new Date().getFullYear();
  document.getElementById('year').textContent = y;
}

// Initialize dynamic effects and micro-interactions
function initializeDynamicEffects() {
  // Add parallax effect to background
  window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    const parallax = document.querySelector('.app-shell');
    if (parallax) {
      const speed = scrolled * 0.5;
      parallax.style.transform = `translateY(${speed}px)`;
    }
  });

  // Add typing effect to main title
  const title = document.querySelector('.top-left h1');
  if (title) {
    const text = title.textContent;
    title.textContent = '';
    let i = 0;
    const typeWriter = () => {
      if (i < text.length) {
        title.textContent += text.charAt(i);
        i++;
        setTimeout(typeWriter, 100);
      }
    };
    setTimeout(typeWriter, 1000);
  }

  // Add floating animation to KPI cards
  const kpiCards = document.querySelectorAll('.kpi');
  kpiCards.forEach((card, index) => {
    card.style.animationDelay = `${index * 0.1}s`;
    card.addEventListener('mouseenter', () => {
      card.style.animation = 'float 2s ease-in-out infinite';
    });
    card.addEventListener('mouseleave', () => {
      card.style.animation = 'none';
    });
  });

  // Add ripple effect to buttons
  const buttons = document.querySelectorAll('.btn');
  buttons.forEach(button => {
    button.addEventListener('click', createRipple);
  });

  // Add glow effect to active elements
  const activeElements = document.querySelectorAll('.nav-item.active, .agent-card');
  activeElements.forEach(element => {
    element.addEventListener('mouseenter', () => {
      element.style.animation = 'glow 2s ease-in-out infinite';
    });
    element.addEventListener('mouseleave', () => {
      element.style.animation = 'none';
    });
  });

  // Add dynamic status indicators
  updateStatusIndicators();
  setInterval(updateStatusIndicators, 5000);

  // Initialize floating action button
  initializeFAB();
}

// Initialize Floating Action Button
function initializeFAB() {
  const fab = document.getElementById('fab-main');
  if (fab) {
    fab.addEventListener('click', () => {
      showQuickActions();
    });
  }
}

// Show quick actions menu
function showQuickActions() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 400px; text-align: center;">
      <div class="modal-header">
        <h3>⚡ Quick Actions</h3>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <div class="quick-actions-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; padding: 20px;">
          <button class="quick-action-btn" onclick="runAllAgents()">
            <div style="font-size: 24px; margin-bottom: 8px;">🚀</div>
            <div>Run All Agents</div>
          </button>
          <button class="quick-action-btn" onclick="showSystemStatus()">
            <div style="font-size: 24px; margin-bottom: 8px;">📊</div>
            <div>System Status</div>
          </button>
          <button class="quick-action-btn" onclick="exportData()">
            <div style="font-size: 24px; margin-bottom: 8px;">📤</div>
            <div>Export Data</div>
          </button>
          <button class="quick-action-btn" onclick="showSettings()">
            <div style="font-size: 24px; margin-bottom: 8px;">⚙️</div>
            <div>Settings</div>
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Add styles for quick actions
  const styles = document.createElement('style');
  styles.textContent = `
    .quick-action-btn {
      padding: 20px;
      background: var(--panel);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      color: var(--text);
      cursor: pointer;
      transition: var(--transition);
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }
    .quick-action-btn:hover {
      transform: translateY(-4px);
      box-shadow: var(--shadow-lg);
      border-color: var(--accent);
      background: var(--gradient-1);
    }
  `;
  document.head.appendChild(styles);
  
  modal.querySelectorAll('.modal-close').forEach(b => b.addEventListener('click', () => modal.remove()));
}

// Quick action functions
function runAllAgents() {
  const agentButtons = document.querySelectorAll('.agent-card .btn.primary');
  agentButtons.forEach((btn, index) => {
    setTimeout(() => {
      btn.click();
    }, index * 500);
  });
  showToast('Running all agents...', 'info');
}

function showSystemStatus() {
  const health = calculateSystemHealth();
  showToast(`System Health: ${health}%`, health > 80 ? 'success' : 'warning');
}

function exportData() {
  const data = {
    timestamp: new Date().toISOString(),
    kpis: {
      meetings: state.meetings,
      emails: state.unreadEmails,
      tasks: state.openTasks,
      satisfaction: state.satisfaction
    },
    agents: state.agentStates,
    activities: state.activities.slice(0, 10)
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dashboard-export-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  
  showToast('Data exported successfully!', 'success');
}

function showSettings() {
  const settingsBtn = document.querySelector('.nav-item[data-panel="settings"]');
  if (settingsBtn) {
    settingsBtn.click();
  }
}

// Create ripple effect for buttons
function createRipple(event) {
  const button = event.currentTarget;
  const circle = document.createElement('span');
  const diameter = Math.max(button.clientWidth, button.clientHeight);
  const radius = diameter / 2;

  circle.style.width = circle.style.height = `${diameter}px`;
  circle.style.left = `${event.clientX - button.offsetLeft - radius}px`;
  circle.style.top = `${event.clientY - button.offsetTop - radius}px`;
  circle.classList.add('ripple');

  const ripple = button.getElementsByClassName('ripple')[0];
  if (ripple) {
    ripple.remove();
  }

  button.appendChild(circle);
}

// Update status indicators dynamically
function updateStatusIndicators() {
  const indicators = document.querySelectorAll('.status-indicator');
  indicators.forEach(indicator => {
    const statuses = ['online', 'offline', 'busy'];
    const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
    indicator.className = `status-indicator ${randomStatus}`;
  });
}

init();

/* extras: small loader CSS injected so we don't need image assets */
const style = document.createElement('style');
style.textContent = `
.loader-small{display:inline-block;width:14px;height:14px;border-radius:50%;border:2px solid rgba(255,255,255,0.15);border-top-color:var(--accent);animation:spin 900ms linear infinite;margin-right:6px;vertical-align:middle}
@keyframes spin{to{transform:rotate(360deg)}}`;
document.head.appendChild(style);

/* Calendar Modal for Meeting Agent */
// Toast notification function
function showToast(message, type = 'info', duration = 3000) {
  // Remove existing toasts
  document.querySelectorAll('.toast').forEach(toast => toast.remove());
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  
  // Style the toast
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: var(--panel);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px;
    padding: 12px 16px;
    color: var(--text);
    font-size: 14px;
    z-index: 10000;
    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    transform: translateX(100%);
    transition: transform 0.3s ease;
    max-width: 300px;
    word-wrap: break-word;
  `;
  
  // Add type-specific styling
  if (type === 'success') {
    toast.style.borderLeft = '4px solid var(--accent)';
  } else if (type === 'error') {
    toast.style.borderLeft = '4px solid #ff6b6b';
  } else if (type === 'warning') {
    toast.style.borderLeft = '4px solid #ffd93d';
  }
  
  document.body.appendChild(toast);
  
  // Animate in
  setTimeout(() => {
    toast.style.transform = 'translateX(0)';
  }, 100);
  
  // Auto remove
  setTimeout(() => {
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 300);
  }, duration);
  
  // Click to dismiss
  toast.addEventListener('click', () => {
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 300);
  });
}

function showCalendarModal() {
  const today = new Date();
  let viewYear = today.getFullYear();
  let viewMonth = today.getMonth(); // 0-11

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 1000px;">
      <div class="modal-header">
        <h3>🤖 Smart Meeting Assistant</h3>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <div class="smart-meeting-container">
          <div class="meeting-tabs">
            <button class="tab-btn active" data-tab="schedule">📅 Schedule Meeting</button>
            <button class="tab-btn" data-tab="ai-optimize">🔮 AI Optimization</button>
            <button class="tab-btn" data-tab="notes">📝 Meeting Notes</button>
          </div>
          
          <div class="tab-content active" id="schedule-tab">
            <div class="calendar">
              <div class="calendar-header">
                <div class="nav">
                  <button class="btn ghost cal-prev">◀</button>
                  <button class="btn ghost cal-today">Today</button>
                  <button class="btn ghost cal-next">▶</button>
                </div>
                <div class="month-label"></div>
              </div>
              <div class="calendar-weekdays">
                <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
              </div>
              <div class="calendar-body">
                <div class="calendar-grid"></div>
                <div class="calendar-side">
                  <div><strong>New Meeting</strong></div>
                  <div class="calendar-form">
                    <label>Meeting Type
                      <select class="meeting-type">
                        <option value="standup">Daily Standup</option>
                        <option value="1-on-1">1-on-1</option>
                        <option value="brainstorming">Brainstorming</option>
                        <option value="decision-making">Decision Making</option>
                        <option value="presentation">Presentation</option>
                        <option value="retrospective">Retrospective</option>
                        <option value="other">Other</option>
                      </select>
                    </label>
                    <label>Date<input type="date" class="cal-date"></label>
                    <label>Time<input type="time" class="cal-time" value="10:00"></label>
                    <label>Duration (minutes)<input type="number" class="cal-duration" value="60" min="15" max="180"></label>
                    <label>Title<input type="text" class="cal-title" placeholder="Meeting title"></label>
                    <label>Objectives<textarea class="cal-objectives" placeholder="What do you want to achieve?"></textarea></label>
                    <label>Participants<input type="text" class="cal-participants" placeholder="Comma separated names"></label>
                    <div class="actions">
                      <button class="btn ghost cal-cancel">Clear</button>
                      <button class="btn primary cal-save">Schedule</button>
                      <button class="btn secondary ai-optimize-btn">🤖 AI Optimize</button>
                    </div>
                  </div>
                  <div style="margin-top:8px"><strong>Meetings on selected day</strong></div>
                  <div class="events-list"></div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="tab-content" id="ai-optimize-tab">
            <div class="ai-optimization-panel">
              <h4>🔮 AI Meeting Optimization</h4>
              <div class="optimization-results" id="optimization-results">
                <div class="optimization-placeholder">
                  <div class="placeholder-icon">🤖</div>
                  <p>Click "AI Optimize" to get intelligent meeting suggestions</p>
                </div>
              </div>
            </div>
          </div>
          
          <div class="tab-content" id="notes-tab">
            <div class="meeting-notes-panel">
              <h4>📝 AI-Powered Meeting Notes</h4>
              <div class="notes-input-section">
                <label>Meeting Notes
                  <textarea id="meeting-notes" placeholder="Paste your meeting notes here for AI processing..." rows="8"></textarea>
                </label>
                <div class="notes-actions">
                  <button class="btn primary" id="process-notes">🤖 Process Notes</button>
                  <button class="btn ghost" id="clear-notes">Clear</button>
                </div>
              </div>
              <div class="notes-results" id="notes-results" style="display: none;">
                <div class="notes-summary">
                  <h5>📋 Summary</h5>
                  <div class="summary-content" id="summary-content"></div>
                </div>
                <div class="action-items">
                  <h5>✅ Action Items</h5>
                  <div class="action-items-list" id="action-items-list"></div>
                </div>
                <div class="decisions">
                  <h5>🎯 Decisions Made</h5>
                  <div class="decisions-list" id="decisions-list"></div>
                </div>
                <div class="sentiment">
                  <h5>😊 Meeting Sentiment</h5>
                  <div class="sentiment-content" id="sentiment-content"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn ghost modal-close">Close</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const grid = modal.querySelector('.calendar-grid');
  const monthLabel = modal.querySelector('.month-label');
  const dateInput = modal.querySelector('.cal-date');
  const timeInput = modal.querySelector('.cal-time');
  const titleInput = modal.querySelector('.cal-title');
  const participantsInput = modal.querySelector('.cal-participants');
  const eventsList = modal.querySelector('.events-list');

  // initialize selected date
  dateInput.value = toISODate(today);

  function toISODate(d){
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }

  function renderMonth(){
    const first = new Date(viewYear, viewMonth, 1);
    const startDay = first.getDay();
    const daysInMonth = new Date(viewYear, viewMonth+1, 0).getDate();
    const prevDays = new Date(viewYear, viewMonth, 0).getDate();
    monthLabel.textContent = first.toLocaleString(undefined, { month: 'long', year: 'numeric' });

    grid.innerHTML = '';
    // fill previous month days
    for (let i = startDay - 1; i >= 0; i--) {
      const d = prevDays - i;
      grid.appendChild(buildDayCell(new Date(viewYear, viewMonth-1, d), true));
    }
    // current month
    for (let d = 1; d <= daysInMonth; d++) {
      grid.appendChild(buildDayCell(new Date(viewYear, viewMonth, d), false));
    }
    // next month padding to complete 6 rows (42 cells)
    const cells = grid.children.length;
    for (let i = 0; i < 42 - cells; i++) {
      grid.appendChild(buildDayCell(new Date(viewYear, viewMonth+1, i+1), true));
    }
  }

  function buildDayCell(dateObj, otherMonth){
    const cell = document.createElement('div');
    const iso = toISODate(dateObj);
    const meetings = (state.sharedMemory.schedules||[]).filter(s => (s.date||'') === iso);
    const dots = meetings.slice(0,3).map(() => '<span class="dot"></span>').join('');
    const isToday = iso === toISODate(today);
    const isSelected = dateInput.value === iso;
    
    cell.className = `day-cell ${otherMonth ? 'other-month' : ''} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`;
    cell.setAttribute('data-date', iso);
    cell.setAttribute('data-day', dateObj.getDate());
    cell.setAttribute('data-month', dateObj.getMonth());
    cell.setAttribute('data-year', dateObj.getFullYear());
    
    cell.innerHTML = `
      <div class="date-num">${dateObj.getDate()}</div>
      <div class="dots">${dots}</div>
      ${meetings.length > 3 ? `<div class="more-indicator">+${meetings.length - 3}</div>` : ''}
    `;
    
    // Enhanced click functionality
    cell.addEventListener('click', (e)=> {
      e.preventDefault();
      e.stopPropagation();
      
      // Remove previous selection
      document.querySelectorAll('.day-cell.selected').forEach(c => c.classList.remove('selected'));
      
      // Add selection to clicked cell
      cell.classList.add('selected');
      
      // Update date input
      dateInput.value = iso;
      
      // Render events for selected day
      renderEventsForDay(iso);
      
      // Add visual feedback
      cell.style.transform = 'scale(0.95)';
      setTimeout(() => {
        cell.style.transform = '';
      }, 150);
      
      // Show toast notification
      showToast(`Selected ${dateObj.toLocaleDateString()} - ${meetings.length} meeting${meetings.length !== 1 ? 's' : ''}`);
    });
    
    // Add hover effects
    cell.addEventListener('mouseenter', () => {
      if (!cell.classList.contains('selected')) {
        cell.style.backgroundColor = 'rgba(102, 126, 234, 0.1)';
        cell.style.transform = 'scale(1.02)';
      }
    });
    
    cell.addEventListener('mouseleave', () => {
      if (!cell.classList.contains('selected')) {
        cell.style.backgroundColor = '';
        cell.style.transform = '';
      }
    });
    
    // Add double-click to create new meeting
    cell.addEventListener('dblclick', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Pre-fill the form with the selected date
      dateInput.value = iso;
      titleInput.focus();
      
      showToast(`Double-clicked ${dateObj.toLocaleDateString()} - Ready to create meeting`);
    });
    
    // Add right-click context menu
    cell.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      showContextMenu(e, iso, meetings);
    });
    
    return cell;
  }

  function renderEventsForDay(iso){
    const meetings = (state.sharedMemory.schedules||[]).filter(s => (s.date||'') === iso);
    eventsList.innerHTML = meetings.map((m, idx) => `
      <div class="event-chip">
        <div class="meta">
          <span class="title">${m.title}</span>
          <span>${m.time} • ${(m.participants||[]).join(', ') || '—'}</span>
        </div>
        <div class="chip-actions">
          <button class="btn ghost ev-edit" data-idx="${idx}" data-date="${iso}">Edit</button>
          <button class="btn ghost ev-del" data-idx="${idx}" data-date="${iso}">Delete</button>
        </div>
      </div>
    `).join('') || '<p class="muted">No meetings on this day.</p>';

    // attach handlers
    eventsList.querySelectorAll('.ev-del').forEach(b => b.addEventListener('click', (e)=>{
      const idx = parseInt(e.currentTarget.getAttribute('data-idx'));
      const date = e.currentTarget.getAttribute('data-date');
      const list = (state.sharedMemory.schedules||[]).filter(s => (s.date||'') === date);
      const target = list[idx];
      if (!target) return;
      state.sharedMemory.schedules = state.sharedMemory.schedules.filter(s => !(s.date===target.date && s.time===target.time && s.title===target.title));
      state.sharedMemory.lastUpdated = Date.now();
      addActivity(`Deleted meeting: ${target.title} on ${target.date} at ${target.time}`,'error');
      renderContext();
      renderMonth();
      renderEventsForDay(date);
      detectAdvancedConflicts();
    }));

    eventsList.querySelectorAll('.ev-edit').forEach(b => b.addEventListener('click', (e)=>{
      const idx = parseInt(e.currentTarget.getAttribute('data-idx'));
      const date = e.currentTarget.getAttribute('data-date');
      const list = (state.sharedMemory.schedules||[]).filter(s => (s.date||'') === date);
      const target = list[idx];
      if (!target) return;
      dateInput.value = target.date;
      timeInput.value = target.time;
      titleInput.value = target.title;
      participantsInput.value = (target.participants||[]).join(', ');
    }));
  }

  function saveMeeting(){
    const date = dateInput.value;
    const time = timeInput.value;
    const title = titleInput.value.trim() || 'Untitled Meeting';
    const participants = participantsInput.value.split(',').map(s=>s.trim()).filter(Boolean);
    const schedules = state.sharedMemory.schedules || [];

    // if an existing meeting with same date+time+title exists, update it; else add
    const existingIndex = schedules.findIndex(s => s.date===date && s.time===time && s.title===title);
    if (existingIndex >= 0) {
      schedules[existingIndex] = { ...schedules[existingIndex], date, time, title, participants };
      addActivity(`Rescheduled: ${title} on ${date} at ${time}`);
    } else {
      schedules.push({ title, date, time, participants, duration: 60 });
      state.meetings += 1;
      addActivity(`Scheduled: ${title} on ${date} at ${time}`);
    }
    updateSharedMemory('schedules', schedules);
    renderMonth();
    renderEventsForDay(date);
    renderKPIs();
    detectAdvancedConflicts();
  }

  // events
  modal.querySelectorAll('.modal-close').forEach(b => b.addEventListener('click', ()=> modal.remove()));
  modal.querySelector('.cal-prev').addEventListener('click', ()=> { if (viewMonth===0){viewMonth=11;viewYear--;} else viewMonth--; renderMonth(); });
  modal.querySelector('.cal-next').addEventListener('click', ()=> { if (viewMonth===11){viewMonth=0;viewYear++;} else viewMonth++; renderMonth(); });
  modal.querySelector('.cal-today').addEventListener('click', ()=> { viewYear=today.getFullYear(); viewMonth=today.getMonth(); dateInput.value = toISODate(today); renderMonth(); renderEventsForDay(dateInput.value); });
  modal.querySelector('.cal-save').addEventListener('click', saveMeeting);
  modal.querySelector('.cal-cancel').addEventListener('click', ()=> { titleInput.value=''; participantsInput.value=''; });

  // Context menu function
  function showContextMenu(e, iso, meetings) {
    // Remove existing context menu
    const existingMenu = document.querySelector('.calendar-context-menu');
    if (existingMenu) {
      existingMenu.remove();
    }
    
    const menu = document.createElement('div');
    menu.className = 'calendar-context-menu';
    menu.style.position = 'fixed';
    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';
    menu.style.zIndex = '10000';
    
    menu.innerHTML = `
      <div class="context-menu-item" data-action="select">
        <span>📅 Select Date</span>
      </div>
      <div class="context-menu-item" data-action="new-meeting">
        <span>➕ New Meeting</span>
      </div>
      <div class="context-menu-item" data-action="view-meetings">
        <span>👁️ View Meetings (${meetings.length})</span>
      </div>
      <div class="context-menu-item" data-action="copy-date">
        <span>📋 Copy Date</span>
      </div>
    `;
    
    document.body.appendChild(menu);
    
    // Handle context menu clicks
    menu.addEventListener('click', (e) => {
      const action = e.target.closest('.context-menu-item')?.dataset.action;
      if (action) {
        handleContextAction(action, iso, meetings);
        menu.remove();
      }
    });
    
    // Close menu when clicking outside
    setTimeout(() => {
      document.addEventListener('click', () => {
        menu.remove();
      }, { once: true });
    }, 100);
  }
  
  function handleContextAction(action, iso, meetings) {
    const dateObj = new Date(iso);
    
    switch (action) {
      case 'select':
        dateInput.value = iso;
        renderEventsForDay(iso);
        showToast(`Selected ${dateObj.toLocaleDateString()}`);
        break;
        
      case 'new-meeting':
        dateInput.value = iso;
        titleInput.focus();
        showToast(`Ready to create meeting on ${dateObj.toLocaleDateString()}`);
        break;
        
      case 'view-meetings':
        dateInput.value = iso;
        renderEventsForDay(iso);
        showToast(`Viewing ${meetings.length} meetings for ${dateObj.toLocaleDateString()}`);
        break;
        
      case 'copy-date':
        navigator.clipboard.writeText(iso).then(() => {
          showToast(`Copied date: ${iso}`);
        }).catch(() => {
          showToast('Failed to copy date');
        });
        break;
    }
  }

  // AI Meeting Assistant event handlers
  const tabBtns = modal.querySelectorAll('.tab-btn');
  const tabContents = modal.querySelectorAll('.tab-content');
  
  // Tab switching
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;
      
      // Update active tab
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      btn.classList.add('active');
      modal.querySelector(`#${tabName}-tab`).classList.add('active');
    });
  });
  
  // AI Optimize button
  const aiOptimizeBtn = modal.querySelector('.ai-optimize-btn');
  if (aiOptimizeBtn) {
    aiOptimizeBtn.addEventListener('click', async () => {
      await optimizeMeeting(modal);
    });
  }
  
  // Process notes button
  const processNotesBtn = modal.querySelector('#process-notes');
  if (processNotesBtn) {
    processNotesBtn.addEventListener('click', async () => {
      await processMeetingNotes(modal);
    });
  }
  
  // Clear notes button
  const clearNotesBtn = modal.querySelector('#clear-notes');
  if (clearNotesBtn) {
    clearNotesBtn.addEventListener('click', () => {
      modal.querySelector('#meeting-notes').value = '';
      modal.querySelector('#notes-results').style.display = 'none';
    });
  }

  // initial render
  renderMonth();
  renderEventsForDay(toISODate(today));
}

// AI Meeting Optimization function
async function optimizeMeeting(modal) {
  const meetingType = modal.querySelector('.meeting-type').value;
  const title = modal.querySelector('.cal-title').value;
  const objectives = modal.querySelector('.cal-objectives').value;
  const participants = modal.querySelector('.cal-participants').value;
  const duration = modal.querySelector('.cal-duration').value;
  
  if (!title || !participants) {
    showToast('Please fill in meeting title and participants', 'error');
    return;
  }
  
  const optimizationResults = modal.querySelector('#optimization-results');
  optimizationResults.innerHTML = `
    <div class="loading-predictions">
      <div class="loading-spinner"></div>
      <p>AI is optimizing your meeting...</p>
    </div>
  `;
  
  try {
    const meetingData = {
      meetingType,
      title,
      objectives,
      participants: participants.split(',').map(p => ({
        name: p.trim(),
        role: 'participant',
        timeZone: 'UTC'
      })),
      duration: parseInt(duration)
    };
    
    const response = await fetch('/api/meetings/schedule', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(meetingData)
    });
    
    const result = await response.json();
    
    if (result.optimizations) {
      displayOptimizationResults(optimizationResults, result);
    } else {
      throw new Error('No optimization results received');
    }
  } catch (error) {
    console.error('Meeting optimization error:', error);
    showToast('Failed to optimize meeting. Using demo results.', 'error');
    
    // Show demo optimization results
    const demoOptimizations = {
      suggestedTime: {
        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        endTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString(),
        confidence: 0.92,
        reasoning: 'Morning slot for better focus and energy; Optimized for multiple time zones'
      },
      suggestedParticipants: {
        required: participants.split(',').map(p => ({ name: p.trim(), role: 'participant' })),
        optional: [],
        suggested: [
          { name: 'Technical Lead', role: 'contributor', reason: 'Technical expertise needed for agenda items' }
        ],
        conflicts: []
      },
      agenda: {
        items: [
          { title: 'Welcome and introductions', duration: 5, type: 'welcome' },
          { title: 'Main discussion', duration: 45, type: 'discussion' },
          { title: 'Action items and next steps', duration: 10, type: 'action' }
        ],
        estimatedDuration: 60,
        aiGenerated: true
      },
      effectivenessScore: 87,
      preparationItems: [
        { item: 'Review meeting agenda and objectives', priority: 'high', estimatedTime: '5 minutes', category: 'preparation' },
        { item: 'Test meeting technology and tools', priority: 'medium', estimatedTime: '5 minutes', category: 'technical' }
      ],
      estimatedDuration: 60
    };
    
    displayOptimizationResults(optimizationResults, { optimizations: demoOptimizations });
  }
}

function displayOptimizationResults(container, result) {
  const optimizations = result.optimizations;
  
  container.innerHTML = `
    <div class="optimization-results-content">
      <div class="optimization-card">
        <h5>⏰ Optimal Time Slot</h5>
        <div class="optimization-details">
          <div class="time-slot">
            <strong>${new Date(optimizations.suggestedTime.startTime).toLocaleString()}</strong>
            <div class="confidence">${Math.round(optimizations.suggestedTime.confidence * 100)}% confidence</div>
            <div class="reasoning">${optimizations.suggestedTime.reasoning}</div>
          </div>
        </div>
      </div>
      
      <div class="optimization-card">
        <h5>👥 Participant Optimization</h5>
        <div class="optimization-details">
          <div class="participant-analysis">
            <div class="required-participants">
              <strong>Required:</strong> ${optimizations.suggestedParticipants.required.length} participants
            </div>
            ${optimizations.suggestedParticipants.suggested.length > 0 ? `
              <div class="suggested-participants">
                <strong>Suggested:</strong>
                <ul>
                  ${optimizations.suggestedParticipants.suggested.map(p => 
                    `<li>${p.name} - ${p.reason}</li>`
                  ).join('')}
                </ul>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
      
      <div class="optimization-card">
        <h5>📋 AI-Generated Agenda</h5>
        <div class="optimization-details">
          <div class="agenda-items">
            ${optimizations.agenda.items.map(item => `
              <div class="agenda-item">
                <div class="agenda-title">${item.title}</div>
                <div class="agenda-duration">${item.duration} min</div>
              </div>
            `).join('')}
            <div class="total-duration">Total: ${optimizations.agenda.estimatedDuration} minutes</div>
          </div>
        </div>
      </div>
      
      <div class="optimization-card">
        <h5>📊 Effectiveness Prediction</h5>
        <div class="optimization-details">
          <div class="effectiveness-score">
            <div class="score-value">${optimizations.effectivenessScore}%</div>
            <div class="score-label">Predicted Effectiveness</div>
          </div>
        </div>
      </div>
      
      <div class="optimization-card">
        <h5>📝 Preparation Checklist</h5>
        <div class="optimization-details">
          <div class="preparation-items">
            ${optimizations.preparationItems.map(item => `
              <div class="preparation-item">
                <div class="item-text">${item.item}</div>
                <div class="item-meta">
                  <span class="priority priority-${item.priority}">${item.priority}</span>
                  <span class="time">${item.estimatedTime}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
      
      <div class="optimization-actions">
        <button class="btn primary" onclick="applyOptimizations()">Apply Optimizations</button>
        <button class="btn ghost" onclick="regenerateOptimizations()">Regenerate</button>
      </div>
    </div>
  `;
}

// Process meeting notes function
async function processMeetingNotes(modal) {
  const notesText = modal.querySelector('#meeting-notes').value.trim();
  
  if (!notesText) {
    showToast('Please enter meeting notes to process', 'error');
    return;
  }
  
  const processBtn = modal.querySelector('#process-notes');
  const originalText = processBtn.innerHTML;
  
  processBtn.disabled = true;
  processBtn.innerHTML = '<span class="loader-small"></span>Processing...';
  
  try {
    const response = await fetch('/api/meetings/demo-meeting/notes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ notes: notesText })
    });
    
    const result = await response.json();
    
    if (result.processedNotes) {
      displayNotesResults(modal, result.processedNotes);
    } else {
      throw new Error('No processed notes received');
    }
  } catch (error) {
    console.error('Notes processing error:', error);
    showToast('Failed to process notes. Using demo results.', 'error');
    
    // Show demo results
    const demoProcessedNotes = {
      summary: 'The team discussed project progress, identified key blockers, and agreed on next steps for the upcoming sprint.',
      actionItems: [
        'Review technical requirements by Friday',
        'Schedule follow-up meeting with stakeholders',
        'Update project timeline based on new requirements'
      ],
      decisions: [
        'Agreed to extend sprint deadline by one week',
        'Decided to prioritize user authentication feature',
        'Approved additional budget for third-party integrations'
      ],
      sentiment: { sentiment: 'positive', score: 0.8 },
      keyPoints: [
        'Project is on track despite minor delays',
        'Team collaboration has improved significantly',
        'Stakeholder feedback was mostly positive'
      ],
      followUpRequired: true
    };
    
    displayNotesResults(modal, demoProcessedNotes);
  }
  
  processBtn.disabled = false;
  processBtn.innerHTML = originalText;
}

function displayNotesResults(modal, processedNotes) {
  const resultsContainer = modal.querySelector('#notes-results');
  
  modal.querySelector('#summary-content').textContent = processedNotes.summary;
  
  modal.querySelector('#action-items-list').innerHTML = processedNotes.actionItems.map(item => 
    `<div class="action-item">• ${item}</div>`
  ).join('') || '<div class="action-item">No action items found</div>';
  
  modal.querySelector('#decisions-list').innerHTML = processedNotes.decisions.map(decision => 
    `<div class="decision-item">• ${decision}</div>`
  ).join('') || '<div class="decision-item">No decisions recorded</div>';
  
  modal.querySelector('#sentiment-content').innerHTML = `
    <div class="sentiment-analysis">
      <div class="sentiment-score ${processedNotes.sentiment.sentiment}">
        ${processedNotes.sentiment.sentiment.toUpperCase()} (${Math.round(processedNotes.sentiment.score * 100)}%)
      </div>
      <div class="sentiment-emoji">
        ${processedNotes.sentiment.sentiment === 'positive' ? '😊' : 
          processedNotes.sentiment.sentiment === 'negative' ? '😞' : '😐'}
      </div>
    </div>
  `;
  
  resultsContainer.style.display = 'block';
  
  addActivity('Meeting notes processed with AI analysis', 'success');
}

/* Report Generator Modal */
function showReportModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>Generate Report</h3>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <div class="setting-group">
          <h4>Format</h4>
          <label class="setting-line">
            <span>Choose export format</span>
            <select class="report-format">
              <option value="csv">CSV</option>
              <option value="pdf">PDF</option>
              <option value="html">HTML</option>
            </select>
          </label>
        </div>
        <div class="setting-group">
          <h4>Scope</h4>
          <label class="setting-line">
            <span>Include detailed items</span>
            <input type="checkbox" class="report-include-details" checked>
          </label>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn ghost preview-report">Preview</button>
        <button class="btn primary download-report">Download</button>
        <button class="btn ghost modal-close">Cancel</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const formatSel = modal.querySelector('.report-format');
  const includeDetailsEl = modal.querySelector('.report-include-details');

  function buildAggregatedData(){
    const schedules = state.sharedMemory.schedules || [];
    const deadlines = state.sharedMemory.deadlines || [];
    const resources = state.sharedMemory.resources || [];
    const meetingsToday = state.meetings;
    const unread = state.unreadEmails;
    const openTasks = state.openTasks;
    const satisfaction = state.satisfaction;
    const byDate = schedules.reduce((acc, s) => {
      const key = s.date || 'unscheduled';
      (acc[key] = acc[key] || []).push(s);
      return acc;
    }, {});
    const aggregates = {
      totals: {
        meetings: schedules.length,
        uniqueDays: Object.keys(byDate).length,
        deadlines: deadlines.length,
        resources: resources.length,
        meetingsToday,
        unread,
        openTasks,
        satisfaction
      },
      byDate,
      deadlines,
      resources
    };
    return aggregates;
  }

  function renderReportHTML(includeDetails){
    const data = buildAggregatedData();
    const dateNow = new Date().toLocaleString();
    const rows = Object.entries(data.byDate).map(([date, list]) => `
      <tr><td>${date}</td><td>${list.length}</td><td>${list.map(m => m.title).join(', ')}</td></tr>
    `).join('');
    const deadlineRows = data.deadlines.map(d => `
      <tr><td>${d.task}</td><td>${d.date}</td><td>${d.priority}</td></tr>
    `).join('');
    const resourceRows = data.resources.map(r => `
      <tr><td>${r.name}</td><td>${r.usage}/${r.capacity}</td></tr>
    `).join('');
    return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Project Report</title>
<style>
  body{font-family:Segoe UI,Roboto,Arial;color:#0f172a;padding:24px}
  h1,h2{margin:0 0 8px 0}
  .muted{color:#475569}
  table{width:100%;border-collapse:collapse;margin-top:8px}
  th,td{border:1px solid #e2e8f0;padding:8px;font-size:14px;text-align:left}
  th{background:#f1f5f9}
  .kpis{display:flex;gap:12px;margin:12px 0}
  .kpi{border:1px solid #e2e8f0;border-radius:8px;padding:8px;flex:1}
  .small{font-size:12px}
</style></head>
<body>
  <h1>Project Report</h1>
  <div class="muted small">Generated at ${dateNow}</div>
  <div class="kpis">
    <div class="kpi"><div>Total Meetings</div><strong>${data.totals.meetings}</strong></div>
    <div class="kpi"><div>Unique Days Scheduled</div><strong>${data.totals.uniqueDays}</strong></div>
    <div class="kpi"><div>Deadlines</div><strong>${data.totals.deadlines}</strong></div>
    <div class="kpi"><div>Unread Emails</div><strong>${data.totals.unread}</strong></div>
    <div class="kpi"><div>Open Tasks</div><strong>${data.totals.openTasks}</strong></div>
    <div class="kpi"><div>Satisfaction</div><strong>${data.totals.satisfaction}%</strong></div>
  </div>
  <h2>Meetings by Date</h2>
  <table><thead><tr><th>Date</th><th>Count</th><th>Titles</th></tr></thead><tbody>
    ${rows || '<tr><td colspan="3">No meetings found</td></tr>'}
  </tbody></table>
  <h2>Deadlines</h2>
  <table><thead><tr><th>Task</th><th>Date</th><th>Priority</th></tr></thead><tbody>
    ${deadlineRows || '<tr><td colspan="3">No deadlines</td></tr>'}
  </tbody></table>
  <h2>Resources</h2>
  <table><thead><tr><th>Resource</th><th>Usage</th></tr></thead><tbody>
    ${resourceRows || '<tr><td colspan="2">No resources</td></tr>'}
  </tbody></table>
  ${includeDetails ? renderDetailedSection() : ''}
</body></html>`;
  }

  function renderDetailedSection(){
    const schedules = state.sharedMemory.schedules || [];
    if (schedules.length === 0) return '';
    const items = schedules.map(s => `<li>${s.date || '—'} ${s.time || ''} — <strong>${s.title}</strong> (${(s.participants||[]).join(', ') || '—'})</li>`).join('');
    return `
      <h2>Detailed Meetings</h2>
      <ul>${items}</ul>
    `;
  }

  function buildCSV(){
    const data = buildAggregatedData();
    const lines = [];
    lines.push('Section,Key,Value');
    lines.push(`Totals,Total Meetings,${data.totals.meetings}`);
    lines.push(`Totals,Unique Days,${data.totals.uniqueDays}`);
    lines.push(`Totals,Deadlines,${data.totals.deadlines}`);
    lines.push(`Totals,Unread Emails,${data.totals.unread}`);
    lines.push(`Totals,Open Tasks,${data.totals.openTasks}`);
    lines.push(`Totals,Satisfaction,${data.totals.satisfaction}%`);
    lines.push('');
    lines.push('Meetings,Date,Title,Time,Participants');
    (state.sharedMemory.schedules||[]).forEach(s => {
      const participants = (s.participants||[]).join(' ').replace(/,/g,';');
      lines.push(`Meeting,${s.date||''},${escapeCsv(s.title||'')},${s.time||''},${escapeCsv(participants)}`);
    });
    lines.push('');
    lines.push('Deadlines,Task,Date,Priority');
    (state.sharedMemory.deadlines||[]).forEach(d => {
      lines.push(`Deadline,${escapeCsv(d.task||'')},${d.date||''},${d.priority||''}`);
    });
    return lines.join('\n');
  }

  function escapeCsv(s){
    if (s == null) return '';
    const needsQuotes = /[",\n]/.test(s);
    const v = String(s).replace(/"/g,'""');
    return needsQuotes ? `"${v}"` : v;
  }

  function download(filename, content, mime){
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function openPreview(html){
    const w = window.open('', '_blank');
    if (!w) { showToast('Popup blocked. Please allow popups for preview.'); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  modal.querySelectorAll('.modal-close').forEach(b => b.addEventListener('click', ()=> modal.remove()));

  modal.querySelector('.preview-report').addEventListener('click', ()=>{
    const includeDetails = includeDetailsEl.checked;
    const html = renderReportHTML(includeDetails);
    openPreview(html);
    addActivity('Report preview opened.');
  });

  modal.querySelector('.download-report').addEventListener('click', ()=>{
    const fmt = formatSel.value;
    const includeDetails = includeDetailsEl.checked;
    if (fmt === 'csv') {
      const csv = buildCSV();
      download(`project-report-${Date.now()}.csv`, csv, 'text/csv');
      addActivity('Report CSV downloaded.');
    } else if (fmt === 'pdf') {
      // Basic approach: download HTML and let user print to PDF
      const html = renderReportHTML(includeDetails);
      download(`project-report-${Date.now()}.html`, html, 'text/html');
      addActivity('Report HTML downloaded (print to PDF).');
    } else {
      const html = renderReportHTML(includeDetails);
      download(`project-report-${Date.now()}.html`, html, 'text/html');
      addActivity('Report HTML downloaded.');
    }
  });
}

/* Task Router Modal */
function showTaskRouterModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  const tasks = getManagerAssignedTasks();
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>Task Router</h3>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <div class="setting-group">
          <h4>Routes tasks to owners, monitors SLAs</h4>
          <div class="muted">Assigns tasks based on availability, skill, and priority; escalates on SLA breach.</div>
        </div>
        <div class="context-section">
          <h4>Manager Assigned Tasks (${tasks.length})</h4>
          <div class="tasks-list"></div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn ghost modal-close">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const listEl = modal.querySelector('.tasks-list');

  function renderTasks(){
    if (!tasks.length){
      listEl.innerHTML = '<p class="muted">No tasks assigned.</p>';
      return;
    }
    listEl.innerHTML = tasks.map((t, i) => {
      const slaLeft = calcSlaLeft(t.due);
      const slaClass = slaLeft < 0 ? 'severity-high' : slaLeft < 24 ? 'severity-medium' : 'severity-low';
      return `
        <div class="event-chip" data-index="${i}">
          <div class="meta">
            <span class="title">${t.title}</span>
            <span>Owner: ${t.owner} • Priority: ${t.priority} • Due: ${t.due}</span>
            <span class="muted">SLA: ${formatHours(slaLeft)} remaining</span>
          </div>
          <div class="chip-actions">
            <button class="btn ghost mark-done">✔️ Done</button>
          </div>
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('.mark-done').forEach(btn => btn.addEventListener('click', (e)=>{
      const idx = parseInt(e.currentTarget.closest('.event-chip').getAttribute('data-index'));
      const task = tasks[idx];
      if (!task) return;
      tasks.splice(idx, 1);
      state.openTasks = Math.max(0, state.openTasks - 1);
      state.satisfaction = Math.min(100, state.satisfaction + 1);
      renderKPIs();
      addActivity(`Task completed: ${task.title} (Owner: ${task.owner})`);
      renderTasks();
    }));
  }

  function getManagerAssignedTasks(){
    // Simulated tasks; could be sourced from shared context
    const base = [
      { title: 'Prepare client demo deck', owner: 'Lisa', priority: 'high', due: isoIn(48) },
      { title: 'Fix login bug #432', owner: 'John', priority: 'medium', due: isoIn(20) },
      { title: 'Update onboarding docs', owner: 'Sarah', priority: 'low', due: isoIn(96) }
    ];
    // Optionally inject from deadlines as tasks
    (state.sharedMemory.deadlines||[]).slice(0,2).forEach(d => {
      base.push({ title: d.task, owner: 'Unassigned', priority: d.priority || 'medium', due: d.date });
    });
    // Initialize openTasks KPI to reflect tasks list length if larger
    if (state.openTasks < base.length) { state.openTasks = base.length; renderKPIs(); }
    return base;
  }

  function isoIn(hours){
    const d = new Date(Date.now() + hours*60*60*1000);
    return d.toISOString().slice(0,16).replace('T',' ');
  }

  function calcSlaLeft(dueStr){
    // dueStr may be 'YYYY-MM-DD' or 'YYYY-MM-DD HH:mm'
    const parse = dueStr.includes(' ') ? new Date(dueStr.replace(' ','T')) : new Date(dueStr);
    return Math.round((parse - new Date()) / (1000*60*60));
  }

  function formatHours(h){
    if (h < 0) return `${Math.abs(h)}h overdue`;
    if (h < 24) return `${h}h`;
    const days = Math.floor(h/24);
    const rem = h % 24;
    return rem ? `${days}d ${rem}h` : `${days}d`;
  }

  modal.querySelectorAll('.modal-close').forEach(b => b.addEventListener('click', ()=> modal.remove()));
  renderTasks();
}

// Document Processor Modal
function showDocumentProcessorModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 800px;">
      <div class="modal-header">
        <h3>📄 Document Processor</h3>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <div class="document-processor-container">
          <div class="upload-section">
            <h4>📤 Upload Document</h4>
            <div class="upload-area" id="upload-area">
              <div class="upload-content">
                <div class="upload-icon">📄</div>
                <p>Drag & drop your document here or click to browse</p>
                <p class="upload-hint">Supports: PDF, DOCX, TXT, MD, HTML, JSON, CSV (Max 10MB)</p>
                <input type="file" id="document-file" accept=".pdf,.docx,.txt,.md,.html,.json,.csv" style="display: none;">
                <button class="btn primary" onclick="document.getElementById('document-file').click()">Choose File</button>
              </div>
            </div>
          </div>
          
          <div class="text-input-section">
            <h4>✍️ Or Paste Text</h4>
            <textarea id="document-text" placeholder="Paste your document content here..." rows="6"></textarea>
            <div class="input-actions">
              <input type="text" id="document-name" placeholder="Document name (optional)" style="flex: 1; margin-right: 10px;">
              <button class="btn primary" id="process-text">Process Text</button>
            </div>
          </div>
          
          <div class="processing-section" id="processing-section" style="display: none;">
            <h4>🔄 Processing Document</h4>
            <div class="processing-status">
              <div class="processing-steps">
                <div class="step active" data-step="1">📄 Reading Document</div>
                <div class="step" data-step="2">🔍 Extracting Entities</div>
                <div class="step" data-step="3">📊 Analyzing Content</div>
                <div class="step" data-step="4">✅ Generating Summary</div>
              </div>
              <div class="processing-progress">
                <div class="progress-bar">
                  <div class="progress-fill" style="width: 0%"></div>
                </div>
                <span class="progress-text">0%</span>
              </div>
            </div>
          </div>
          
          <div class="results-section" id="results-section" style="display: none;">
            <h4>📊 Analysis Results</h4>
            <div class="results-grid">
              <div class="result-card">
                <h5>📋 Document Type</h5>
                <div class="result-value" id="doc-type">-</div>
              </div>
              <div class="result-card">
                <h5>🎯 Confidence</h5>
                <div class="result-value" id="confidence">-</div>
              </div>
              <div class="result-card">
                <h5>🌍 Language</h5>
                <div class="result-value" id="language">-</div>
              </div>
              <div class="result-card">
                <h5>😊 Sentiment</h5>
                <div class="result-value" id="sentiment">-</div>
              </div>
            </div>
            
            <div class="entities-section">
              <h5>👥 Extracted Entities</h5>
              <div class="entities-grid">
                <div class="entity-group">
                  <h6>People</h6>
                  <div class="entity-list" id="people-list">-</div>
                </div>
                <div class="entity-group">
                  <h6>Organizations</h6>
                  <div class="entity-list" id="orgs-list">-</div>
                </div>
                <div class="entity-group">
                  <h6>Dates</h6>
                  <div class="entity-list" id="dates-list">-</div>
                </div>
                <div class="entity-group">
                  <h6>Amounts</h6>
                  <div class="entity-list" id="amounts-list">-</div>
                </div>
              </div>
            </div>
            
            <div class="summary-section">
              <h5>📝 Summary</h5>
              <div class="summary-content" id="summary-content">-</div>
            </div>
            
            <div class="action-items-section">
              <h5>✅ Action Items</h5>
              <div class="action-items-list" id="action-items-list">-</div>
            </div>
            
            <div class="results-actions">
              <button class="btn primary" id="export-results">📤 Export Results</button>
              <button class="btn ghost" id="process-another">🔄 Process Another</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Add styles
  const styles = document.createElement('style');
  styles.textContent = `
    .document-processor-container {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    
    .upload-area {
      border: 2px dashed #ddd;
      border-radius: 8px;
      padding: 40px;
      text-align: center;
      transition: all 0.3s ease;
      cursor: pointer;
    }
    
    .upload-area:hover {
      border-color: #667eea;
      background-color: #f8f9ff;
    }
    
    .upload-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
    }
    
    .upload-icon {
      font-size: 48px;
      margin-bottom: 10px;
    }
    
    .upload-hint {
      color: #666;
      font-size: 14px;
    }
    
    .text-input-section textarea {
      width: 100%;
      padding: 12px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-family: inherit;
      resize: vertical;
    }
    
    .input-actions {
      display: flex;
      gap: 10px;
      margin-top: 10px;
    }
    
    .processing-steps {
      display: flex;
      justify-content: space-between;
      margin-bottom: 20px;
    }
    
    .step {
      padding: 8px 12px;
      border-radius: 20px;
      background: #f0f0f0;
      color: #666;
      font-size: 14px;
      transition: all 0.3s ease;
    }
    
    .step.active {
      background: #667eea;
      color: white;
    }
    
    .step.completed {
      background: #28a745;
      color: white;
    }
    
    .progress-bar {
      width: 100%;
      height: 8px;
      background: #f0f0f0;
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 10px;
    }
    
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #667eea, #764ba2);
      transition: width 0.3s ease;
    }
    
    .results-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 15px;
      margin-bottom: 20px;
    }
    
    .result-card {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 8px;
      text-align: center;
    }
    
    .result-card h5 {
      margin: 0 0 8px 0;
      font-size: 14px;
      color: #666;
    }
    
    .result-value {
      font-size: 18px;
      font-weight: 600;
      color: #333;
    }
    
    .entities-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-bottom: 20px;
    }
    
    .entity-group h6 {
      margin: 0 0 8px 0;
      color: #667eea;
      font-size: 14px;
    }
    
    .entity-list {
      background: #f8f9fa;
      padding: 10px;
      border-radius: 6px;
      min-height: 40px;
      font-size: 14px;
    }
    
    .summary-content, .action-items-list {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 8px;
      line-height: 1.6;
    }
    
    .results-actions {
      display: flex;
      gap: 10px;
      justify-content: center;
      margin-top: 20px;
    }
  `;
  document.head.appendChild(styles);
  
  // Event listeners
  const fileInput = modal.querySelector('#document-file');
  const uploadArea = modal.querySelector('#upload-area');
  const textInput = modal.querySelector('#document-text');
  const processTextBtn = modal.querySelector('#process-text');
  const processAnotherBtn = modal.querySelector('#process-another');
  
  // File upload handling
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      processDocument(file);
    }
  });
  
  uploadArea.addEventListener('click', () => {
    fileInput.click();
  });
  
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = '#667eea';
    uploadArea.style.backgroundColor = '#f8f9ff';
  });
  
  uploadArea.addEventListener('dragleave', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = '#ddd';
    uploadArea.style.backgroundColor = 'transparent';
  });
  
  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = '#ddd';
    uploadArea.style.backgroundColor = 'transparent';
    
    const file = e.dataTransfer.files[0];
    if (file) {
      processDocument(file);
    }
  });
  
  processTextBtn.addEventListener('click', () => {
    const text = textInput.value.trim();
    const name = modal.querySelector('#document-name').value.trim() || 'Text Document';
    
    if (text) {
      processTextDocument(text, name);
    } else {
      showToast('Please enter some text to process', 'error');
    }
  });
  
  processAnotherBtn.addEventListener('click', () => {
    // Reset the modal
    modal.querySelector('#processing-section').style.display = 'none';
    modal.querySelector('#results-section').style.display = 'none';
    modal.querySelector('#document-text').value = '';
    modal.querySelector('#document-name').value = '';
    fileInput.value = '';
  });
  
  modal.querySelectorAll('.modal-close').forEach(b => b.addEventListener('click', () => modal.remove()));
  
  // Process document function
  async function processDocument(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target.result;
      await processTextDocument(content, file.name);
    };
    reader.readAsText(file);
  }
  
  // Process text document function
  async function processTextDocument(content, name) {
    // Show processing section
    modal.querySelector('#processing-section').style.display = 'block';
    modal.querySelector('#results-section').style.display = 'none';
    
    // Simulate processing steps
    const steps = modal.querySelectorAll('.step');
    const progressFill = modal.querySelector('.progress-fill');
    const progressText = modal.querySelector('.progress-text');
    
    steps.forEach(step => step.classList.remove('active', 'completed'));
    
    for (let i = 0; i < steps.length; i++) {
      steps[i].classList.add('active');
      const progress = ((i + 1) / steps.length) * 100;
      progressFill.style.width = progress + '%';
      progressText.textContent = Math.round(progress) + '%';
      
      await new Promise(resolve => setTimeout(resolve, 800));
      
      steps[i].classList.remove('active');
      steps[i].classList.add('completed');
    }
    
    // Call the API
    try {
      const response = await fetch('/api/documents/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: content,
          name: name
        })
      });
      
      const result = await response.json();
      
      if (result.results) {
        displayResults(result.results);
      } else {
        throw new Error('No results received');
      }
    } catch (error) {
      console.error('Document processing error:', error);
      showToast('Failed to process document. Using demo results.', 'error');
      
      // Show demo results
      const demoResults = {
        documentType: 'Contract',
        keyEntities: {
          people: ['John Smith', 'Sarah Johnson'],
          organizations: ['Acme Corp', 'Tech Solutions Inc.'],
          dates: ['2024-01-15', '2024-02-01'],
          amounts: ['$50,000', '$2,500']
        },
        summary: 'This document outlines the terms and conditions for a software development contract between Acme Corp and Tech Solutions Inc. The contract includes project milestones, payment terms, and deliverables.',
        actionItems: [
          'Review contract terms by January 15th',
          'Submit initial project proposal by February 1st',
          'Schedule kickoff meeting with stakeholders'
        ],
        sentiment: { sentiment: 'positive', score: 0.8 },
        language: 'English',
        confidence: 0.92
      };
      
      displayResults(demoResults);
    }
  }
  
  // Display results function
  function displayResults(results) {
    modal.querySelector('#processing-section').style.display = 'none';
    modal.querySelector('#results-section').style.display = 'block';
    
    // Update result cards
    modal.querySelector('#doc-type').textContent = results.documentType || 'Unknown';
    modal.querySelector('#confidence').textContent = Math.round((results.confidence || 0.8) * 100) + '%';
    modal.querySelector('#language').textContent = results.language || 'English';
    modal.querySelector('#sentiment').textContent = `${results.sentiment?.sentiment || 'neutral'} (${Math.round((results.sentiment?.score || 0.5) * 100)}%)`;
    
    // Update entities
    const entities = results.keyEntities || {};
    modal.querySelector('#people-list').textContent = entities.people?.join(', ') || 'None found';
    modal.querySelector('#orgs-list').textContent = entities.organizations?.join(', ') || 'None found';
    modal.querySelector('#dates-list').textContent = entities.dates?.join(', ') || 'None found';
    modal.querySelector('#amounts-list').textContent = entities.amounts?.join(', ') || 'None found';
    
    // Update summary and action items
    modal.querySelector('#summary-content').textContent = results.summary || 'No summary available';
    modal.querySelector('#action-items-list').innerHTML = results.actionItems?.map(item => 
      `<div class="action-item">• ${item}</div>`
    ).join('') || '<div class="action-item">No action items found</div>';
  }
}

// Predictive Analytics functionality
function initializePredictiveAnalytics() {
  const generateBtn = document.getElementById('generate-predictions');
  const timeRangeSelect = document.getElementById('time-range-select');
  const predictionsContainer = document.querySelector('[data-hook="predictions"]');
  
  if (!generateBtn || !predictionsContainer) return;
  
  generateBtn.addEventListener('click', async () => {
    const timeRange = timeRangeSelect.value;
    await generatePredictions(timeRange);
  });
}

async function generatePredictions(timeRange) {
  const predictionsContainer = document.querySelector('[data-hook="predictions"]');
  const generateBtn = document.getElementById('generate-predictions');
  
  if (!predictionsContainer || !generateBtn) return;
  
  // Show loading state
  generateBtn.disabled = true;
  generateBtn.innerHTML = '<span class="loader-small"></span>Generating...';
  
  predictionsContainer.innerHTML = `
    <div class="loading-predictions">
      <div class="loading-spinner"></div>
      <p>AI is analyzing patterns and generating predictions...</p>
    </div>
  `;
  
  try {
    const response = await fetch('/api/analytics/predictions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ timeRange })
    });
    
    const result = await response.json();
    
    if (result.predictions) {
      displayPredictions(result.predictions, result.accuracy);
    } else {
      throw new Error('No predictions received');
    }
  } catch (error) {
    console.error('Prediction generation error:', error);
    showToast('Failed to generate predictions. Using demo data.', 'error');
    
    // Show demo predictions
    const demoPredictions = {
      workload: {
        data: [
          { date: '2024-01-15', workload: 78, confidence: 0.92 },
          { date: '2024-01-16', workload: 82, confidence: 0.89 },
          { date: '2024-01-17', workload: 75, confidence: 0.94 },
          { date: '2024-01-18', workload: 88, confidence: 0.87 },
          { date: '2024-01-19', workload: 65, confidence: 0.91 }
        ],
        average: 78,
        peak: 88,
        trend: 'increasing'
      },
      productivity: {
        data: [
          { date: '2024-01-15', productivity: 85, factors: { meetings: 25, interruptions: 12, focusTime: 68 } },
          { date: '2024-01-16', productivity: 88, factors: { meetings: 22, interruptions: 10, focusTime: 72 } },
          { date: '2024-01-17', productivity: 82, factors: { meetings: 28, interruptions: 15, focusTime: 65 } },
          { date: '2024-01-18', productivity: 90, factors: { meetings: 20, interruptions: 8, focusTime: 75 } },
          { date: '2024-01-19', productivity: 76, factors: { meetings: 30, interruptions: 18, focusTime: 60 } }
        ],
        average: 84,
        trend: 'increasing',
        insights: [
          'Productivity peaks on Tuesday and Wednesday',
          'Meeting load affects focus time significantly',
          'Interruptions are highest on Monday mornings'
        ]
      },
      meetingConflicts: {
        data: [
          { date: '2024-01-15', conflicts: 2, meetings: 8, probability: 25, suggestedActions: ['Use AI scheduling', 'Implement buffer times'] },
          { date: '2024-01-16', conflicts: 1, meetings: 6, probability: 17, suggestedActions: ['Use AI scheduling'] },
          { date: '2024-01-17', conflicts: 3, meetings: 10, probability: 30, suggestedActions: ['Use AI scheduling', 'Implement buffer times', 'Consider async alternatives'] }
        ],
        totalConflicts: 6,
        highRiskDays: 1,
        recommendations: [
          'Schedule buffer time between meetings',
          'Use AI scheduling to optimize time slots',
          'Consider async alternatives for low-priority meetings'
        ]
      },
      taskCompletion: {
        data: [
          { date: '2024-01-15', tasks: [
            { name: 'Development Task 1', type: 'Development', priority: 'high', completionProbability: 85 },
            { name: 'Code Review Task', type: 'Code Review', priority: 'medium', completionProbability: 92 }
          ], totalTasks: 2, avgCompletionRate: 89 },
          { date: '2024-01-16', tasks: [
            { name: 'Testing Task', type: 'Testing', priority: 'high', completionProbability: 78 },
            { name: 'Documentation Task', type: 'Documentation', priority: 'low', completionProbability: 88 }
          ], totalTasks: 2, avgCompletionRate: 83 }
        ],
        totalTasks: 4,
        avgCompletionRate: 86,
        riskTasks: 1,
        insights: [
          'High-priority tasks have 15% higher completion rates',
          'Tasks scheduled for Tuesday-Thursday show better outcomes',
          'Complex tasks benefit from breaking into smaller subtasks'
        ]
      },
      resourceUtilization: {
        data: {
          cpu: [
            { date: '2024-01-15', usage: 45, status: 'normal' },
            { date: '2024-01-16', usage: 52, status: 'normal' },
            { date: '2024-01-17', usage: 48, status: 'normal' }
          ],
          memory: [
            { date: '2024-01-15', usage: 68, status: 'warning' },
            { date: '2024-01-16', usage: 72, status: 'warning' },
            { date: '2024-01-17', usage: 70, status: 'warning' }
          ],
          storage: [
            { date: '2024-01-15', usage: 78, status: 'warning' },
            { date: '2024-01-16', usage: 80, status: 'warning' },
            { date: '2024-01-17', usage: 82, status: 'warning' }
          ],
          network: [
            { date: '2024-01-15', usage: 35, status: 'normal' },
            { date: '2024-01-16', usage: 42, status: 'normal' },
            { date: '2024-01-17', usage: 38, status: 'normal' }
          ]
        },
        alerts: [
          { resource: 'memory', level: 'warning', message: 'MEMORY usage is at 72%', action: 'Monitor closely' },
          { resource: 'storage', level: 'warning', message: 'STORAGE usage is at 82%', action: 'Monitor closely' }
        ],
        recommendations: [
          'Consider scaling CPU resources for peak usage periods',
          'Memory usage is trending upward - monitor closely',
          'Storage cleanup recommended within 2 weeks',
          'Network capacity is sufficient for current load'
        ]
      },
      trends: {
        productivity: { direction: 'increasing', rate: 2.3, confidence: 0.87 },
        workload: { direction: 'stable', rate: 0.1, confidence: 0.92 },
        meetingEfficiency: { direction: 'improving', rate: 1.8, confidence: 0.79 },
        taskCompletion: { direction: 'increasing', rate: 3.2, confidence: 0.85 }
      },
      recommendations: [
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
        }
      ]
    };
    
    displayPredictions(demoPredictions, 0.89);
  }
  
  // Reset button
  generateBtn.disabled = false;
  generateBtn.innerHTML = 'Generate Predictions';
}

function displayPredictions(predictions, accuracy) {
  const predictionsContainer = document.querySelector('[data-hook="predictions"]');
  
  predictionsContainer.innerHTML = `
    <div class="predictions-container">
      ${renderWorkloadPrediction(predictions.workload)}
      ${renderProductivityPrediction(predictions.productivity)}
      ${renderMeetingConflictsPrediction(predictions.meetingConflicts)}
      ${renderTaskCompletionPrediction(predictions.taskCompletion)}
      ${renderResourceUtilizationPrediction(predictions.resourceUtilization)}
      ${renderTrendsPrediction(predictions.trends)}
      ${renderRecommendations(predictions.recommendations)}
    </div>
  `;
  
  addActivity(`Predictive analytics generated with ${Math.round(accuracy * 100)}% accuracy`, 'success');
}

function renderWorkloadPrediction(workload) {
  const trendIcon = workload.trend === 'increasing' ? '📈' : workload.trend === 'decreasing' ? '📉' : '➡️';
  const trendClass = workload.trend === 'increasing' ? 'trend-up' : workload.trend === 'decreasing' ? 'trend-down' : 'trend-stable';
  
  return `
    <div class="prediction-card">
      <div class="prediction-header">
        <div class="prediction-title">
          📊 Workload Prediction
        </div>
        <div class="prediction-confidence">${Math.round(workload.data[0]?.confidence * 100 || 90)}% confidence</div>
      </div>
      <div class="prediction-content">
        <div class="prediction-metric">
          <div class="metric-label">Average Workload</div>
          <div class="metric-value">${workload.average}%</div>
          <div class="metric-trend ${trendClass}">
            ${trendIcon} ${workload.trend}
          </div>
        </div>
        <div class="prediction-metric">
          <div class="metric-label">Peak Workload</div>
          <div class="metric-value">${workload.peak}%</div>
          <div class="metric-trend">Peak day</div>
        </div>
        <div class="prediction-metric">
          <div class="metric-label">Days Analyzed</div>
          <div class="metric-value">${workload.data.length}</div>
          <div class="metric-trend">Next ${workload.data.length} days</div>
        </div>
      </div>
    </div>
  `;
}

function renderProductivityPrediction(productivity) {
  const trendIcon = productivity.trend === 'increasing' ? '📈' : productivity.trend === 'decreasing' ? '📉' : '➡️';
  const trendClass = productivity.trend === 'increasing' ? 'trend-up' : productivity.trend === 'decreasing' ? 'trend-down' : 'trend-stable';
  
  return `
    <div class="prediction-card">
      <div class="prediction-header">
        <div class="prediction-title">
          🚀 Productivity Prediction
        </div>
        <div class="prediction-confidence">High confidence</div>
      </div>
      <div class="prediction-content">
        <div class="prediction-metric">
          <div class="metric-label">Average Productivity</div>
          <div class="metric-value">${productivity.average}%</div>
          <div class="metric-trend ${trendClass}">
            ${trendIcon} ${productivity.trend}
          </div>
        </div>
        <div class="prediction-metric">
          <div class="metric-label">Focus Time</div>
          <div class="metric-value">${Math.round(productivity.data.reduce((sum, d) => sum + d.factors.focusTime, 0) / productivity.data.length)}%</div>
          <div class="metric-trend">Daily average</div>
        </div>
        <div class="prediction-metric">
          <div class="metric-label">Meeting Load</div>
          <div class="metric-value">${Math.round(productivity.data.reduce((sum, d) => sum + d.factors.meetings, 0) / productivity.data.length)}</div>
          <div class="metric-trend">Meetings per day</div>
        </div>
      </div>
      <div class="prediction-chart">
        📊 Productivity trend chart would be displayed here
      </div>
    </div>
  `;
}

function renderMeetingConflictsPrediction(conflicts) {
  return `
    <div class="prediction-card">
      <div class="prediction-header">
        <div class="prediction-title">
          ⚠️ Meeting Conflicts Prediction
        </div>
        <div class="prediction-confidence">${conflicts.highRiskDays > 0 ? 'High risk' : 'Low risk'}</div>
      </div>
      <div class="prediction-content">
        <div class="prediction-metric">
          <div class="metric-label">Total Conflicts</div>
          <div class="metric-value">${conflicts.totalConflicts}</div>
          <div class="metric-trend">Next period</div>
        </div>
        <div class="prediction-metric">
          <div class="metric-label">High Risk Days</div>
          <div class="metric-value">${conflicts.highRiskDays}</div>
          <div class="metric-trend">Days with >30% risk</div>
        </div>
        <div class="prediction-metric">
          <div class="metric-label">Risk Level</div>
          <div class="metric-value">${conflicts.highRiskDays > 2 ? 'High' : conflicts.highRiskDays > 0 ? 'Medium' : 'Low'}</div>
          <div class="metric-trend">Overall assessment</div>
        </div>
      </div>
      <div class="recommendations-list">
        ${conflicts.recommendations.map(rec => `
          <div class="recommendation-item">
            <div class="recommendation-content">
              <div class="recommendation-title">${rec}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderTaskCompletionPrediction(tasks) {
  return `
    <div class="prediction-card">
      <div class="prediction-header">
        <div class="prediction-title">
          ✅ Task Completion Prediction
        </div>
        <div class="prediction-confidence">${tasks.riskTasks > 0 ? 'Some risks' : 'Good outlook'}</div>
      </div>
      <div class="prediction-content">
        <div class="prediction-metric">
          <div class="metric-label">Total Tasks</div>
          <div class="metric-value">${tasks.totalTasks}</div>
          <div class="metric-trend">Next period</div>
        </div>
        <div class="prediction-metric">
          <div class="metric-label">Completion Rate</div>
          <div class="metric-value">${tasks.avgCompletionRate}%</div>
          <div class="metric-trend">Expected average</div>
        </div>
        <div class="prediction-metric">
          <div class="metric-label">Risk Tasks</div>
          <div class="metric-value">${tasks.riskTasks}</div>
          <div class="metric-trend">Tasks <70% probability</div>
        </div>
      </div>
      <div class="recommendations-list">
        ${tasks.insights.map(insight => `
          <div class="recommendation-item">
            <div class="recommendation-content">
              <div class="recommendation-title">💡 ${insight}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderResourceUtilizationPrediction(resources) {
  const criticalAlerts = resources.alerts.filter(alert => alert.level === 'critical').length;
  const warningAlerts = resources.alerts.filter(alert => alert.level === 'warning').length;
  
  return `
    <div class="prediction-card">
      <div class="prediction-header">
        <div class="prediction-title">
          💻 Resource Utilization Prediction
        </div>
        <div class="prediction-confidence">${criticalAlerts > 0 ? 'Critical alerts' : warningAlerts > 0 ? 'Warnings' : 'Normal'}</div>
      </div>
      <div class="prediction-content">
        <div class="prediction-metric">
          <div class="metric-label">CPU Usage</div>
          <div class="metric-value">${Math.round(resources.data.cpu.reduce((sum, d) => sum + d.usage, 0) / resources.data.cpu.length)}%</div>
          <div class="metric-trend">Average</div>
        </div>
        <div class="prediction-metric">
          <div class="metric-label">Memory Usage</div>
          <div class="metric-value">${Math.round(resources.data.memory.reduce((sum, d) => sum + d.usage, 0) / resources.data.memory.length)}%</div>
          <div class="metric-trend">Average</div>
        </div>
        <div class="prediction-metric">
          <div class="metric-label">Storage Usage</div>
          <div class="metric-value">${Math.round(resources.data.storage.reduce((sum, d) => sum + d.usage, 0) / resources.data.storage.length)}%</div>
          <div class="metric-trend">Average</div>
        </div>
      </div>
      ${resources.alerts.length > 0 ? `
        <div class="recommendations-list">
          <h5>⚠️ Alerts</h5>
          ${resources.alerts.map(alert => `
            <div class="recommendation-item">
              <div class="recommendation-content">
                <div class="recommendation-title">${alert.message}</div>
                <div class="recommendation-description">${alert.action}</div>
              </div>
              <div class="recommendation-priority priority-${alert.level}">${alert.level}</div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

function renderTrendsPrediction(trends) {
  return `
    <div class="prediction-card">
      <div class="prediction-header">
        <div class="prediction-title">
          📈 Trend Analysis
        </div>
        <div class="prediction-confidence">Multi-factor analysis</div>
      </div>
      <div class="prediction-content">
        ${Object.entries(trends).map(([key, trend]) => {
          const trendIcon = trend.direction === 'increasing' ? '📈' : trend.direction === 'decreasing' ? '📉' : '➡️';
          const trendClass = trend.direction === 'increasing' ? 'trend-up' : trend.direction === 'decreasing' ? 'trend-down' : 'trend-stable';
          const label = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
          
          return `
            <div class="prediction-metric">
              <div class="metric-label">${label}</div>
              <div class="metric-value">${trend.rate}%</div>
              <div class="metric-trend ${trendClass}">
                ${trendIcon} ${trend.direction}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderRecommendations(recommendations) {
  return `
    <div class="prediction-card">
      <div class="prediction-header">
        <div class="prediction-title">
          💡 AI Recommendations
        </div>
        <div class="prediction-confidence">Prioritized by impact</div>
      </div>
      <div class="recommendations-list">
        ${recommendations.map(rec => `
          <div class="recommendation-item">
            <div class="recommendation-content">
              <div class="recommendation-title">${rec.title}</div>
              <div class="recommendation-description">${rec.description}</div>
              <div class="recommendation-meta">
                <span>Impact: ${rec.impact}</span>
                <span>Effort: ${rec.effort}</span>
                <span>Timeline: ${rec.timeline}</span>
              </div>
            </div>
            <div class="recommendation-priority priority-${rec.priority}">${rec.priority}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// AI Insights functionality
function initializeAIInsights() {
  const refreshBtn = document.getElementById('refresh-insights');
  
  if (!refreshBtn) return;
  
  refreshBtn.addEventListener('click', () => {
    refreshAIInsights();
  });
  
  // Auto-refresh insights every 5 minutes
  setInterval(refreshAIInsights, 5 * 60 * 1000);
}

function refreshAIInsights() {
  const insightsGrid = document.querySelector('.insights-grid');
  if (!insightsGrid) return;
  
  // Add loading animation
  insightsGrid.style.opacity = '0.7';
  
  setTimeout(() => {
    // Generate new insights
    const newInsights = generateAIInsights();
    updateInsightsDisplay(insightsGrid, newInsights);
    insightsGrid.style.opacity = '1';
    
    addActivity('AI insights refreshed', 'success');
  }, 1000);
}

function generateAIInsights() {
  const insights = [
    {
      icon: '📊',
      title: 'Productivity Trend',
      description: `Your productivity has ${Math.random() > 0.5 ? 'increased' : 'decreased'} by ${Math.floor(Math.random() * 20 + 5)}% this week compared to last week.`,
      trend: Math.random() > 0.5 ? 'positive' : 'negative',
      value: `${Math.random() > 0.5 ? '↗️' : '↘️'} ${Math.floor(Math.random() * 20 + 5)}%`
    },
    {
      icon: '⏰',
      title: 'Optimal Work Hours',
      description: `You're most productive between ${Math.floor(Math.random() * 3 + 9)} AM - ${Math.floor(Math.random() * 3 + 12)} PM and ${Math.floor(Math.random() * 3 + 2)} PM - ${Math.floor(Math.random() * 3 + 5)} PM.`,
      trend: 'neutral',
      value: '📈 Peak times'
    },
    {
      icon: '🎯',
      title: 'Focus Score',
      description: `Your focus score is ${Math.floor(Math.random() * 20 + 80)}% - ${Math.random() > 0.5 ? 'excellent' : 'good'} concentration levels maintained.`,
      trend: 'positive',
      value: `🎯 ${Math.floor(Math.random() * 20 + 80)}%`
    },
    {
      icon: '💡',
      title: 'AI Recommendation',
      description: getRandomRecommendation(),
      trend: 'neutral',
      value: '💡 Suggestion'
    }
  ];
  
  return insights;
}

function getRandomRecommendation() {
  const recommendations = [
    'Consider scheduling important tasks during your peak productivity hours.',
    'Take a 5-minute break every hour to maintain focus and energy.',
    'Batch similar tasks together to improve efficiency.',
    'Reduce meeting duration by 15 minutes to allow for buffer time.',
    'Use the Pomodoro technique for better time management.',
    'Schedule deep work sessions during your most productive hours.',
    'Consider using the Document Processor for faster content analysis.',
    'Enable AI meeting optimization for better scheduling outcomes.'
  ];
  
  return recommendations[Math.floor(Math.random() * recommendations.length)];
}

function updateInsightsDisplay(container, insights) {
  container.innerHTML = insights.map(insight => `
    <div class="insight-card">
      <div class="insight-icon">${insight.icon}</div>
      <div class="insight-content">
        <h4>${insight.title}</h4>
        <p>${insight.description}</p>
        <div class="insight-trend ${insight.trend}">${insight.value}</div>
      </div>
    </div>
  `).join('');
}

// Clear Activity Button functionality
function initializeClearActivity() {
  const clearActivityBtn = document.getElementById('clear-activity');
  if (clearActivityBtn) {
    clearActivityBtn.addEventListener('click', () => {
      state.activities = [];
      const activityList = document.querySelector('[data-hook="activity-list"]');
      if (activityList) {
        activityList.innerHTML = '<li class="activity-item muted">No recent activity.</li>';
      }
      showToast('Activity feed cleared', 'info');
    });
  }
}

// Attendance Analyzer Modal
function showAttendanceAnalyzerModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 900px;">
      <div class="modal-header">
        <h3>📊 Attendance Analyzer</h3>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <div class="attendance-analyzer-container">
          <div class="analysis-tabs">
            <button class="tab-btn active" data-tab="daily">📅 Daily Analysis</button>
            <button class="tab-btn" data-tab="weekly">📊 Weekly Analysis</button>
            <button class="tab-btn" data-tab="monthly">📈 Monthly Analysis</button>
            <button class="tab-btn" data-tab="patterns">🔍 Pattern Recognition</button>
          </div>
          
          <div class="tab-content active" id="daily-tab">
            <div class="analysis-section">
              <h4>Today's Attendance Overview</h4>
              <div class="attendance-stats">
                <div class="stat-card">
                  <div class="stat-icon">⏰</div>
                  <div class="stat-content">
                    <h5>Punch In Time</h5>
                    <p class="stat-value">09:15 AM</p>
                    <small class="stat-label">On time</small>
                  </div>
                </div>
                <div class="stat-card">
                  <div class="stat-icon">🚪</div>
                  <div class="stat-content">
                    <h5>Punch Out Time</h5>
                    <p class="stat-value">06:30 PM</p>
                    <small class="stat-label">+30 min overtime</small>
                  </div>
                </div>
                <div class="stat-card">
                  <div class="stat-icon">⏱️</div>
                  <div class="stat-content">
                    <h5>Total Hours</h5>
                    <p class="stat-value">9h 15m</p>
                    <small class="stat-label">Productive time</small>
                  </div>
                </div>
                <div class="stat-card">
                  <div class="stat-icon">📈</div>
                  <div class="stat-content">
                    <h5>Productivity Score</h5>
                    <p class="stat-value">87%</p>
                    <small class="stat-label">Above average</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="tab-content" id="weekly-tab">
            <div class="analysis-section">
              <h4>Weekly Attendance Summary</h4>
              <div class="weekly-chart">
                <div class="chart-container">
                  <div class="chart-bars">
                    <div class="bar-group">
                      <div class="bar" style="height: 85%"></div>
                      <span class="bar-label">Mon</span>
                    </div>
                    <div class="bar-group">
                      <div class="bar" style="height: 92%"></div>
                      <span class="bar-label">Tue</span>
                    </div>
                    <div class="bar-group">
                      <div class="bar" style="height: 78%"></div>
                      <span class="bar-label">Wed</span>
                    </div>
                    <div class="bar-group">
                      <div class="bar" style="height: 95%"></div>
                      <span class="bar-label">Thu</span>
                    </div>
                    <div class="bar-group">
                      <div class="bar" style="height: 88%"></div>
                      <span class="bar-label">Fri</span>
                    </div>
                  </div>
                </div>
                <div class="weekly-summary">
                  <div class="summary-item">
                    <span class="label">Average Attendance:</span>
                    <span class="value">87.6%</span>
                  </div>
                  <div class="summary-item">
                    <span class="label">Total Hours:</span>
                    <span class="value">42h 30m</span>
                  </div>
                  <div class="summary-item">
                    <span class="label">Overtime:</span>
                    <span class="value">2h 30m</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="tab-content" id="monthly-tab">
            <div class="analysis-section">
              <h4>Monthly Attendance Trends</h4>
              <div class="monthly-insights">
                <div class="insight-card">
                  <div class="insight-icon">📊</div>
                  <div class="insight-content">
                    <h5>Attendance Rate</h5>
                    <p>94.2% this month</p>
                    <div class="trend positive">↗️ +2.1% vs last month</div>
                  </div>
                </div>
                <div class="insight-card">
                  <div class="insight-icon">⏰</div>
                  <div class="insight-content">
                    <h5>Punctuality</h5>
                    <p>89% on-time arrivals</p>
                    <div class="trend neutral">→ Consistent</div>
                  </div>
                </div>
                <div class="insight-card">
                  <div class="insight-icon">🎯</div>
                  <div class="insight-content">
                    <h5>Productivity Correlation</h5>
                    <p>Strong positive correlation</p>
                    <div class="trend positive">📈 0.78 correlation</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="tab-content" id="patterns-tab">
            <div class="analysis-section">
              <h4>AI Pattern Recognition</h4>
              <div class="pattern-insights">
                <div class="pattern-item">
                  <div class="pattern-icon">🌅</div>
                  <div class="pattern-content">
                    <h5>Peak Performance Hours</h5>
                    <p>You're most productive between 10:00 AM - 12:00 PM and 2:00 PM - 4:00 PM</p>
                  </div>
                </div>
                <div class="pattern-item">
                  <div class="pattern-icon">📅</div>
                  <div class="pattern-content">
                    <h5>Best Attendance Days</h5>
                    <p>Tuesday and Thursday show consistently high attendance and productivity</p>
                  </div>
                </div>
                <div class="pattern-item">
                  <div class="pattern-icon">⚠️</div>
                  <div class="pattern-content">
                    <h5>Risk Factors</h5>
                    <p>Monday mornings and Friday afternoons show lower productivity patterns</p>
                  </div>
                </div>
                <div class="pattern-item">
                  <div class="pattern-icon">💡</div>
                  <div class="pattern-content">
                    <h5>Recommendations</h5>
                    <p>Consider flexible start times on Mondays and shorter Fridays to optimize performance</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="modal-actions">
            <button class="btn primary" id="export-attendance">📤 Export Report</button>
            <button class="btn secondary" id="refresh-analysis">🔄 Refresh Analysis</button>
            <button class="btn ghost modal-close">Close</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Add styles
  const styles = document.createElement('style');
  styles.textContent = `
    .attendance-analyzer-container {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    
    .analysis-tabs {
      display: flex;
      gap: 10px;
      border-bottom: 1px solid #e0e0e0;
      margin-bottom: 20px;
    }
    
    .tab-btn {
      padding: 10px 20px;
      border: none;
      background: transparent;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      transition: all 0.3s ease;
    }
    
    .tab-btn.active {
      border-bottom-color: #667eea;
      color: #667eea;
      font-weight: 600;
    }
    
    .tab-content {
      display: none;
    }
    
    .tab-content.active {
      display: block;
    }
    
    .attendance-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 20px;
    }
    
    .stat-card {
      display: flex;
      align-items: center;
      gap: 15px;
      padding: 20px;
      background: #f8f9fa;
      border-radius: 8px;
      border: 1px solid #e9ecef;
    }
    
    .stat-icon {
      font-size: 24px;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #667eea;
      color: white;
      border-radius: 50%;
    }
    
    .stat-content h5 {
      margin: 0 0 5px 0;
      font-size: 14px;
      color: #666;
    }
    
    .stat-value {
      margin: 0 0 5px 0;
      font-size: 20px;
      font-weight: 600;
      color: #333;
    }
    
    .stat-label {
      margin: 0;
      font-size: 12px;
      color: #28a745;
    }
    
    .weekly-chart {
      display: flex;
      gap: 30px;
      align-items: end;
    }
    
    .chart-container {
      flex: 1;
    }
    
    .chart-bars {
      display: flex;
      gap: 20px;
      align-items: end;
      height: 200px;
      padding: 20px 0;
    }
    
    .bar-group {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
    }
    
    .bar {
      width: 40px;
      background: linear-gradient(to top, #667eea, #764ba2);
      border-radius: 4px 4px 0 0;
      min-height: 20px;
    }
    
    .bar-label {
      font-size: 12px;
      color: #666;
    }
    
    .weekly-summary {
      display: flex;
      flex-direction: column;
      gap: 15px;
      min-width: 200px;
    }
    
    .summary-item {
      display: flex;
      justify-content: space-between;
      padding: 10px;
      background: #f8f9fa;
      border-radius: 6px;
    }
    
    .summary-item .label {
      color: #666;
    }
    
    .summary-item .value {
      font-weight: 600;
      color: #333;
    }
    
    .monthly-insights {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
    }
    
    .insight-card {
      display: flex;
      align-items: center;
      gap: 15px;
      padding: 20px;
      background: #f8f9fa;
      border-radius: 8px;
      border: 1px solid #e9ecef;
    }
    
    .insight-icon {
      font-size: 24px;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #667eea;
      color: white;
      border-radius: 50%;
    }
    
    .insight-content h5 {
      margin: 0 0 5px 0;
      font-size: 16px;
      color: #333;
    }
    
    .insight-content p {
      margin: 0 0 8px 0;
      color: #666;
    }
    
    .trend {
      font-size: 12px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 12px;
    }
    
    .trend.positive {
      background: #d4edda;
      color: #155724;
    }
    
    .trend.neutral {
      background: #e2e3e5;
      color: #6c757d;
    }
    
    .pattern-insights {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    
    .pattern-item {
      display: flex;
      align-items: flex-start;
      gap: 15px;
      padding: 20px;
      background: #f8f9fa;
      border-radius: 8px;
      border: 1px solid #e9ecef;
    }
    
    .pattern-icon {
      font-size: 24px;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #667eea;
      color: white;
      border-radius: 50%;
      flex-shrink: 0;
    }
    
    .pattern-content h5 {
      margin: 0 0 8px 0;
      font-size: 16px;
      color: #333;
    }
    
    .pattern-content p {
      margin: 0;
      color: #666;
      line-height: 1.5;
    }
    
    .modal-actions {
      display: flex;
      gap: 10px;
      justify-content: center;
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid #e0e0e0;
    }
  `;
  document.head.appendChild(styles);
  
  // Event listeners
  const tabBtns = modal.querySelectorAll('.tab-btn');
  const tabContents = modal.querySelectorAll('.tab-content');
  
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;
      
      // Update active tab
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      btn.classList.add('active');
      modal.querySelector(`#${tabName}-tab`).classList.add('active');
    });
  });
  
  modal.querySelectorAll('.modal-close').forEach(b => b.addEventListener('click', () => modal.remove()));
}
