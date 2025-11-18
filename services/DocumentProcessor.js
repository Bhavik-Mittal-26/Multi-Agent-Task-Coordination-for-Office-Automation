const { v4: uuidv4 } = require('uuid');

class DocumentProcessor {
  constructor(db, io) {
    this.db = db;
    this.io = io;
    this.processingQueue = new Map();
    this.supportedFormats = ['pdf', 'docx', 'txt', 'md', 'html', 'json', 'csv'];
    this.aiCapabilities = {
      ocr: true,
      classification: true,
      extraction: true,
      summarization: true,
      translation: true
    };
  }

  async processDocument(userId, documentData) {
    try {
      const processingId = uuidv4();
      
      // Add to processing queue
      this.processingQueue.set(processingId, {
        id: processingId,
        userId,
        status: 'processing',
        startTime: new Date(),
        document: documentData
      });

      // Emit processing started
      this.io.to(`user-${userId}`).emit('document-processing-started', {
        processingId,
        status: 'processing'
      });

      // Simulate document processing steps
      const results = await this.performDocumentAnalysis(documentData);

      // Update processing status
      this.processingQueue.set(processingId, {
        ...this.processingQueue.get(processingId),
        status: 'completed',
        results,
        endTime: new Date()
      });

      // Emit results
      this.io.to(`user-${userId}`).emit('document-processing-completed', {
        processingId,
        results,
        status: 'completed'
      });

      return {
        processingId,
        results,
        status: 'completed'
      };

    } catch (error) {
      console.error('Document processing error:', error);
      throw error;
    }
  }

  async performDocumentAnalysis(documentData) {
    // Simulate AI-powered document analysis
    const analysis = {
      documentType: this.classifyDocument(documentData),
      keyEntities: this.extractEntities(documentData),
      summary: this.generateSummary(documentData),
      actionItems: this.extractActionItems(documentData),
      sentiment: this.analyzeSentiment(documentData),
      language: this.detectLanguage(documentData),
      confidence: Math.random() * 0.3 + 0.7, // 70-100% confidence
      processingTime: Math.random() * 2000 + 1000 // 1-3 seconds
    };

    return analysis;
  }

  classifyDocument(documentData) {
    const content = documentData.content || documentData.text || '';
    const lowerContent = content.toLowerCase();

    if (lowerContent.includes('contract') || lowerContent.includes('agreement')) {
      return 'Contract';
    }
    if (lowerContent.includes('invoice') || lowerContent.includes('payment')) {
      return 'Invoice';
    }
    if (lowerContent.includes('meeting') || lowerContent.includes('minutes')) {
      return 'Meeting Notes';
    }
    if (lowerContent.includes('report') || lowerContent.includes('analysis')) {
      return 'Report';
    }
    if (lowerContent.includes('email') || lowerContent.includes('@')) {
      return 'Email';
    }
    if (lowerContent.includes('proposal') || lowerContent.includes('project')) {
      return 'Proposal';
    }

    return 'General Document';
  }

  extractEntities(documentData) {
    const content = documentData.content || documentData.text || '';
    
    // Simple entity extraction simulation
    const entities = {
      people: this.extractPeople(content),
      organizations: this.extractOrganizations(content),
      dates: this.extractDates(content),
      amounts: this.extractAmounts(content),
      locations: this.extractLocations(content)
    };

    return entities;
  }

  extractPeople(content) {
    // Simulate person name extraction
    const people = [];
    const namePatterns = [
      /(?:Mr\.|Ms\.|Dr\.|Prof\.)\s+([A-Z][a-z]+ [A-Z][a-z]+)/g,
      /([A-Z][a-z]+ [A-Z][a-z]+)/g
    ];

    namePatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        people.push(...matches.slice(0, 3)); // Limit to 3 people
      }
    });

    return [...new Set(people)]; // Remove duplicates
  }

  extractOrganizations(content) {
    // Simulate organization extraction
    const orgs = [];
    const orgKeywords = ['Inc.', 'Corp.', 'LLC', 'Ltd.', 'Company', 'Organization'];
    
    orgKeywords.forEach(keyword => {
      const regex = new RegExp(`([A-Z][a-z]+\\s+[A-Z][a-z]+\\s+${keyword})`, 'g');
      const matches = content.match(regex);
      if (matches) {
        orgs.push(...matches);
      }
    });

    return [...new Set(orgs)];
  }

  extractDates(content) {
    // Simulate date extraction
    const datePattern = /(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4})/g;
    const dates = content.match(datePattern) || [];
    return dates.slice(0, 5); // Limit to 5 dates
  }

  extractAmounts(content) {
    // Simulate amount extraction
    const amountPattern = /\$[\d,]+\.?\d*/g;
    const amounts = content.match(amountPattern) || [];
    return amounts.slice(0, 5); // Limit to 5 amounts
  }

  extractLocations(content) {
    // Simulate location extraction
    const locations = [];
    const cityPattern = /([A-Z][a-z]+(?: [A-Z][a-z]+)*,?\s+(?:CA|NY|TX|FL|IL|PA|OH|GA|NC|MI))/g;
    const matches = content.match(cityPattern);
    if (matches) {
      locations.push(...matches.slice(0, 3));
    }
    return locations;
  }

  generateSummary(documentData) {
    const content = documentData.content || documentData.text || '';
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
    
    if (sentences.length === 0) {
      return 'No content available for summarization.';
    }

    // Simple extractive summarization (take first few sentences)
    const summarySentences = sentences.slice(0, Math.min(3, sentences.length));
    return summarySentences.join('. ').trim() + '.';
  }

  extractActionItems(documentData) {
    const content = documentData.content || documentData.text || '';
    const actionItems = [];
    
    // Look for action item patterns
    const actionPatterns = [
      /(?:action|todo|task|follow.?up):\s*([^.!?]+)/gi,
      /(?:need to|must|should|will)\s+([^.!?]+)/gi,
      /(?:deadline|due):\s*([^.!?]+)/gi
    ];

    actionPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        actionItems.push(...matches.slice(0, 5));
      }
    });

    return actionItems.slice(0, 5); // Limit to 5 action items
  }

  analyzeSentiment(documentData) {
    const content = documentData.content || documentData.text || '';
    const lowerContent = content.toLowerCase();
    
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'success', 'happy', 'pleased'];
    const negativeWords = ['bad', 'terrible', 'awful', 'disappointed', 'failed', 'problem', 'issue', 'concern'];
    
    let positiveScore = 0;
    let negativeScore = 0;
    
    positiveWords.forEach(word => {
      const matches = (lowerContent.match(new RegExp(word, 'g')) || []).length;
      positiveScore += matches;
    });
    
    negativeWords.forEach(word => {
      const matches = (lowerContent.match(new RegExp(word, 'g')) || []).length;
      negativeScore += matches;
    });
    
    if (positiveScore > negativeScore) {
      return { sentiment: 'positive', score: positiveScore / (positiveScore + negativeScore) };
    } else if (negativeScore > positiveScore) {
      return { sentiment: 'negative', score: negativeScore / (positiveScore + negativeScore) };
    } else {
      return { sentiment: 'neutral', score: 0.5 };
    }
  }

  detectLanguage(documentData) {
    const content = documentData.content || documentData.text || '';
    
    // Simple language detection based on common words
    const englishWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    const spanishWords = ['el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'es', 'se', 'no', 'te'];
    const frenchWords = ['le', 'la', 'de', 'et', 'à', 'un', 'il', 'que', 'ne', 'se', 'ce', 'pas'];
    
    let englishCount = 0;
    let spanishCount = 0;
    let frenchCount = 0;
    
    const words = content.toLowerCase().split(/\s+/);
    
    words.forEach(word => {
      if (englishWords.includes(word)) englishCount++;
      if (spanishWords.includes(word)) spanishCount++;
      if (frenchWords.includes(word)) frenchCount++;
    });
    
    if (englishCount > spanishCount && englishCount > frenchCount) {
      return 'English';
    } else if (spanishCount > frenchCount) {
      return 'Spanish';
    } else if (frenchCount > 0) {
      return 'French';
    } else {
      return 'English'; // Default
    }
  }

  async getProcessingStatus(processingId) {
    return this.processingQueue.get(processingId) || null;
  }

  async getUserDocuments(userId, limit = 10) {
    // Mock user documents
    return [
      {
        id: uuidv4(),
        name: 'Q4 Sales Report.pdf',
        type: 'Report',
        processedAt: new Date(),
        summary: 'Quarterly sales analysis showing 15% growth...',
        entities: { people: ['John Smith'], organizations: ['Acme Corp'], dates: ['2024-01-15'] }
      },
      {
        id: uuidv4(),
        name: 'Meeting Minutes.docx',
        type: 'Meeting Notes',
        processedAt: new Date(),
        summary: 'Project kickoff meeting discussing timeline and deliverables...',
        entities: { people: ['Sarah Johnson', 'Mike Chen'], organizations: ['Tech Solutions'], dates: ['2024-01-10'] }
      }
    ];
  }

  getStatus() {
    return {
      activeProcessing: this.processingQueue.size,
      supportedFormats: this.supportedFormats,
      aiCapabilities: this.aiCapabilities,
      totalProcessed: Math.floor(Math.random() * 1000) + 500
    };
  }
}

module.exports = DocumentProcessor;
