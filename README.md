# 🚀 Multi-Agent Office Automation Backend

A sophisticated, AI-powered backend system for intelligent office automation with multi-agent coordination, real-time analytics, and seamless integrations.

## 🎯 Features

### 🤖 **AI-Powered Agent Orchestration**
- **Meeting Agent**: Intelligent calendar management and conflict resolution
- **Mail Summarizer**: Advanced email processing with NLP and sentiment analysis
- **Report Generator**: Automated report creation with customizable templates
- **Task Router**: Smart task assignment based on availability and skills
- **Real-time Coordination**: Agents communicate and resolve conflicts automatically

### 🔗 **Advanced Integration Hub**
- **Google Calendar & Gmail**: Full OAuth2 integration with real-time sync
- **Microsoft Outlook & Teams**: Seamless Microsoft ecosystem integration
- **Slack**: Team communication and notification delivery
- **Notion**: Project management and database synchronization
- **Webhook Support**: Real-time updates from external systems

### 📊 **Intelligent Analytics Engine**
- **User Behavior Analytics**: Comprehensive productivity metrics
- **Agent Performance Tracking**: ML-optimized agent performance
- **Predictive Analytics**: Workload forecasting and optimization
- **Real-time Dashboards**: Live system monitoring and insights

### 🔒 **Enterprise-Grade Security**
- **End-to-End Encryption**: AES-256 encryption for sensitive data
- **Role-Based Access Control**: Granular permissions system
- **JWT Authentication**: Secure token-based authentication
- **Rate Limiting**: Advanced DDoS protection
- **Audit Logging**: Comprehensive security event tracking

### ⚡ **Real-time Communication**
- **WebSocket Support**: Live updates and notifications
- **Push Notifications**: Multi-channel notification delivery
- **Real-time Collaboration**: Live agent status monitoring
- **Event Streaming**: Real-time data synchronization

### 🤖 **AI-Powered Chatbot**
- **Google Gemini Integration**: Advanced AI responses with free API
- **Context-Aware**: Understands your office automation system
- **Real-time Chat**: Instant help with agents and integrations
- **Smart Fallbacks**: Works even without API keys

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Gateway   │    │   Load Balancer │
│   (React/Vue)   │◄──►│   (Express)     │◄──►│   (Nginx)       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Agent           │    │ Integration     │    │ Analytics       │
│ Orchestrator    │◄──►│ Hub             │◄──►│ Engine          │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ PostgreSQL      │    │ Redis Cache     │    │ File Storage    │
│ Database        │◄──►│ & Sessions      │◄──►│ (S3/Local)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- PostgreSQL 15+
- Redis 7+ (optional)
- Docker & Docker Compose (recommended)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/your-username/multiagent-office-backend.git
cd multiagent-office-backend
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp env.example .env
# Edit .env with your configuration
```

4. **Set up database**
```bash
# Using Docker (recommended)
docker-compose up -d postgres redis

# Or manually
createdb multiagent_office
npm run db:migrate
npm run db:seed
```

5. **Set up AI Chatbot (Optional)**
```bash
# Run the Gemini API setup script
npm run setup-gemini

# This will guide you through getting a free Google Gemini API key
# The chatbot works without it, but with limited responses
```

6. **Start the server**
```bash
# Development
npm run dev

# Production
npm start
```

### Docker Deployment

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f backend

# Stop services
docker-compose down
```

## 📚 API Documentation

### Authentication
```bash
# Register
POST /api/auth/register
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe"
}

# Login
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

### Agents
```bash
# Get all agents
GET /api/agents
Authorization: Bearer <token>

# Run agent
POST /api/agents/{agentId}/run
{
  "params": {
    "priority": "high",
    "timeRange": "7d"
  }
}

# Update agent settings
PUT /api/agents/{agentId}/settings
{
  "settings": {
    "autoResolveConflicts": true,
    "bufferTime": 15
  },
  "autoRunEnabled": true,
  "autoRunInterval": 30
}
```

### Integrations
```bash
# Connect integration
POST /api/integrations/{serviceName}/connect
{
  "authCode": "oauth_auth_code",
  "settings": {}
}

# Sync integration
POST /api/integrations/{serviceName}/sync

# Get integration status
GET /api/integrations/{serviceName}
```

### Analytics
```bash
# Get user analytics
GET /api/analytics/user?timeRange=7d

# Track custom event
POST /api/analytics/track
{
  "eventType": "page_view",
  "eventData": {
    "page": "dashboard",
    "duration": 120
  }
}

# Get dashboard data
GET /api/analytics/dashboard
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Server port | `5000` |
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `JWT_SECRET` | JWT signing secret | Required |
| `REDIS_URL` | Redis connection string | Optional |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | Optional |
| `SMTP_HOST` | Email server host | Optional |

### Agent Configuration

Each agent can be configured with custom settings:

```javascript
// Meeting Agent
{
  "autoResolveConflicts": true,
  "bufferTime": 15,
  "maxConcurrentMeetings": 3
}

// Mail Summarizer
{
  "maxSummaryLength": 500,
  "includeSentiment": true,
  "extractActionItems": true
}

// Task Router
{
  "slaHours": 24,
  "autoEscalate": true,
  "skillMatching": true
}
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test suite
npm test -- --grep "agents"

# Watch mode
npm run test:watch
```

## 📊 Monitoring

### Health Checks
```bash
# System health
GET /api/health

# Agent status
GET /api/agents/status

# Integration status
GET /api/integrations/status
```

### Metrics
- **Prometheus Metrics**: Available at `/metrics`
- **Custom Dashboards**: Real-time analytics API
- **Log Aggregation**: Structured JSON logging
- **Error Tracking**: Comprehensive error reporting

## 🔒 Security

### Authentication & Authorization
- JWT-based authentication with refresh tokens
- Role-based access control (RBAC)
- Rate limiting and DDoS protection
- Secure password hashing with bcrypt

### Data Protection
- AES-256 encryption for sensitive data
- SQL injection prevention
- XSS protection
- CORS configuration
- Security headers with Helmet.js

### Compliance
- GDPR compliance features
- Data retention policies
- Audit logging
- Privacy controls

## 🚀 Deployment

### Production Deployment

1. **Environment Setup**
```bash
# Set production environment
export NODE_ENV=production

# Configure SSL certificates
# Set up load balancer
# Configure monitoring
```

2. **Database Migration**
```bash
npm run db:migrate
```

3. **Start Services**
```bash
# Using PM2
pm2 start ecosystem.config.js

# Using Docker
docker-compose -f docker-compose.prod.yml up -d
```

### Scaling

- **Horizontal Scaling**: Multiple backend instances
- **Database Scaling**: Read replicas and connection pooling
- **Caching**: Redis for session and data caching
- **CDN**: Static asset delivery
- **Load Balancing**: Nginx or cloud load balancer

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow ESLint configuration
- Write comprehensive tests
- Update documentation
- Follow semantic versioning

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [Wiki](https://github.com/your-username/multiagent-office-backend/wiki)
- **Issues**: [GitHub Issues](https://github.com/your-username/multiagent-office-backend/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/multiagent-office-backend/discussions)
- **Email**: support@multiagent-office.com

## 🏆 Hackathon Features

This backend is specifically designed to win hackathons with:

- **Advanced AI Integration**: Multi-agent orchestration with ML optimization
- **Real-time Everything**: WebSocket communication and live updates
- **Enterprise Architecture**: Scalable, secure, and production-ready
- **Rich Integrations**: OAuth2 with major platforms
- **Comprehensive Analytics**: Deep insights and predictive capabilities
- **Modern Tech Stack**: Latest technologies and best practices

---

**Built with ❤️ for hackathon success! 🚀**
#   M u l t i - A g e n t - T a s k - C o o r d i n a t i o n - f o r - O f f i c e - A u t o m a t i o n  
 