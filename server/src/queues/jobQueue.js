const Queue = require('bull');
const logger = require('../utils/logger');

const redisConfig = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
  },
};

const jobImportQueue = new Queue('job-import', redisConfig);

jobImportQueue.on('error', (error) => {
  logger.error(`Queue error: ${error.message}`);
});

jobImportQueue.on('failed', (job, err) => {
  logger.error(`Job ${job.id} failed: ${err.message}`);
});

jobImportQueue.on('completed', (job) => {
  logger.info(`Job ${job.id} completed successfully`);
});

jobImportQueue.on('stalled', (job) => {
  logger.warn(`Job ${job.id} stalled`);
});

const addJobToQueue = async (url, options = {}) => {
  try {
    const job = await jobImportQueue.add(
      {
        url,
        timestamp: Date.now(),
      },
      {
        attempts: parseInt(process.env.MAX_RETRY_ATTEMPTS) || 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 200,
        ...options,
      }
    );

    logger.info(`Added job ${job.id} to queue for URL: ${url}`);
    return job;
  } catch (error) {
    logger.error(`Failed to add job to queue: ${error.message}`);
    throw error;
  }
};

const addBulkJobsToQueue = async (urls) => {
  try {
    const jobs = urls.map((url) => ({
      data: {
        url,
        timestamp: Date.now(),
      },
      opts: {
        attempts: parseInt(process.env.MAX_RETRY_ATTEMPTS) || 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    }));

    const result = await jobImportQueue.addBulk(jobs);
    logger.info(`Added ${result.length} jobs to queue`);
    return result;
  } catch (error) {
    logger.error(`Failed to add bulk jobs to queue: ${error.message}`);
    throw error;
  }
};

const getQueueStats = async () => {
  try {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      jobImportQueue.getWaitingCount(),
      jobImportQueue.getActiveCount(),
      jobImportQueue.getCompletedCount(),
      jobImportQueue.getFailedCount(),
      jobImportQueue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed,
    };
  } catch (error) {
    logger.error(`Failed to get queue stats: ${error.message}`);
    throw error;
  }
};

const clearQueue = async () => {
  try {
    await jobImportQueue.clean(0, 'completed');
    await jobImportQueue.clean(0, 'failed');
    logger.info('Queue cleared');
  } catch (error) {
    logger.error(`Failed to clear queue: ${error.message}`);
    throw error;
  }
};

module.exports = {
  jobImportQueue,
  addJobToQueue,
  addBulkJobsToQueue,
  getQueueStats,
  clearQueue,
};
