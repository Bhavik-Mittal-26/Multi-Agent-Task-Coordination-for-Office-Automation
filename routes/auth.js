const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcrypt');

const router = express.Router();

module.exports = (db, jwtSecret) => {
  // Register endpoint
  router.post('/register', [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/),
    body('firstName').trim().isLength({ min: 2, max: 50 }),
    body('lastName').trim().isLength({ min: 2, max: 50 })
  ], async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: errors.array() 
        });
      }

      const { email, password, firstName, lastName } = req.body;

      // Check if user already exists
      const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existingUser.rows.length > 0) {
        return res.status(409).json({ error: 'User already exists' });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);

      // Create user
      const result = await db.query(`
        INSERT INTO users (email, password_hash, first_name, last_name, role)
        VALUES ($1, $2, $3, $4, 'user')
        RETURNING id, email, first_name, last_name, role, created_at
      `, [email, passwordHash, firstName, lastName]);

      const user = result.rows[0];

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, role: user.role },
        jwtSecret,
        { expiresIn: '24h' }
      );

      // Create default agent instances
      await createDefaultAgentInstances(db, user.id);

      res.status(201).json({
        message: 'User registered successfully',
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role
        },
        token
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Login endpoint
  router.post('/login', [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty()
  ], async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: errors.array() 
        });
      }

      const { email, password } = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress;

      // Get user
      const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const user = result.rows[0];

      // Check if account is locked
      const isLocked = await checkAccountLocked(db, user.id);
      if (isLocked) {
        return res.status(423).json({ error: 'Account is temporarily locked' });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        // Record failed attempt
        await recordFailedLoginAttempt(db, user.id, ipAddress);
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Check if user is active
      if (!user.is_active) {
        return res.status(403).json({ error: 'Account is deactivated' });
      }

      // Update last login
      await db.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, role: user.role },
        jwtSecret,
        { expiresIn: '24h' }
      );

      // Clear failed attempts
      await clearFailedAttempts(db, user.id, ipAddress);

      res.json({
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          lastLogin: user.last_login
        },
        token
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Refresh token endpoint
  router.post('/refresh', async (req, res) => {
    try {
      const { token } = req.body;
      
      if (!token) {
        return res.status(400).json({ error: 'Token required' });
      }

      // Verify and decode token
      const decoded = jwt.verify(token, jwtSecret);
      
      // Get user
      const result = await db.query('SELECT * FROM users WHERE id = $1', [decoded.userId]);
      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'User not found' });
      }

      const user = result.rows[0];

      // Generate new token
      const newToken = jwt.sign(
        { userId: user.id, role: user.role },
        jwtSecret,
        { expiresIn: '24h' }
      );

      res.json({
        message: 'Token refreshed successfully',
        token: newToken
      });
    } catch (error) {
      console.error('Token refresh error:', error);
      res.status(401).json({ error: 'Invalid token' });
    }
  });

  // Logout endpoint
  router.post('/logout', async (req, res) => {
    try {
      // In a more sophisticated implementation, you might maintain a blacklist of tokens
      // For now, we'll just return success
      res.json({ message: 'Logout successful' });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Forgot password endpoint
  router.post('/forgot-password', [
    body('email').isEmail().normalizeEmail()
  ], async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: errors.array() 
        });
      }

      const { email } = req.body;

      // Check if user exists
      const result = await db.query('SELECT id, first_name FROM users WHERE email = $1', [email]);
      if (result.rows.length === 0) {
        // Don't reveal if email exists or not
        return res.json({ message: 'If the email exists, a reset link has been sent' });
      }

      const user = result.rows[0];

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetExpires = new Date(Date.now() + 3600000); // 1 hour

      // Store reset token
      await db.query(`
        INSERT INTO system_settings (key, value, description, is_public)
        VALUES ($1, $2, 'Password reset token', false)
        ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP
      `, [`reset_${user.id}`, JSON.stringify({
        token: resetToken,
        expires: resetExpires
      })]);

      // In a real implementation, send email with reset link
      console.log(`Password reset token for ${email}: ${resetToken}`);

      res.json({ message: 'If the email exists, a reset link has been sent' });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Reset password endpoint
  router.post('/reset-password', [
    body('token').notEmpty(),
    body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
  ], async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: errors.array() 
        });
      }

      const { token, password } = req.body;

      // Find reset token
      const result = await db.query(`
        SELECT key, value FROM system_settings 
        WHERE key LIKE 'reset_%' AND value::jsonb->>'token' = $1
      `, [token]);

      if (result.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid or expired reset token' });
      }

      const resetData = JSON.parse(result.rows[0].value);
      const userId = result.rows[0].key.replace('reset_', '');

      // Check if token is expired
      if (new Date() > new Date(resetData.expires)) {
        await db.query('DELETE FROM system_settings WHERE key = $1', [result.rows[0].key]);
        return res.status(400).json({ error: 'Reset token has expired' });
      }

      // Hash new password
      const passwordHash = await bcrypt.hash(password, 12);

      // Update password
      await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);

      // Remove reset token
      await db.query('DELETE FROM system_settings WHERE key = $1', [result.rows[0].key]);

      res.json({ message: 'Password reset successfully' });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
};

// Helper functions
async function createDefaultAgentInstances(db, userId) {
  try {
    // Get all default agents
    const agents = await db.query('SELECT id FROM agents WHERE is_active = true');
    
    for (const agent of agents.rows) {
      await db.query(`
        INSERT INTO user_agents (user_id, agent_id, status, settings)
        VALUES ($1, $2, 'idle', '{}')
        ON CONFLICT (user_id, agent_id) DO NOTHING
      `, [userId, agent.id]);
    }
  } catch (error) {
    console.error('Failed to create default agent instances:', error);
  }
}

async function checkAccountLocked(db, userId) {
  const result = await db.query(`
    SELECT value FROM system_settings WHERE key = $1
  `, [`lockout_${userId}`]);

  if (result.rows.length === 0) {
    return false;
  }

  const lockoutInfo = JSON.parse(result.rows[0].value);
  const unlockTime = new Date(lockoutInfo.unlockTime);

  if (new Date() > unlockTime) {
    await db.query('DELETE FROM system_settings WHERE key = $1', [`lockout_${userId}`]);
    return false;
  }

  return true;
}

async function recordFailedLoginAttempt(db, userId, ipAddress) {
  const key = `failed_attempts_${userId}_${ipAddress}`;
  
  const result = await db.query(`
    SELECT value FROM system_settings WHERE key = $1
  `, [key]);

  let attempts = { count: 0, firstAttempt: Date.now() };
  
  if (result.rows.length > 0) {
    attempts = JSON.parse(result.rows[0].value);
  }

  attempts.count++;
  attempts.lastAttempt = Date.now();

  await db.query(`
    INSERT INTO system_settings (key, value, description, is_public)
    VALUES ($1, $2, 'Failed login attempts', false)
    ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP
  `, [key, JSON.stringify(attempts)]);

  // Check if account should be locked
  if (attempts.count >= 5) {
    const unlockTime = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    
    await db.query(`
      INSERT INTO system_settings (key, value, description, is_public)
      VALUES ($1, $2, 'Account lockout', false)
      ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP
    `, [`lockout_${userId}`, JSON.stringify({
      reason: 'Too many failed login attempts',
      unlockTime
    })]);
  }
}

async function clearFailedAttempts(db, userId, ipAddress) {
  const key = `failed_attempts_${userId}_${ipAddress}`;
  await db.query('DELETE FROM system_settings WHERE key = $1', [key]);
}
