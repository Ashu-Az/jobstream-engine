const ImportLog = require('../models/ImportLog');
const JobFeed = require('../models/JobFeed');
const { addJobToQueue, getQueueStats } = require('../queues/jobQueue');
const cronService = require('../services/cronService');
const logger = require('../utils/logger');

const getImportHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, fileName } = req.query;

    const query = {};
    if (status) query.status = status;
    if (fileName) query.fileName = { $regex: fileName, $options: 'i' };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [logs, total] = await Promise.all([
      ImportLog.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      ImportLog.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: logs,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    logger.error(`Error fetching import history: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch import history',
    });
  }
};

const getImportById = async (req, res) => {
  try {
    const { id } = req.params;

    const log = await ImportLog.findById(id);

    if (!log) {
      return res.status(404).json({
        success: false,
        error: 'Import log not found',
      });
    }

    res.json({
      success: true,
      data: log,
    });
  } catch (error) {
    logger.error(`Error fetching import log: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch import log',
    });
  }
};

const triggerImport = async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required',
      });
    }

    const job = await addJobToQueue(url);

    res.json({
      success: true,
      message: 'Import job added to queue',
      jobId: job.id,
    });
  } catch (error) {
    logger.error(`Error triggering import: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger import',
    });
  }
};

const triggerBulkImport = async (req, res) => {
  try {
    await cronService.triggerManualFetch();

    res.json({
      success: true,
      message: 'Bulk import triggered successfully',
    });
  } catch (error) {
    logger.error(`Error triggering bulk import: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger bulk import',
    });
  }
};

const getStats = async (req, res) => {
  try {
    const [totalImports, recentImports, queueStats] = await Promise.all([
      ImportLog.countDocuments(),
      ImportLog.find()
        .sort({ timestamp: -1 })
        .limit(10)
        .select('fileName timestamp status totalImported newJobs updatedJobs failedJobs'),
      getQueueStats(),
    ]);

    const aggregateStats = await ImportLog.aggregate([
      {
        $group: {
          _id: null,
          totalFetched: { $sum: '$totalFetched' },
          totalImported: { $sum: '$totalImported' },
          totalNew: { $sum: '$newJobs' },
          totalUpdated: { $sum: '$updatedJobs' },
          totalFailed: { $sum: '$failedJobs' },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        imports: {
          total: totalImports,
          recent: recentImports,
        },
        aggregate: aggregateStats[0] || {},
        queue: queueStats,
      },
    });
  } catch (error) {
    logger.error(`Error fetching stats: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stats',
    });
  }
};

const getJobFeeds = async (req, res) => {
  try {
    const feeds = await JobFeed.find().sort({ createdAt: -1 });

    res.json({
      success: true,
      data: feeds,
    });
  } catch (error) {
    logger.error(`Error fetching job feeds: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch job feeds',
    });
  }
};

module.exports = {
  getImportHistory,
  getImportById,
  triggerImport,
  triggerBulkImport,
  getStats,
  getJobFeeds,
};
