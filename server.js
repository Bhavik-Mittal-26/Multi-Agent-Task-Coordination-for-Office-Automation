const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
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
const DB_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/multiagent_office';

// Database connection
const db = new Pool({
  connectionString: DB_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

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

// Initialize services
const agentOrchestrator = new AgentOrchestrator(db, io);
const integrationHub = new IntegrationHub(db, io);
const analyticsEngine = new AnalyticsEngine(db);
const notificationService = new NotificationService(io);
const securityService = new SecurityService(db);
const aiChatbot = new AIChatbotService(db, io);

// Authentication middleware
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await db.query('SELECT * FROM users WHERE id = $1', [decoded.userId]);
    
    if (user.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = user.rows[0];
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Routes
app.use('/api/auth', authRoutes(db, JWT_SECRET));
app.use('/api/agents', authenticateToken, agentRoutes(db, agentOrchestrator));
app.use('/api/integrations', authenticateToken, integrationRoutes(db, integrationHub));
app.use('/api/analytics', authenticateToken, analyticsRoutes(db, analyticsEngine));
app.use('/api/users', authenticateToken, userRoutes(db));
app.use('/api/chatbot', authenticateToken, chatbotRoutes(db, aiChatbot));

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        orchestrator: agentOrchestrator.getStatus(),
        integrations: integrationHub.getStatus(),
        analytics: analyticsEngine.getStatus()
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
  await db.end();
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
});

module.exports = { app, server, io, db };
