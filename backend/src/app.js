const express = require('express');
const cors = require('cors');
const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const trendRoutes = require('./routes/trends');
const placeRoutes = require('./routes/places');
const reportRoutes = require('./routes/reports');
const adminRoutes = require('./routes/admin');
const { uploadDir } = require('./services/images');
const listRoutes = require('./routes/lists');
const { attachUser } = require('./middleware/auth');
const restoRoutes = require('./routes/restos');
const cuisineRoutes = require('./routes/cuisines');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());
app.use(attachUser);

// Photos envoyées par les utilisateurs : noms aléatoires, donc cache très long ; jamais interprétées comme autre chose qu'une image
app.use(
  '/uploads',
  (req, res, next) => express.static(uploadDir(), { index: false, dotfiles: 'deny', maxAge: '30d', immutable: true, setHeaders: (r) => r.set('X-Content-Type-Options', 'nosniff') })(req, res, next)
);

app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/trends', trendRoutes);
app.use('/api/places', placeRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/lists', listRoutes);
app.use('/api/restos', restoRoutes);
app.use('/api/cuisines', cuisineRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;