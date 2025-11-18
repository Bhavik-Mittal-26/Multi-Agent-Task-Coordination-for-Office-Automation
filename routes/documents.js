const express = require('express');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/markdown', 'text/html', 'application/json', 'text/csv'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOCX, TXT, MD, HTML, JSON, and CSV files are allowed.'), false);
    }
  }
});

module.exports = (db, documentProcessor) => {
  // Process document
  router.post('/process', upload.single('document'), [
    body('content').optional().isLength({ min: 1, max: 10000 })
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
      let documentData = {};

      if (req.file) {
        // Process uploaded file
        documentData = {
          name: req.file.originalname,
          type: req.file.mimetype,
          size: req.file.size,
          content: req.file.buffer.toString('utf8'),
          uploadedAt: new Date()
        };
      } else if (req.body.content) {
        // Process text content
        documentData = {
          name: req.body.name || 'Text Document',
          type: 'text/plain',
          content: req.body.content,
          uploadedAt: new Date()
        };
      } else {
        return res.status(400).json({ error: 'No document or content provided' });
      }

      const result = await documentProcessor.processDocument(userId, documentData);

      res.json({
        message: 'Document processing started',
        processingId: result.processingId,
        status: result.status
      });
    } catch (error) {
      console.error('Document processing error:', error);
      res.status(500).json({ error: 'Failed to process document' });
    }
  });

  // Get processing status
  router.get('/status/:processingId', async (req, res) => {
    try {
      const { processingId } = req.params;
      const status = await documentProcessor.getProcessingStatus(processingId);

      if (!status) {
        return res.status(404).json({ error: 'Processing job not found' });
      }

      res.json({ status });
    } catch (error) {
      console.error('Get processing status error:', error);
      res.status(500).json({ error: 'Failed to get processing status' });
    }
  });

  // Get user documents
  router.get('/user', async (req, res) => {
    try {
      const userId = req.user.id;
      const { limit = 10 } = req.query;

      const documents = await documentProcessor.getUserDocuments(userId, parseInt(limit));

      res.json({ documents });
    } catch (error) {
      console.error('Get user documents error:', error);
      res.status(500).json({ error: 'Failed to get user documents' });
    }
  });

  // Get document processor status
  router.get('/status', async (req, res) => {
    try {
      const status = documentProcessor.getStatus();
      res.json({ status });
    } catch (error) {
      console.error('Get document processor status error:', error);
      res.status(500).json({ error: 'Failed to get document processor status' });
    }
  });

  // Batch process documents
  router.post('/batch-process', upload.array('documents', 5), async (req, res) => {
    try {
      const userId = req.user.id;
      const results = [];

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No documents provided' });
      }

      for (const file of req.files) {
        const documentData = {
          name: file.originalname,
          type: file.mimetype,
          size: file.size,
          content: file.buffer.toString('utf8'),
          uploadedAt: new Date()
        };

        const result = await documentProcessor.processDocument(userId, documentData);
        results.push({
          fileName: file.originalname,
          processingId: result.processingId,
          status: result.status
        });
      }

      res.json({
        message: 'Batch processing started',
        results,
        totalProcessed: results.length
      });
    } catch (error) {
      console.error('Batch processing error:', error);
      res.status(500).json({ error: 'Failed to process documents' });
    }
  });

  // Get supported file types
  router.get('/supported-types', (req, res) => {
    res.json({
      supportedTypes: [
        { extension: 'pdf', mimeType: 'application/pdf', description: 'PDF Documents' },
        { extension: 'docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', description: 'Word Documents' },
        { extension: 'txt', mimeType: 'text/plain', description: 'Text Files' },
        { extension: 'md', mimeType: 'text/markdown', description: 'Markdown Files' },
        { extension: 'html', mimeType: 'text/html', description: 'HTML Files' },
        { extension: 'json', mimeType: 'application/json', description: 'JSON Files' },
        { extension: 'csv', mimeType: 'text/csv', description: 'CSV Files' }
      ],
      maxFileSize: '10MB',
      maxBatchSize: 5
    });
  });

  return router;
};
