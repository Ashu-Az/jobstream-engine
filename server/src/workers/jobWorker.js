require('dotenv').config();
const http = require('http');
const { jobImportQueue } = require('../queues/jobQueue');
const jobFetcherService = require('../services/jobFetcherService');
const jobImportService = require('../services/jobImportService');
const connectDB = require('../config/database');
const logger = require('../utils/logger');

const CONCURRENCY = parseInt(process.env.QUEUE_CONCURRENCY) || 5;

const processJob = async (job) => {
  const { url } = job.data;
  let importLogId;

  try {
    logger.info(`Processing job ${job.id} for URL: ${url}`);

    importLogId = await jobImportService.createImportLog(url);

    job.progress(10);

    const fetchResult = await jobFetcherService.fetchJobsFromUrl(url);

    if (!fetchResult.success) {
      throw new Error(fetchResult.error || 'Failed to fetch jobs');
    }

    job.progress(40);

    const importStats = await jobImportService.importJobs(
      fetchResult.jobs,
      url,
      importLogId
    );

    job.progress(90);

    await jobImportService.finalizeImportLog(importLogId, importStats, 'completed');

    job.progress(100);

    logger.info(`Job ${job.id} completed: ${importStats.totalImported} jobs imported`);

    return {
      success: true,
      stats: importStats,
      url,
    };
  } catch (error) {
    logger.error(`Job ${job.id} failed: ${error.message}`);

    if (importLogId) {
      await jobImportService.finalizeImportLog(
        importLogId,
        {
          totalFetched: 0,
          totalImported: 0,
          newJobs: 0,
          updatedJobs: 0,
          failedJobs: 0,
        },
        'failed',
        error.message
      );
    }

    throw error;
  }
};

const startWorker = async () => {
  try {
    console.log('Worker starting...');
    console.log('Environment check:', {
      MONGODB_URI: process.env.MONGODB_URI ? 'SET' : 'MISSING',
      REDIS_HOST: process.env.REDIS_HOST || 'MISSING',
      REDIS_PORT: process.env.REDIS_PORT || 'MISSING',
      REDIS_PASSWORD: process.env.REDIS_PASSWORD ? 'SET' : 'MISSING',
      REDIS_TLS: process.env.REDIS_TLS || 'MISSING',
    });

    await connectDB();
    console.log('MongoDB connected');

    logger.info(`Starting worker with concurrency: ${CONCURRENCY}`);

    jobImportQueue.process(CONCURRENCY, processJob);

    jobImportQueue.on('completed', (job, result) => {
      logger.info(`Job ${job.id} completed with result:`, result);
    });

    jobImportQueue.on('failed', (job, err) => {
      logger.error(`Job ${job.id} failed with error: ${err.message}`);
    });

    jobImportQueue.on('progress', (job, progress) => {
      logger.debug(`Job ${job.id} progress: ${progress}%`);
    });

    logger.info('Worker started successfully');

    const keepAlivePort = process.env.PORT || 5001;
    http.createServer((req, res) => {
      res.writeHead(200);
      res.end('Worker alive');
    }).listen(keepAlivePort, () => {
      console.log(`Worker keep-alive server on port ${keepAlivePort}`);
    });
  } catch (error) {
    logger.error(`Worker startup failed: ${error.message}`);
    process.exit(1);
  }
};

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down worker gracefully');
  await jobImportQueue.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down worker gracefully');
  await jobImportQueue.close();
  process.exit(0);
});

if (require.main === module) {
  startWorker();
}

module.exports = { startWorker };
