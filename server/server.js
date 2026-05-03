require('dotenv').config({ path: '../.env' });
const express = require('express');
const cors = require('cors');
const errorHandler = require('./middleware/errorHandler');
const { initDatabase, forcePersistNow } = require('./config/db');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/leaves', require('./routes/leaves'));
app.use('/api/payroll', require('./routes/payroll'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/chatbot', require('./routes/chatbot'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use(errorHandler);

const seedData = require('./utils/seedData');

const PORT = process.env.PORT || 5050;

const start = async () => {
  try {
    await initDatabase();
    await seedData();
    await forcePersistNow();

    app.listen(PORT, () => {
      console.log(`\n🚀 EmPay API Server running on port ${PORT}`);
      console.log(`📊 Health: http://localhost:${PORT}/api/health`);
      console.log(`\n📧 Demo Accounts:`);
      console.log(`   Admin:    admin@empay.com / admin123`);
      console.log(`   HR:       hr@empay.com / hr123`);
      console.log(`   Employee: john@empay.com / emp123\n`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

start();
