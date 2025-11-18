const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Import route modules
const authRoutes = require('./routes/auth');
const agentRoutes = require('./routes/agents');
const integrationRoutes = require('./routes/integrations');
const analyticsRoutes = require('./routes/analytics');
const userRoutes = require('./routes/users');
const chatbotRoutes = require('./routes/chatbot');

// Import services
const AgentOrchestrator = require('./services/AgentOrchestrator');
const IntegrationHub = require('./services/IntegrationHub');
const AnalyticsEngine = require('./services/AnalyticsEngine');
const NotificationService = require('./services/NotificationService');
const SecurityService = require('./services/SecurityService');
const AIChatbotService = require('./services/AIChatbotService');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Environment variables
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');

// Mock database for demo purposes
const mockDb = {
  query: async (sql, params) => {
    console.log('Mock DB Query:', sql.substring(0, 100) + '...');
    return { rows: [] };
  }
};

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Initialize services with mock database
const agentOrchestrator = new AgentOrchestrator(mockDb, io);
const integrationHub = new IntegrationHub(mockDb, io);
const analyticsEngine = new AnalyticsEngine(mockDb);
const notificationService = new NotificationService(io);
const securityService = new SecurityService(mockDb);
const aiChatbot = new AIChatbotService(mockDb, io);

// Authentication middleware
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    // For demo purposes, create a mock user
    req.user = { id: 'demo-user-123', email: 'demo@example.com', role: 'user' };
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { id: decoded.userId, email: 'demo@example.com', role: 'user' };
    next();
  } catch (error) {
    // For demo purposes, allow access with mock user
    req.user = { id: 'demo-user-123', email: 'demo@example.com', role: 'user' };
    next();
  }
};

// Routes
app.use('/api/auth', authRoutes(mockDb, JWT_SECRET));
app.use('/api/agents', authenticateToken, agentRoutes(mockDb, agentOrchestrator));
app.use('/api/integrations', authenticateToken, integrationRoutes(mockDb, integrationHub));
app.use('/api/analytics', authenticateToken, analyticsRoutes(mockDb, analyticsEngine));
app.use('/api/users', authenticateToken, userRoutes(mockDb));
app.use('/api/chatbot', authenticateToken, chatbotRoutes(mockDb, aiChatbot));

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    res.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      services: {
        database: 'mock (demo mode)',
        orchestrator: agentOrchestrator.getStatus(),
        integrations: integrationHub.getStatus(),
        analytics: analyticsEngine.getStatus(),
        chatbot: aiChatbot.getStatus()
      }
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'unhealthy', 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Join user to their personal room
  socket.on('join-user-room', (userId) => {
    socket.join(`user-${userId}`);
    console.log(`User ${userId} joined their room`);
  });

  // Handle agent status updates
  socket.on('agent-status-update', async (data) => {
    try {
      await agentOrchestrator.updateAgentStatus(data);
      io.emit('agent-status-changed', data);
    } catch (error) {
      socket.emit('error', { message: 'Failed to update agent status' });
    }
  });

  // Handle real-time notifications
  socket.on('send-notification', async (data) => {
    try {
      await notificationService.sendNotification(data);
    } catch (error) {
      socket.emit('error', { message: 'Failed to send notification' });
    }
  });

  // Handle integration sync requests
  socket.on('sync-integration', async (data) => {
    try {
      await integrationHub.syncIntegration(data.userId, data.integrationType);
    } catch (error) {
      socket.emit('error', { message: 'Failed to sync integration' });
    }
  });

  // Handle chatbot messages
  socket.on('chatbot-message', async (data) => {
    try {
      const result = await aiChatbot.processMessage(data.userId, data.message, data.conversationId);
      socket.emit('chatbot-response', result);
    } catch (error) {
      socket.emit('error', { message: 'Failed to process chatbot message' });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Multi-Agent Office Backend running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔌 WebSocket server ready for connections`);
  console.log(`🤖 AI Chatbot ready for conversations`);
  console.log(`📝 Running in DEMO mode (no database required)`);
});

module.exports = { app, server, io, db: mockDb };
