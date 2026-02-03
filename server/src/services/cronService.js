const cron = require('node-cron');
const JobFeed = require('../models/JobFeed');
const { addBulkJobsToQueue } = require('../queues/jobQueue');
const logger = require('../utils/logger');

class CronService {
  constructor() {
    this.cronSchedule = process.env.CRON_SCHEDULE || '0 * * * *';
    this.isRunning = false;
    this.task = null;
  }

  async initializeJobFeeds() {
    try {
      const feeds = [
        {
          url: 'https://jobicy.com/?feed=job_feed',
          name: 'Jobicy - All Jobs',
          category: 'all',
        },
        {
          url: 'https://jobicy.com/?feed=job_feed&job_categories=smm&job_types=full-time',
          name: 'Jobicy - Social Media Marketing',
          category: 'smm',
          jobType: 'full-time',
        },
        {
          url: 'https://jobicy.com/?feed=job_feed&job_categories=seller&job_types=full-time&search_region=france',
          name: 'Jobicy - Seller (France)',
          category: 'seller',
          jobType: 'full-time',
          region: 'france',
        },
        {
          url: 'https://jobicy.com/?feed=job_feed&job_categories=design-multimedia',
          name: 'Jobicy - Design & Multimedia',
          category: 'design-multimedia',
        },
        {
          url: 'https://jobicy.com/?feed=job_feed&job_categories=data-science',
          name: 'Jobicy - Data Science',
          category: 'data-science',
        },
        {
          url: 'https://jobicy.com/?feed=job_feed&job_categories=copywriting',
          name: 'Jobicy - Copywriting',
          category: 'copywriting',
        },
        {
          url: 'https://jobicy.com/?feed=job_feed&job_categories=business',
          name: 'Jobicy - Business',
          category: 'business',
        },
        {
          url: 'https://jobicy.com/?feed=job_feed&job_categories=management',
          name: 'Jobicy - Management',
          category: 'management',
        },
        // Temporarily disabled due to malformed XML
        // {
        //   url: 'https://www.higheredjobs.com/rss/articleFeed.cfm',
        //   name: 'HigherEdJobs',
        //   category: 'education',
        //   isActive: false,
        // },
      ];

      for (const feed of feeds) {
        await JobFeed.findOneAndUpdate(
          { url: feed.url },
          { $set: feed },
          { upsert: true }
        );
      }

      logger.info(`Initialized ${feeds.length} job feeds`);
    } catch (error) {
      logger.error(`Failed to initialize job feeds: ${error.message}`);
    }
  }

  async fetchAndQueueJobs() {
    if (this.isRunning) {
      logger.warn('Cron job already running, skipping this execution');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      logger.info('Starting scheduled job fetch');

      let activeFeeds = await JobFeed.find({ isActive: true });

      if (activeFeeds.length === 0) {
        logger.warn('No active feeds found. Initializing feeds...');
        await this.initializeJobFeeds();
        activeFeeds = await JobFeed.find({ isActive: true });

        if (activeFeeds.length === 0) {
          logger.error('Failed to initialize feeds');
          return;
        }
        logger.info(`Auto-initialized ${activeFeeds.length} feeds`);
      }

      const urls = activeFeeds.map((feed) => feed.url);
      await addBulkJobsToQueue(urls);

      await Promise.all(
        activeFeeds.map((feed) =>
          JobFeed.findByIdAndUpdate(feed._id, {
            lastFetchedAt: new Date(),
            lastFetchStatus: 'pending',
          })
        )
      );

      const duration = Date.now() - startTime;
      logger.info(`Scheduled fetch completed in ${duration}ms. Queued ${urls.length} feeds.`);
    } catch (error) {
      logger.error(`Cron job failed: ${error.message}`);
    } finally {
      this.isRunning = false;
    }
  }

  start() {
    if (this.task) {
      logger.warn('Cron service already started');
      return;
    }

    logger.info(`Starting cron service with schedule: ${this.cronSchedule}`);

    this.task = cron.schedule(this.cronSchedule, async () => {
      await this.fetchAndQueueJobs();
    });

    logger.info('Cron service started successfully');
  }

  stop() {
    if (this.task) {
      this.task.stop();
      this.task = null;
      logger.info('Cron service stopped');
    }
  }

  async triggerManualFetch() {
    logger.info('Manual fetch triggered');
    await this.fetchAndQueueJobs();
  }
}

module.exports = new CronService();
