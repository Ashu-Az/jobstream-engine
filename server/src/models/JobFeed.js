const mongoose = require('mongoose');

const jobFeedSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
    },
    category: {
      type: String,
    },
    jobType: {
      type: String,
    },
    region: {
      type: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastFetchedAt: {
      type: Date,
    },
    lastFetchStatus: {
      type: String,
      enum: ['success', 'failed', 'pending'],
    },
    lastError: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('JobFeed', jobFeedSchema);
