require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const http = require('http');
const socketIo = require('socket.io');

const connectDB = require('./config/database');
const logger = require('./utils/logger');
const importRoutes = require('./routes/importRoutes');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const cronService = require('./services/cronService');
const { jobImportQueue } = require('./queues/jobQueue');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || '*',
    credentials: process.env.CLIENT_URL ? true : false,
  },
});

const PORT = process.env.PORT || 5000;

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(compression());
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: process.env.CLIENT_URL ? true : false,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: parseInt(process.env.MAX_REQUESTS_PER_MINUTE) || 60,
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api', limiter);

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.use('/api/imports', importRoutes);

app.use(notFound);
app.use(errorHandler);

jobImportQueue.on('completed', (job, result) => {
  io.emit('import:completed', {
    jobId: job.id,
    result,
  });
});

jobImportQueue.on('failed', (job, err) => {
  io.emit('import:failed', {
    jobId: job.id,
    error: err.message,
  });
});

jobImportQueue.on('progress', (job, progress) => {
  io.emit('import:progress', {
    jobId: job.id,
    progress,
  });
});

io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

const startServer = async () => {
  try {
    await connectDB();

    await cronService.initializeJobFeeds();

    cronService.start();

    const { startWorker } = require('./workers/jobWorker');
    await startWorker();
    logger.info('Worker started inside server process');

    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  cronService.stop();
  await jobImportQueue.close();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  cronService.stop();
  await jobImportQueue.close();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

if (require.main === module) {
  startServer();
}

module.exports = app;
