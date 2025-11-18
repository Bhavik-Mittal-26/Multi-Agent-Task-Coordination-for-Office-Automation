const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

class SecurityService {
  constructor(db) {
    this.db = db;
    this.jwtSecret = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
    this.encryptionKey = process.env.ENCRYPTION_KEY || crypto.randomBytes(32);
    this.rateLimiters = new Map();
    this.failedAttempts = new Map();
    this.suspiciousActivities = new Map();
    
    this.initializeSecurity();
  }

  async initializeSecurity() {
    try {
      // Initialize security settings
      await this.db.query(`
        INSERT INTO system_settings (key, value, description, is_public)
        VALUES 
        ('max_login_attempts', '5', 'Maximum failed login attempts before lockout', false),
        ('lockout_duration_minutes', '15', 'Account lockout duration in minutes', false),
        ('session_timeout_hours', '24', 'Session timeout in hours', false),
        ('require_2fa', 'false', 'Require two-factor authentication', false),
        ('password_min_length', '8', 'Minimum password length', true),
        ('encryption_enabled', 'true', 'Enable data encryption', false)
        ON CONFLICT (key) DO NOTHING
      `);

      console.log('🔒 Security service initialized');
    } catch (error) {
      console.error('Failed to initialize security:', error);
    }
  }

  // Password Security
  async hashPassword(password) {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  async verifyPassword(password, hash) {
    return await bcrypt.compare(password, hash);
  }

  validatePassword(password) {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    const errors = [];
    
    if (password.length < minLength) {
      errors.push(`Password must be at least ${minLength} characters long`);
    }
    if (!hasUpperCase) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!hasLowerCase) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (!hasNumbers) {
      errors.push('Password must contain at least one number');
    }
    if (!hasSpecialChar) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // JWT Token Management
  generateToken(userId, role = 'user', expiresIn = '24h') {
    const payload = {
      userId,
      role,
      iat: Math.floor(Date.now() / 1000)
    };

    return jwt.sign(payload, this.jwtSecret, { expiresIn });
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  async refreshToken(token) {
    try {
      const decoded = this.verifyToken(token);
      const user = await this.db.query('SELECT * FROM users WHERE id = $1', [decoded.userId]);
      
      if (user.rows.length === 0) {
        throw new Error('User not found');
      }

      return this.generateToken(decoded.userId, decoded.role);
    } catch (error) {
      throw new Error('Token refresh failed');
    }
  }

  // Rate Limiting
  createRateLimiter(windowMs, max, message) {
    return rateLimit({
      windowMs,
      max,
      message: { error: message },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        res.status(429).json({ error: message });
      }
    });
  }

  getLoginRateLimiter() {
    if (!this.rateLimiters.has('login')) {
      this.rateLimiters.set('login', this.createRateLimiter(
        15 * 60 * 1000, // 15 minutes
        5, // 5 attempts
        'Too many login attempts, please try again later'
      ));
    }
    return this.rateLimiters.get('login');
  }

  getApiRateLimiter() {
    if (!this.rateLimiters.has('api')) {
      this.rateLimiters.set('api', this.createRateLimiter(
        15 * 60 * 1000, // 15 minutes
        100, // 100 requests
        'Too many API requests, please try again later'
      ));
    }
    return this.rateLimiters.get('api');
  }

  // Account Security
  async recordFailedLoginAttempt(userId, ipAddress) {
    const key = `${userId}-${ipAddress}`;
    const attempts = this.failedAttempts.get(key) || { count: 0, firstAttempt: Date.now() };
    
    attempts.count++;
    attempts.lastAttempt = Date.now();
    this.failedAttempts.set(key, attempts);

    // Check if account should be locked
    const maxAttempts = await this.getSetting('max_login_attempts', 5);
    if (attempts.count >= maxAttempts) {
      await this.lockAccount(userId, 'Too many failed login attempts');
    }

    // Log suspicious activity
    await this.logSuspiciousActivity(userId, 'failed_login', {
      ipAddress,
      attemptCount: attempts.count
    });
  }

  async lockAccount(userId, reason) {
    const lockoutDuration = await this.getSetting('lockout_duration_minutes', 15);
    const unlockTime = new Date(Date.now() + lockoutDuration * 60 * 1000);

    await this.db.query(`
      UPDATE users 
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [userId]);

    // Store lockout info
    await this.db.query(`
      INSERT INTO system_settings (key, value, description, is_public)
      VALUES ($1, $2, 'Account lockout info', false)
      ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP
    `, [`lockout_${userId}`, JSON.stringify({ reason, unlockTime })]);

    console.log(`🔒 Account ${userId} locked: ${reason}`);
  }

  async unlockAccount(userId) {
    await this.db.query(`
      UPDATE users 
      SET is_active = true, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [userId]);

    // Remove lockout info
    await this.db.query(`
      DELETE FROM system_settings WHERE key = $1
    `, [`lockout_${userId}`]);

    // Clear failed attempts
    for (const [key, attempts] of this.failedAttempts) {
      if (key.startsWith(`${userId}-`)) {
        this.failedAttempts.delete(key);
      }
    }

    console.log(`🔓 Account ${userId} unlocked`);
  }

  async isAccountLocked(userId) {
    const result = await this.db.query(`
      SELECT value FROM system_settings WHERE key = $1
    `, [`lockout_${userId}`]);

    if (result.rows.length === 0) {
      return false;
    }

    const lockoutInfo = JSON.parse(result.rows[0].value);
    const unlockTime = new Date(lockoutInfo.unlockTime);

    if (new Date() > unlockTime) {
      await this.unlockAccount(userId);
      return false;
    }

    return true;
  }

  // Data Encryption
  encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  decrypt(encryptedText) {
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  // Role-Based Access Control (RBAC)
  async checkPermission(userId, resource, action) {
    const user = await this.db.query('SELECT role FROM users WHERE id = $1', [userId]);
    
    if (user.rows.length === 0) {
      return false;
    }

    const role = user.rows[0].role;
    const permissions = this.getRolePermissions(role);
    
    return permissions.some(p => p.resource === resource && p.actions.includes(action));
  }

  getRolePermissions(role) {
    const rolePermissions = {
      admin: [
        { resource: 'users', actions: ['create', 'read', 'update', 'delete'] },
        { resource: 'agents', actions: ['create', 'read', 'update', 'delete'] },
        { resource: 'integrations', actions: ['create', 'read', 'update', 'delete'] },
        { resource: 'analytics', actions: ['read'] },
        { resource: 'system', actions: ['read', 'update'] }
      ],
      manager: [
        { resource: 'users', actions: ['read', 'update'] },
        { resource: 'agents', actions: ['create', 'read', 'update'] },
        { resource: 'integrations', actions: ['create', 'read', 'update'] },
        { resource: 'analytics', actions: ['read'] }
      ],
      user: [
        { resource: 'agents', actions: ['read', 'update'] },
        { resource: 'integrations', actions: ['read', 'update'] },
        { resource: 'analytics', actions: ['read'] }
      ]
    };

    return rolePermissions[role] || [];
  }

  // Security Headers and Middleware
  getSecurityHeaders() {
    return helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "ws:", "wss:"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"]
        }
      },
      crossOriginEmbedderPolicy: false
    });
  }

  // Suspicious Activity Detection
  async logSuspiciousActivity(userId, activityType, metadata = {}) {
    const activity = {
      userId,
      activityType,
      metadata,
      timestamp: new Date(),
      severity: this.getActivitySeverity(activityType)
    };

    // Store in database
    await this.db.query(`
      INSERT INTO activities (user_id, activity_type, description, metadata, severity)
      VALUES ($1, $2, $3, $4, $5)
    `, [
      userId,
      'security',
      `Suspicious activity: ${activityType}`,
      JSON.stringify(metadata),
      activity.severity
    ]);

    // Check for patterns
    await this.checkSuspiciousPatterns(userId, activityType);
  }

  getActivitySeverity(activityType) {
    const severityMap = {
      'failed_login': 'warning',
      'multiple_failed_logins': 'error',
      'unusual_access_pattern': 'warning',
      'privilege_escalation_attempt': 'critical',
      'data_export_large': 'warning',
      'concurrent_sessions': 'info'
    };

    return severityMap[activityType] || 'info';
  }

  async checkSuspiciousPatterns(userId, activityType) {
    const recentActivities = await this.db.query(`
      SELECT * FROM activities 
      WHERE user_id = $1 
        AND activity_type = 'security'
        AND created_at > NOW() - INTERVAL '1 hour'
      ORDER BY created_at DESC
    `, [userId]);

    // Check for multiple failed logins
    const failedLogins = recentActivities.rows.filter(a => 
      JSON.parse(a.metadata).activityType === 'failed_login'
    );

    if (failedLogins.length >= 3) {
      await this.logSuspiciousActivity(userId, 'multiple_failed_logins', {
        count: failedLogins.length,
        timeWindow: '1 hour'
      });
    }
  }

  // Session Management
  async createSession(userId, ipAddress, userAgent) {
    const sessionId = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await this.db.query(`
      INSERT INTO system_settings (key, value, description, is_public)
      VALUES ($1, $2, 'User session', false)
      ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP
    `, [`session_${sessionId}`, JSON.stringify({
      userId,
      ipAddress,
      userAgent,
      createdAt: new Date(),
      expiresAt
    })]);

    return sessionId;
  }

  async validateSession(sessionId) {
    const result = await this.db.query(`
      SELECT value FROM system_settings WHERE key = $1
    `, [`session_${sessionId}`]);

    if (result.rows.length === 0) {
      return null;
    }

    const session = JSON.parse(result.rows[0].value);
    
    if (new Date() > new Date(session.expiresAt)) {
      await this.destroySession(sessionId);
      return null;
    }

    return session;
  }

  async destroySession(sessionId) {
    await this.db.query(`
      DELETE FROM system_settings WHERE key = $1
    `, [`session_${sessionId}`]);
  }

  // Audit Logging
  async logSecurityEvent(eventType, userId, details = {}) {
    await this.db.query(`
      INSERT INTO activities (user_id, activity_type, description, metadata, severity)
      VALUES ($1, $2, $3, $4, $5)
    `, [
      userId,
      'security_audit',
      `Security event: ${eventType}`,
      JSON.stringify(details),
      'info'
    ]);
  }

  // Utility Methods
  async getSetting(key, defaultValue) {
    const result = await this.db.query(`
      SELECT value FROM system_settings WHERE key = $1
    `, [key]);

    if (result.rows.length === 0) {
      return defaultValue;
    }

    const value = result.rows[0].value;
    return isNaN(value) ? value : parseInt(value);
  }

  generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<[^>]*>/g, '')
      .trim();
  }
}

module.exports = SecurityService;
