const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Mock chatbot service
class SimpleChatbot {
  constructor() {
    this.responses = {
      'hi': 'Hello! 👋 I\'m your AI assistant for the Multi-Agent Office system. I can help you with agent configuration, integrations, troubleshooting, and general questions. What would you like to know?',
      'hello': 'Hello! 👋 I\'m your AI assistant for the Multi-Agent Office system. I can help you with agent configuration, integrations, troubleshooting, and general questions. What would you like to know?',
      'help': '🆘 I can help you with: 1) Agent configuration and usage, 2) Integration setup, 3) Troubleshooting issues, 4) Understanding analytics, 5) System features. What specific area would you like help with?',
      'meeting': '📅 To schedule a meeting, click on the Meeting Agent card and select \'Run\'. This opens the calendar interface where you can add meetings, view conflicts, and manage your schedule.',
      'calendar': '📅 To connect Google Calendar: 1) Go to Settings > Integrations, 2) Find Google Calendar and click Connect, 3) Authorize the app in Google, 4) Your calendar will sync automatically every 15 minutes.',
      'agent': '🤖 The Multi-Agent Office system uses intelligent agents to automate office tasks: Meeting Agent for scheduling, Mail Summarizer for email processing, Task Router for task management, and Report Generator for analytics.',
      'default': 'I\'m here to help with your Multi-Agent Office system! 😊 I can assist with agent configuration, integration setup, troubleshooting, and general questions. Try asking me about specific agents, integrations, or how to get started. What would you like to know?'
    };
  }

  getResponse(message) {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('hi') || lowerMessage.includes('hello')) {
      return this.responses.hi;
    }
    if (lowerMessage.includes('help')) {
      return this.responses.help;
    }
    if (lowerMessage.includes('meeting') || lowerMessage.includes('schedule')) {
      return this.responses.meeting;
    }
    if (lowerMessage.includes('calendar') || lowerMessage.includes('google')) {
      return this.responses.calendar;
    }
    if (lowerMessage.includes('agent')) {
      return this.responses.agent;
    }
    
    return this.responses.default;
  }
}

const chatbot = new SimpleChatbot();

// Routes
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    services: {
      chatbot: 'ready',
      websocket: 'connected'
    }
  });
});

app.post('/api/chatbot/message', (req, res) => {
  const { message } = req.body;
  const response = chatbot.getResponse(message);
  
  res.json({
    conversationId: 'demo-conversation',
    response: response,
    timestamp: new Date()
  });
});

// WebSocket handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('chatbot-message', (data) => {
    const response = chatbot.getResponse(data.message);
    socket.emit('chatbot-response', {
      conversationId: 'demo-conversation',
      response: response,
      timestamp: new Date()
    });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Multi-Agent Office Backend running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔌 WebSocket server ready for connections`);
  console.log(`🤖 AI Chatbot ready for conversations`);
  console.log(`🌐 Open: http://localhost:${PORT}`);
});

module.exports = { app, server, io };
