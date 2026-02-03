const Job = require('../models/Job');
const ImportLog = require('../models/ImportLog');
const logger = require('../utils/logger');
const { validateJobData } = require('../utils/jobTransformer');

class JobImportService {
  constructor() {
    this.batchSize = parseInt(process.env.BATCH_SIZE) || 100;
  }

  async importJobs(jobs, source, importLogId) {
    const stats = {
      totalFetched: jobs.length,
      totalImported: 0,
      newJobs: 0,
      updatedJobs: 0,
      failedJobs: 0,
      failedJobsDetails: [],
    };

    logger.info(`Starting import of ${jobs.length} jobs from ${source}`);

    for (let i = 0; i < jobs.length; i += this.batchSize) {
      const batch = jobs.slice(i, i + this.batchSize);
      const batchResults = await this.processBatch(batch);

      stats.newJobs += batchResults.newJobs;
      stats.updatedJobs += batchResults.updatedJobs;
      stats.failedJobs += batchResults.failedJobs;
      stats.failedJobsDetails.push(...batchResults.failedJobsDetails);

      await this.updateImportLog(importLogId, {
        newJobs: stats.newJobs,
        updatedJobs: stats.updatedJobs,
        failedJobs: stats.failedJobs,
      });

      logger.info(
        `Processed batch ${Math.floor(i / this.batchSize) + 1}: ` +
          `${batchResults.newJobs} new, ${batchResults.updatedJobs} updated, ` +
          `${batchResults.failedJobs} failed`
      );
    }

    stats.totalImported = stats.newJobs + stats.updatedJobs;

    logger.info(
      `Import completed: ${stats.totalImported} imported, ${stats.failedJobs} failed`
    );

    return stats;
  }

  async processBatch(jobs) {
    const results = {
      newJobs: 0,
      updatedJobs: 0,
      failedJobs: 0,
      failedJobsDetails: [],
    };

    const operations = jobs.map(async (job) => {
      try {
        const validation = validateJobData(job);
        if (!validation.isValid) {
          throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
        }

        const existing = await Job.findOne({ jobId: job.jobId });

        if (existing) {
          const hasChanges = this.hasSignificantChanges(existing, job);
          if (hasChanges) {
            await Job.updateOne({ jobId: job.jobId }, { $set: job });
            results.updatedJobs++;
          }
        } else {
          await Job.create(job);
          results.newJobs++;
        }
      } catch (error) {
        results.failedJobs++;
        results.failedJobsDetails.push({
          jobId: job.jobId || 'unknown',
          reason: error.message,
          error: error.stack,
          data: job,
        });
        logger.error(`Failed to import job ${job.jobId}: ${error.message}`);
      }
    });

    await Promise.all(operations);
    return results;
  }

  hasSignificantChanges(existing, newJob) {
    const fieldsToCompare = ['title', 'description', 'location', 'company', 'jobType'];

    return fieldsToCompare.some((field) => {
      const existingValue = String(existing[field] || '').trim();
      const newValue = String(newJob[field] || '').trim();
      return existingValue !== newValue;
    });
  }

  async updateImportLog(importLogId, updates) {
    try {
      await ImportLog.findByIdAndUpdate(importLogId, { $set: updates });
    } catch (error) {
      logger.error(`Failed to update import log: ${error.message}`);
    }
  }

  async createImportLog(fileName) {
    try {
      const log = await ImportLog.create({
        fileName,
        status: 'processing',
        startTime: new Date(),
      });
      return log._id;
    } catch (error) {
      logger.error(`Failed to create import log: ${error.message}`);
      throw error;
    }
  }

  async finalizeImportLog(importLogId, stats, status = 'completed', error = null) {
    try {
      const updates = {
        status,
        ...stats,
        endTime: new Date(),
        error,
      };

      const log = await ImportLog.findById(importLogId);
      if (log && log.startTime) {
        updates.duration = new Date() - log.startTime;
      }

      await ImportLog.findByIdAndUpdate(importLogId, { $set: updates });
    } catch (error) {
      logger.error(`Failed to finalize import log: ${error.message}`);
    }
  }
}

module.exports = new JobImportService();
