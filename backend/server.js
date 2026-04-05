require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const rateLimit = require('express-rate-limit');
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const transactionRoutes = require('./routes/transaction.routes');
const { testDBConnection } = require('./config/db.config');
const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 5000;
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'TransactIQ_Login_Simple.html')); });
app.get('/dashboard', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'user-dashboard.html')); });
app.get('/admin', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'admin-dashboard.html')); });
app.get('/subscribe', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'subscription.html')); });
app.get('/api/health', (req, res) => { res.json({ success: true, message: 'TransactIQ API running' }); });
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/transactions', transactionRoutes);
app.use((err, req, res, next) => { res.status(500).json({ success: false, message: 'Server error' }); });
async function startServer() {
  try {
    await testDBConnection();
    app.listen(PORT, () => {
      console.log('\n✅ TransactIQ Server running on http://localhost:' + PORT);
      console.log('🌐 Login:        http://localhost:' + PORT);
      console.log('📊 Dashboard:    http://localhost:' + PORT + '/dashboard');
      console.log('🔑 Admin:        http://localhost:' + PORT + '/admin');
      console.log('💳 Subscribe:    http://localhost:' + PORT + '/subscribe');
    });
  } catch (err) {
    console.error('❌ Failed to start:', err.message);
    process.exit(1);
  }
}
startServer();
