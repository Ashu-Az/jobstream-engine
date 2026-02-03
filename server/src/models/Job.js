const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema(
  {
    jobId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      index: true,
    },
    company: {
      type: String,
      index: true,
    },
    location: {
      type: String,
      index: true,
    },
    description: {
      type: String,
    },
    url: {
      type: String,
      required: true,
    },
    publishedDate: {
      type: Date,
      index: true,
    },
    jobType: {
      type: String,
      index: true,
    },
    category: {
      type: String,
      index: true,
    },
    region: {
      type: String,
    },
    salary: {
      type: String,
    },
    source: {
      type: String,
      required: true,
      index: true,
    },
    rawData: {
      type: mongoose.Schema.Types.Mixed,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

jobSchema.index({ title: 'text', description: 'text' });
jobSchema.index({ createdAt: -1 });
jobSchema.index({ source: 1, jobId: 1 });

module.exports = mongoose.model('Job', jobSchema);
