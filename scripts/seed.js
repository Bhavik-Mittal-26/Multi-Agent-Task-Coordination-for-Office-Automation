const { Pool } = require('pg');
const bcrypt = require('bcrypt');

// Database connection
const db = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/multiagent_office',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...');

    // Create demo user
    const demoPassword = await bcrypt.hash('demo123!', 12);
    const userResult = await db.query(`
      INSERT INTO users (email, password_hash, first_name, last_name, role)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (email) DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name
      RETURNING id
    `, ['demo@multiagent-office.com', demoPassword, 'Demo', 'User', 'user']);

    const userId = userResult.rows[0].id;
    console.log('✅ Demo user created');

    // Create demo organization
    const orgResult = await db.query(`
      INSERT INTO organizations (name, domain, subscription_tier)
      VALUES ($1, $2, $3)
      ON CONFLICT (name) DO NOTHING
      RETURNING id
    `, ['Demo Organization', 'demo.com', 'premium']);

    const orgId = orgResult.rows[0]?.id;

    if (orgId) {
      // Link user to organization
      await db.query(`
        INSERT INTO user_organizations (user_id, organization_id, role)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, organization_id) DO NOTHING
      `, [userId, orgId, 'admin']);
      console.log('✅ Demo organization created and linked');
    }

    // Create demo shared context
    const demoContext = [
      {
        context_type: 'schedule',
        data: {
          title: 'Team Standup',
          date: new Date().toISOString().slice(0, 10),
          time: '09:00',
          participants: ['John', 'Sarah', 'Mike'],
          duration: 30
        },
        priority: 'high'
      },
      {
        context_type: 'schedule',
        data: {
          title: 'Client Meeting',
          date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
          time: '14:00',
          participants: ['Client Team'],
          duration: 60
        },
        priority: 'high'
      },
      {
        context_type: 'deadline',
        data: {
          task: 'Q4 Report Submission',
          date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
          priority: 'urgent'
        },
        priority: 'urgent'
      },
      {
        context_type: 'deadline',
        data: {
          task: 'Budget Review',
          date: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
          priority: 'high'
        },
        priority: 'high'
      },
      {
        context_type: 'resource',
        data: {
          name: 'Conference Room A',
          capacity: 8,
          usage: 6
        },
        priority: 'medium'
      }
    ];

    for (const context of demoContext) {
      await db.query(`
        INSERT INTO shared_context (user_id, context_type, data, priority)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT DO NOTHING
      `, [userId, context.context_type, JSON.stringify(context.data), context.priority]);
    }
    console.log('✅ Demo shared context created');

    // Create demo tasks
    const demoTasks = [
      {
        title: 'Prepare client presentation',
        description: 'Create slides for the quarterly review meeting',
        priority: 'high',
        status: 'in-progress',
        assigned_to: 'Sarah',
        due_date: new Date(Date.now() + 3 * 86400000)
      },
      {
        title: 'Update project documentation',
        description: 'Review and update all project documentation',
        priority: 'medium',
        status: 'pending',
        assigned_to: 'Mike',
        due_date: new Date(Date.now() + 7 * 86400000)
      },
      {
        title: 'Code review for feature X',
        description: 'Review the new authentication feature',
        priority: 'high',
        status: 'pending',
        assigned_to: 'John',
        due_date: new Date(Date.now() + 2 * 86400000)
      }
    ];

    for (const task of demoTasks) {
      await db.query(`
        INSERT INTO tasks (user_id, title, description, priority, status, assigned_to, due_date)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [userId, task.title, task.description, task.priority, task.status, task.assigned_to, task.due_date]);
    }
    console.log('✅ Demo tasks created');

    // Create demo activities
    const demoActivities = [
      {
        activity_type: 'agent_execution',
        description: 'Meeting Agent processed 3 calendar events',
        severity: 'info'
      },
      {
        activity_type: 'integration_sync',
        description: 'Google Calendar sync completed successfully',
        severity: 'info'
      },
      {
        activity_type: 'conflict_resolution',
        description: 'Auto-resolved schedule conflict for Team Standup',
        severity: 'warning'
      },
      {
        activity_type: 'task_completion',
        description: 'Task "Prepare client presentation" marked as completed',
        severity: 'info'
      }
    ];

    for (const activity of demoActivities) {
      await db.query(`
        INSERT INTO activities (user_id, activity_type, description, severity)
        VALUES ($1, $2, $3, $4)
      `, [userId, activity.activity_type, activity.description, activity.severity]);
    }
    console.log('✅ Demo activities created');

    // Create demo notifications
    const demoNotifications = [
      {
        title: 'Welcome to Multi-Agent Office!',
        message: 'Your intelligent office automation system is ready to help you be more productive.',
        type: 'info'
      },
      {
        title: 'Agent Performance Update',
        message: 'Your Meeting Agent has achieved 95% performance score this week.',
        type: 'success'
      },
      {
        title: 'Integration Available',
        message: 'Connect your Google Calendar to enable automatic meeting scheduling.',
        type: 'info'
      }
    ];

    for (const notification of demoNotifications) {
      await db.query(`
        INSERT INTO notifications (user_id, title, message, type)
        VALUES ($1, $2, $3, $4)
      `, [userId, notification.title, notification.message, notification.type]);
    }
    console.log('✅ Demo notifications created');

    // Create demo feedback
    const demoFeedback = [
      {
        agent_id: (await db.query("SELECT id FROM agents WHERE type = 'meeting-agent'")).rows[0].id,
        rating: 5,
        comment: 'Excellent scheduling and conflict resolution!'
      },
      {
        agent_id: (await db.query("SELECT id FROM agents WHERE type = 'mail-summarizer'")).rows[0].id,
        rating: 4,
        comment: 'Great at extracting key points from emails.'
      }
    ];

    for (const feedback of demoFeedback) {
      await db.query(`
        INSERT INTO feedback (user_id, agent_id, rating, comment)
        VALUES ($1, $2, $3, $4)
      `, [userId, feedback.agent_id, feedback.rating, feedback.comment]);
    }
    console.log('✅ Demo feedback created');

    // Create demo analytics events
    const demoEvents = [
      { event_type: 'page_view', event_data: { page: 'dashboard' } },
      { event_type: 'agent_run', event_data: { agent: 'meeting-agent' } },
      { event_type: 'integration_connect', event_data: { service: 'google-calendar' } },
      { event_type: 'task_complete', event_data: { task_id: 'task-1' } }
    ];

    for (const event of demoEvents) {
      await db.query(`
        INSERT INTO analytics_events (user_id, event_type, event_data)
        VALUES ($1, $2, $3)
      `, [userId, event.event_type, JSON.stringify(event.event_data)]);
    }
    console.log('✅ Demo analytics events created');

    console.log('🎉 Database seeding completed successfully!');
    console.log('\n📋 Demo Account Details:');
    console.log('Email: demo@multiagent-office.com');
    console.log('Password: demo123!');
    console.log('\n🚀 You can now start the server and login with these credentials.');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await db.end();
  }
}

// Run seeding if this file is executed directly
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };
