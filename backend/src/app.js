const express = require('express');
const cors = require('cors');
const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const trendRoutes = require('./routes/trends');
const { attachUser } = require('./middleware/auth');
const restoRoutes = require('./routes/restos');
const cuisineRoutes = require('./routes/cuisines');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());
app.use(attachUser);

app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/trends', trendRoutes);
app.use('/api/restos', restoRoutes);
app.use('/api/cuisines', cuisineRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;