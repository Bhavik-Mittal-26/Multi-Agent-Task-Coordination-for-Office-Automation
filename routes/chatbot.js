const express = require('express');
const { body, validationResult } = require('express-validator');

const router = express.Router();

module.exports = (db, aiChatbot) => {
  // Send message to chatbot
  router.post('/message', [
    body('message').notEmpty().isLength({ min: 1, max: 1000 }),
    body('conversationId').optional().isUUID()
  ], async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: errors.array() 
        });
      }

      const userId = req.user.id;
      const { message, conversationId } = req.body;

      const result = await aiChatbot.processMessage(userId, message, conversationId);

      res.json({
        message: 'Message processed successfully',
        conversationId: result.conversationId,
        response: result.response,
        timestamp: result.timestamp
      });
    } catch (error) {
      console.error('Chatbot message error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get conversation history
  router.get('/conversations', async (req, res) => {
    try {
      const userId = req.user.id;
      const { limit = 10 } = req.query;

      const conversations = await aiChatbot.getConversationHistory(userId, parseInt(limit));

      res.json({ conversations });
    } catch (error) {
      console.error('Get conversations error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get specific conversation
  router.get('/conversations/:conversationId', async (req, res) => {
    try {
      const userId = req.user.id;
      const { conversationId } = req.params;

      const result = await db.query(`
        SELECT id, context, messages, created_at, updated_at
        FROM conversations
        WHERE id = $1 AND user_id = $2
      `, [conversationId, userId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      const conversation = {
        id: result.rows[0].id,
        context: result.rows[0].context,
        messages: JSON.parse(result.rows[0].messages),
        createdAt: result.rows[0].created_at,
        updatedAt: result.rows[0].updated_at
      };

      res.json({ conversation });
    } catch (error) {
      console.error('Get conversation error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get chatbot status
  router.get('/status', async (req, res) => {
    try {
      const status = aiChatbot.getStatus();
      res.json({ status });
    } catch (error) {
      console.error('Get chatbot status error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Add knowledge base entry (admin only)
  router.post('/knowledge', [
    body('category').notEmpty().isLength({ min: 1, max: 50 }),
    body('question').notEmpty().isLength({ min: 1, max: 500 }),
    body('answer').notEmpty().isLength({ min: 1, max: 2000 })
  ], async (req, res) => {
    try {
      // Check if user is admin
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: errors.array() 
        });
      }

      const { category, question, answer } = req.body;

      await aiChatbot.addKnowledgeBaseEntry(category, question, answer);

      res.json({
        message: 'Knowledge base entry added successfully',
        category,
        question,
        answer
      });
    } catch (error) {
      console.error('Add knowledge base entry error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get quick help topics
  router.get('/help/topics', async (req, res) => {
    try {
      const topics = [
        {
          category: 'agents',
          title: 'Agent Management',
          questions: [
            'How do I run an agent?',
            'Why is my agent not working?',
            'How do I improve agent performance?',
            'What does the Meeting Agent do?',
            'How does the Mail Summarizer work?'
          ]
        },
        {
          category: 'integrations',
          title: 'Integrations',
          questions: [
            'How do I connect Google Calendar?',
            'How do I sync with Slack?',
            'Why is my integration not syncing?',
            'How do I disconnect an integration?',
            'What integrations are available?'
          ]
        },
        {
          category: 'general',
          title: 'General Help',
          questions: [
            'How do I get started?',
            'What features are available?',
            'How do I view my analytics?',
            'How do I change my settings?',
            'How do I contact support?'
          ]
        }
      ];

      res.json({ topics });
    } catch (error) {
      console.error('Get help topics error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
};
