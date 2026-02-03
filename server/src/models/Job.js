const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema(
  {
    jobId: {
      type: String,
      required: true,
      unique: true,
    },
    title: {
      type: String,
      required: true,
    },
    company: {
      type: String,
    },
    location: {
      type: String,
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
    },
    jobType: {
      type: String,
    },
    category: {
      type: String,
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
    },
    rawData: {
      type: mongoose.Schema.Types.Mixed,
    },
    isActive: {
      type: Boolean,
      default: true,
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
