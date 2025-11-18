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

// Import services
const DocumentProcessor = require('./services/DocumentProcessor');
const PredictiveAnalytics = require('./services/PredictiveAnalytics');
const SmartMeetingAssistant = require('./services/SmartMeetingAssistant');

// Initialize services
const documentProcessor = new DocumentProcessor(null, io);
const predictiveAnalytics = new PredictiveAnalytics(null, io);
const smartMeetingAssistant = new SmartMeetingAssistant(null, io);

// Simple chatbot responses
const getChatbotResponse = (message) => {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('hi') || lowerMessage.includes('hello')) {
    return 'Hello! 👋 I\'m your AI assistant for the Multi-Agent Office system. I can help you with agent configuration, integrations, troubleshooting, and general questions. What would you like to know?';
  }
  if (lowerMessage.includes('help')) {
    return '🆘 I can help you with: 1) Agent configuration and usage, 2) Integration setup, 3) Troubleshooting issues, 4) Understanding analytics, 5) System features. What specific area would you like help with?';
  }
  if (lowerMessage.includes('meeting') || lowerMessage.includes('schedule')) {
    return '📅 To schedule a meeting, click on the Meeting Agent card and select \'Run\'. This opens the calendar interface where you can add meetings, view conflicts, and manage your schedule.';
  }
  if (lowerMessage.includes('calendar') || lowerMessage.includes('google')) {
    return '📅 To connect Google Calendar: 1) Go to Settings > Integrations, 2) Find Google Calendar and click Connect, 3) Authorize the app in Google, 4) Your calendar will sync automatically every 15 minutes.';
  }
  if (lowerMessage.includes('agent')) {
    return '🤖 The Multi-Agent Office system uses intelligent agents to automate office tasks: Meeting Agent for scheduling, Mail Summarizer for email processing, Task Router for task management, and Report Generator for analytics.';
  }
  
  return 'I\'m here to help with your Multi-Agent Office system! 😊 I can assist with agent configuration, integration setup, troubleshooting, and general questions. Try asking me about specific agents, integrations, or how to get started. What would you like to know?';
};

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
  const response = getChatbotResponse(message);
  
  res.json({
    conversationId: 'demo-conversation',
    response: response,
    timestamp: new Date()
  });
});

// Document processing routes
app.post('/api/documents/process', async (req, res) => {
  try {
    const { content, name } = req.body;
    const documentData = {
      name: name || 'Text Document',
      content: content,
      uploadedAt: new Date()
    };

    const result = await documentProcessor.processDocument('demo-user', documentData);
    
    res.json({
      message: 'Document processing completed',
      processingId: result.processingId,
      results: result.results,
      status: result.status
    });
  } catch (error) {
    console.error('Document processing error:', error);
    res.status(500).json({ error: 'Failed to process document' });
  }
});

app.get('/api/documents/status', (req, res) => {
  const status = documentProcessor.getStatus();
  res.json({ status });
});

app.get('/api/documents/user', async (req, res) => {
  const documents = await documentProcessor.getUserDocuments('demo-user');
  res.json({ documents });
});

// Predictive Analytics routes
app.post('/api/analytics/predictions', async (req, res) => {
  try {
    const { timeRange = '7d' } = req.body;
    const result = await predictiveAnalytics.generatePredictions('demo-user', timeRange);
    res.json(result);
  } catch (error) {
    console.error('Prediction generation error:', error);
    res.status(500).json({ error: 'Failed to generate predictions' });
  }
});

app.get('/api/analytics/status', (req, res) => {
  const status = predictiveAnalytics.getStatus();
  res.json({ status });
});

// Smart Meeting Assistant routes
app.post('/api/meetings/schedule', async (req, res) => {
  try {
    const meetingData = req.body;
    const result = await smartMeetingAssistant.scheduleMeeting('demo-user', meetingData);
    res.json(result);
  } catch (error) {
    console.error('Meeting scheduling error:', error);
    res.status(500).json({ error: 'Failed to schedule meeting' });
  }
});

app.post('/api/meetings/:meetingId/notes', async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { notes } = req.body;
    const result = await smartMeetingAssistant.processMeetingNotes(meetingId, notes);
    res.json(result);
  } catch (error) {
    console.error('Meeting notes processing error:', error);
    res.status(500).json({ error: 'Failed to process meeting notes' });
  }
});

app.get('/api/meetings/user', async (req, res) => {
  const meetings = await smartMeetingAssistant.getUserMeetings('demo-user');
  res.json({ meetings });
});

app.get('/api/meetings/status', (req, res) => {
  const status = smartMeetingAssistant.getStatus();
  res.json({ status });
});

// WebSocket handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('chatbot-message', (data) => {
    const response = getChatbotResponse(data.message);
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

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`🚀 Multi-Agent Office Backend running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔌 WebSocket server ready for connections`);
  console.log(`🤖 AI Chatbot ready for conversations`);
  console.log(`🌐 Open: http://localhost:${PORT}`);
});

module.exports = { app, server, io };
