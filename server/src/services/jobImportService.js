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

    let batchIndex = 0;
    for (let i = 0; i < jobs.length; i += this.batchSize) {
      const batch = jobs.slice(i, i + this.batchSize);
      const batchResults = await this.processBatch(batch);

      stats.newJobs += batchResults.newJobs;
      stats.updatedJobs += batchResults.updatedJobs;
      stats.failedJobs += batchResults.failedJobs;
      stats.failedJobsDetails.push(...batchResults.failedJobsDetails);

      batchIndex++;
      // Write to DB every 10 batches instead of every batch.
      // At 1M jobs / 100 per batch that would be 10,000 log updates otherwise.
      if (batchIndex % 10 === 0) {
        await this.updateImportLog(importLogId, {
          newJobs: stats.newJobs,
          updatedJobs: stats.updatedJobs,
          failedJobs: stats.failedJobs,
        });
      }

      logger.info(
        `Processed batch ${batchIndex}: ` +
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

    // Validate first — collect valid jobs and record failures separately
    const validJobs = [];
    for (const job of jobs) {
      const validation = validateJobData(job);
      if (!validation.isValid) {
        results.failedJobs++;
        results.failedJobsDetails.push({
          jobId: job.jobId || 'unknown',
          reason: `Validation failed: ${validation.errors.join(', ')}`,
          data: job,
        });
        logger.error(`Validation failed for job ${job.jobId}: ${validation.errors.join(', ')}`);
      } else {
        validJobs.push(job);
      }
    }

    if (validJobs.length === 0) return results;

    try {
      // Single bulkWrite with upsert — one round-trip to MongoDB per batch,
      // no race condition on duplicate jobIds.
      const operations = validJobs.map((job) => ({
        updateOne: {
          filter: { jobId: job.jobId },
          update: { $set: job },
          upsert: true,
        },
      }));

      const bulkResult = await Job.bulkWrite(operations, { ordered: false });

      results.newJobs = bulkResult.upsertedCount || 0;
      results.updatedJobs = bulkResult.modifiedCount || 0;
    } catch (error) {
      // If bulkWrite itself throws (e.g. connection error), mark all as failed
      results.failedJobs += validJobs.length;
      results.failedJobsDetails.push({
        jobId: 'batch',
        reason: `bulkWrite error: ${error.message}`,
        error: error.stack,
      });
      logger.error(`Batch bulkWrite failed: ${error.message}`);
    }

    return results;
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

  async finalizeImportLog(importLogId, stats, status = 'completed', importError = null) {
    try {
      const updates = {
        status,
        ...stats,
        endTime: new Date(),
        error: importError,
      };

      const log = await ImportLog.findById(importLogId);
      if (log && log.startTime) {
        updates.duration = new Date() - log.startTime;
      }

      await ImportLog.findByIdAndUpdate(importLogId, { $set: updates });
    } catch (err) {
      logger.error(`Failed to finalize import log: ${err.message}`);
    }
  }
}

module.exports = new JobImportService();
