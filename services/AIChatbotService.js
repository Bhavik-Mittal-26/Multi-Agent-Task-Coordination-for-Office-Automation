const { v4: uuidv4 } = require('uuid');

// Try to import Google Gemini AI, but handle gracefully if not available
let GoogleGenerativeAI;
try {
  GoogleGenerativeAI = require('@google/generative-ai').GoogleGenerativeAI;
} catch (error) {
  console.warn('Google Generative AI package not found. AI chatbot will use fallback responses.');
  GoogleGenerativeAI = null;
}

class AIChatbotService {
  constructor(db, io) {
    this.db = db;
    this.io = io;
    
    // Initialize Google Gemini AI only if available
    if (GoogleGenerativeAI) {
      this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'demo-key');
      this.model = this.genAI.getGenerativeModel({ model: "gemini-pro" });
    } else {
      this.genAI = null;
      this.model = null;
    }
    
    this.conversations = new Map();
    this.knowledgeBase = new Map();
    
    this.initializeKnowledgeBase();
  }

  initializeKnowledgeBase() {
    // Initialize with office automation knowledge
    this.knowledgeBase.set('general', {
      context: `You are an AI assistant for Multi-Agent Office Automation System. 
      You help employees with questions about:
      - Meeting scheduling and calendar management
      - Email summarization and processing
      - Task routing and assignment
      - Report generation
      - Integration with external services (Google Calendar, Slack, etc.)
      - Agent performance and analytics
      - System troubleshooting
      
      Always be helpful, professional, and provide specific actionable advice.`,
      examples: [
        {
          question: "How do I schedule a meeting?",
          answer: "You can schedule meetings using the Meeting Agent. Click on the Meeting Agent card and select 'Run' to open the calendar interface. You can also use the 'Import from Calendar/Email' button to sync with your external calendar."
        },
        {
          question: "Why is my agent not running?",
          answer: "Check the agent status in the Agents panel. Common issues include: 1) Agent is paused - click Resume, 2) No integrations connected - connect your calendar/email, 3) Agent settings need configuration - click Settings gear icon."
        },
        {
          question: "How do I connect Google Calendar?",
          answer: "Go to Settings > Integrations, find Google Calendar, and click Connect. You'll be redirected to Google for OAuth authorization. After connecting, your calendar will sync automatically every 15 minutes."
        }
      ]
    });

    this.knowledgeBase.set('agents', {
      context: `Focus on agent-related questions. Available agents:
      - Meeting Agent: Schedules meetings, resolves conflicts, manages calendar
      - Mail Summarizer: Processes emails, extracts action items, summarizes threads
      - Report Generator: Creates reports in HTML/PDF/CSV formats
      - Task Router: Assigns tasks based on priority and availability`,
      examples: [
        {
          question: "What does the Meeting Agent do?",
          answer: "The Meeting Agent manages your calendar, schedules meetings, detects conflicts, and automatically resolves scheduling issues. It can sync with Google Calendar and Outlook, and suggests optimal meeting times based on participant availability."
        },
        {
          question: "How do I improve agent performance?",
          answer: "Agent performance improves with: 1) Regular feedback via Settings > Feedback, 2) Proper integration setup, 3) Clear task definitions, 4) Regular usage. Check the Analytics panel to monitor performance metrics."
        }
      ]
    });

    this.knowledgeBase.set('integrations', {
      context: `Focus on integration questions. Supported services:
      - Google Calendar & Gmail
      - Microsoft Outlook & Teams
      - Slack
      - Notion`,
      examples: [
        {
          question: "How do I sync my Slack messages?",
          answer: "Go to Settings > Integrations, find Slack, and click Connect. You'll need to authorize the app in your Slack workspace. Once connected, the Mail Summarizer can process Slack messages for action items and summaries."
        }
      ]
    });
  }

  async processMessage(userId, message, conversationId = null) {
    try {
      // Get or create conversation
      if (!conversationId) {
        conversationId = uuidv4();
      }

      let conversation = this.conversations.get(conversationId) || {
        id: conversationId,
        userId,
        messages: [],
        context: 'general',
        createdAt: new Date()
      };

      // Add user message
      conversation.messages.push({
        role: 'user',
        content: message,
        timestamp: new Date()
      });

      // Determine context based on message content
      const context = this.determineContext(message);
      conversation.context = context;

      // Get relevant knowledge
      const knowledge = this.knowledgeBase.get(context);
      
      // Prepare system prompt
      const systemPrompt = this.buildSystemPrompt(knowledge, conversation);

      // Generate response using OpenAI
      const response = await this.generateResponse(systemPrompt, conversation.messages);

      // Add assistant response
      conversation.messages.push({
        role: 'assistant',
        content: response,
        timestamp: new Date()
      });

      // Store conversation
      this.conversations.set(conversationId, conversation);

      // Store in database
      await this.storeConversation(conversation);

      // Send real-time update
      this.io.to(`user-${userId}`).emit('chatbot-response', {
        conversationId,
        message: response,
        timestamp: new Date()
      });

      return {
        conversationId,
        response,
        timestamp: new Date()
      };

    } catch (error) {
      console.error('Chatbot error:', error);
      
      // Fallback response
      const fallbackResponse = this.getFallbackResponse(message);
      
      return {
        conversationId: conversationId || uuidv4(),
        response: fallbackResponse,
        timestamp: new Date(),
        error: true
      };
    }
  }

  determineContext(message) {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('agent') || lowerMessage.includes('meeting agent') || 
        lowerMessage.includes('mail summarizer') || lowerMessage.includes('task router')) {
      return 'agents';
    }
    
    if (lowerMessage.includes('integrate') || lowerMessage.includes('connect') || 
        lowerMessage.includes('google') || lowerMessage.includes('slack') || 
        lowerMessage.includes('calendar') || lowerMessage.includes('outlook')) {
      return 'integrations';
    }
    
    return 'general';
  }

  buildSystemPrompt(knowledge, conversation) {
    let prompt = knowledge.context + '\n\n';
    
    // Add recent conversation context
    if (conversation.messages.length > 2) {
      prompt += 'Recent conversation context:\n';
      const recentMessages = conversation.messages.slice(-4);
      recentMessages.forEach(msg => {
        prompt += `${msg.role}: ${msg.content}\n`;
      });
      prompt += '\n';
    }
    
    // Add examples
    if (knowledge.examples) {
      prompt += 'Example Q&A:\n';
      knowledge.examples.forEach(example => {
        prompt += `Q: ${example.question}\nA: ${example.answer}\n\n`;
      });
    }
    
    prompt += 'Instructions: Provide helpful, specific, and actionable answers. If you need more information, ask clarifying questions. Keep responses concise but informative.';
    
    return prompt;
  }

  async generateResponse(systemPrompt, messages) {
    try {
      // If no Gemini API key or Gemini not available, use rule-based responses
      if (!this.model || !process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'demo-key') {
        return this.getRuleBasedResponse(messages[messages.length - 1].content);
      }

      // Build conversation history for Gemini
      const conversationHistory = messages.slice(-6).map(msg => {
        if (msg.role === 'user') {
          return `User: ${msg.content}`;
        } else {
          return `Assistant: ${msg.content}`;
        }
      }).join('\n');

      const prompt = `${systemPrompt}\n\nConversation History:\n${conversationHistory}\n\nPlease provide a helpful response to the user's latest message.`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text().trim();
    } catch (error) {
      console.error('Gemini API error:', error);
      return this.getRuleBasedResponse(messages[messages.length - 1].content);
    }
  }

  getRuleBasedResponse(message) {
    const lowerMessage = message.toLowerCase();
    
    // Greeting responses
    if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
      return "Hello! 👋 I'm your AI assistant for the Multi-Agent Office system. I can help you with agent configuration, integrations, troubleshooting, and general questions. What would you like to know?";
    }
    
    // Agent-related responses
    if (lowerMessage.includes('meeting agent') || lowerMessage.includes('schedule meeting')) {
      return "📅 To schedule a meeting, click on the Meeting Agent card and select 'Run'. This opens the calendar interface where you can add meetings, view conflicts, and manage your schedule. The agent will automatically detect and resolve scheduling conflicts.";
    }
    
    if (lowerMessage.includes('mail summarizer') || lowerMessage.includes('email')) {
      return "📧 The Mail Summarizer processes your emails and extracts key information like action items, deadlines, and decisions. Click on the Mail Summarizer card and select 'Summarize' to process your emails. You can also connect your Gmail account in Settings > Integrations for automatic processing.";
    }
    
    if (lowerMessage.includes('task router') || lowerMessage.includes('task')) {
      return "📋 The Task Router automatically assigns tasks based on priority, availability, and skills. Click on the Task Router card to view assigned tasks and their status. Tasks are automatically routed to team members and monitored for SLA compliance.";
    }
    
    if (lowerMessage.includes('report generator') || lowerMessage.includes('report')) {
      return "📊 The Report Generator creates comprehensive reports in HTML, PDF, or CSV formats. Click on the Report Generator card and select 'Generate' to create reports based on your current data. You can customize the format and include detailed analytics.";
    }
    
    // Integration-related responses
    if (lowerMessage.includes('connect') || lowerMessage.includes('integrate')) {
      return "🔗 To connect external services, go to Settings > Integrations. Available integrations include Google Calendar, Gmail, Microsoft Outlook, Slack, and Notion. Click 'Connect' next to any service to authorize access.";
    }
    
    if (lowerMessage.includes('google calendar') || lowerMessage.includes('calendar')) {
      return "📅 To connect Google Calendar: 1) Go to Settings > Integrations, 2) Find Google Calendar and click Connect, 3) Authorize the app in Google, 4) Your calendar will sync automatically every 15 minutes. The Meeting Agent will use this data for scheduling.";
    }
    
    if (lowerMessage.includes('slack')) {
      return "💬 To connect Slack: 1) Go to Settings > Integrations, 2) Find Slack and click Connect, 3) Authorize the app in your Slack workspace, 4) The Mail Summarizer can then process Slack messages for action items and summaries.";
    }
    
    // General help responses
    if (lowerMessage.includes('help') || lowerMessage.includes('how to')) {
      return "🆘 I can help you with: 1) Agent configuration and usage, 2) Integration setup, 3) Troubleshooting issues, 4) Understanding analytics, 5) System features. What specific area would you like help with?";
    }
    
    if (lowerMessage.includes('performance') || lowerMessage.includes('analytics')) {
      return "📈 Check your analytics in the Analytics panel. You can view agent performance, productivity metrics, integration status, and conflict resolution rates. The dashboard shows real-time data and trends over different time periods.";
    }
    
    if (lowerMessage.includes('error') || lowerMessage.includes('problem') || lowerMessage.includes('issue')) {
      return "🔧 For troubleshooting: 1) Check agent status in the Agents panel, 2) Verify integrations are connected in Settings, 3) Review recent activities in the Activity Feed, 4) Check system health in Settings > Monitoring. What specific issue are you experiencing?";
    }
    
    // Fun responses for general questions
    if (lowerMessage.includes('what') && lowerMessage.includes('you')) {
      return "I'm an AI assistant designed to help you navigate the Multi-Agent Office system! 🤖 I can assist with agent management, integration setup, troubleshooting, and answering questions about the platform's features.";
    }
    
    if (lowerMessage.includes('who') && lowerMessage.includes('you')) {
      return "I'm your AI assistant for the Multi-Agent Office platform! 👋 I'm here to help you make the most of your office automation tools and agents.";
    }
    
    if (lowerMessage.includes('how') && lowerMessage.includes('work')) {
      return "The Multi-Agent Office system uses intelligent agents to automate office tasks: Meeting Agent for scheduling, Mail Summarizer for email processing, Task Router for task management, and Report Generator for analytics. Each agent can be configured and monitored through the dashboard.";
    }
    
    // Default response with more personality
    return "I'm here to help with your Multi-Agent Office system! 😊 I can assist with agent configuration, integration setup, troubleshooting, and general questions. Try asking me about specific agents, integrations, or how to get started. What would you like to know?";
  }

  getFallbackResponse(message) {
    return "I'm experiencing some technical difficulties right now. Please try asking your question again, or contact support if the issue persists. In the meantime, you can check the Help section in Settings for common solutions.";
  }

  async storeConversation(conversation) {
    try {
      await this.db.query(`
        INSERT INTO conversations (id, user_id, context, messages, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO UPDATE SET
          messages = $4,
          updated_at = $6
      `, [
        conversation.id,
        conversation.userId,
        conversation.context,
        JSON.stringify(conversation.messages),
        conversation.createdAt,
        new Date()
      ]);
    } catch (error) {
      console.error('Failed to store conversation:', error);
    }
  }

  async getConversationHistory(userId, limit = 10) {
    try {
      const result = await this.db.query(`
        SELECT id, context, messages, created_at, updated_at
        FROM conversations
        WHERE user_id = $1
        ORDER BY updated_at DESC
        LIMIT $2
      `, [userId, limit]);

      return result.rows.map(row => ({
        id: row.id,
        context: row.context,
        messages: JSON.parse(row.messages),
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch (error) {
      console.error('Failed to get conversation history:', error);
      return [];
    }
  }

  async addKnowledgeBaseEntry(category, question, answer) {
    if (!this.knowledgeBase.has(category)) {
      this.knowledgeBase.set(category, { context: '', examples: [] });
    }
    
    const knowledge = this.knowledgeBase.get(category);
    knowledge.examples.push({ question, answer });
    
    // Store in database
    await this.db.query(`
      INSERT INTO knowledge_base (category, question, answer, created_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT (category, question) DO UPDATE SET
        answer = $3,
        updated_at = CURRENT_TIMESTAMP
    `, [category, question, answer]);
  }

  getStatus() {
    return {
      activeConversations: this.conversations.size,
      knowledgeCategories: this.knowledgeBase.size,
      geminiConfigured: !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'demo-key'
    };
  }
}

module.exports = AIChatbotService;
