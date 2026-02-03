const mongoose = require('mongoose');

const failedJobSchema = new mongoose.Schema(
  {
    jobId: String,
    reason: String,
    error: String,
    data: mongoose.Schema.Types.Mixed,
  },
  { _id: false }
);

const importLogSchema = new mongoose.Schema(
  {
    fileName: {
      type: String,
      required: true,
      index: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },
    totalFetched: {
      type: Number,
      default: 0,
    },
    totalImported: {
      type: Number,
      default: 0,
    },
    newJobs: {
      type: Number,
      default: 0,
    },
    updatedJobs: {
      type: Number,
      default: 0,
    },
    failedJobs: {
      type: Number,
      default: 0,
    },
    failedJobsDetails: [failedJobSchema],
    duration: {
      type: Number,
    },
    startTime: {
      type: Date,
    },
    endTime: {
      type: Date,
    },
    error: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

importLogSchema.index({ timestamp: -1 });
importLogSchema.index({ status: 1, timestamp: -1 });

module.exports = mongoose.model('ImportLog', importLogSchema);
