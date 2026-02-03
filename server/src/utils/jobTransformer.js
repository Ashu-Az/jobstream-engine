const crypto = require('crypto');

const generateJobId = (job) => {
  const identifier = `${job.link || job.url || ''}-${job.title || ''}-${
    job.pubdate || job.pubDate || ''
  }`;
  return crypto.createHash('md5').update(identifier).digest('hex');
};

const transformJobData = (rawJob, source) => {
  try {
    const jobId = rawJob.guid || rawJob.id || generateJobId(rawJob);

    const publishedDate =
      rawJob.pubdate ||
      rawJob.pubDate ||
      rawJob.published ||
      rawJob.publishedDate ||
      new Date();

    const transformed = {
      jobId: String(jobId).trim(),
      title: rawJob.title || 'Untitled Position',
      company: rawJob.company || rawJob['company_name'] || rawJob.organization || 'Unknown',
      location: rawJob.location || rawJob.region || rawJob.city || 'Remote',
      description: cleanDescription(
        rawJob.description ||
          rawJob['content:encoded'] ||
          rawJob.content ||
          rawJob.summary ||
          ''
      ),
      url: rawJob.link || rawJob.url || rawJob.guid || '',
      publishedDate: new Date(publishedDate),
      jobType:
        rawJob.job_type ||
        rawJob.jobType ||
        rawJob.type ||
        extractJobType(source) ||
        'Full-time',
      category:
        rawJob.category ||
        rawJob.categories ||
        rawJob.job_category ||
        extractCategory(source) ||
        'General',
      region: rawJob.region || rawJob.location || extractRegion(source) || '',
      salary: rawJob.salary || rawJob.compensation || '',
      source: source,
      rawData: rawJob,
      isActive: true,
    };

    return transformed;
  } catch (error) {
    throw new Error(`Job transformation failed: ${error.message}`);
  }
};

const cleanDescription = (description) => {
  if (!description) return '';

  return description
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 5000);
};

const extractJobType = (source) => {
  if (source.includes('full-time')) return 'Full-time';
  if (source.includes('part-time')) return 'Part-time';
  if (source.includes('contract')) return 'Contract';
  return 'Full-time';
};

const extractCategory = (source) => {
  const categoryMap = {
    smm: 'Social Media Marketing',
    seller: 'Sales',
    'design-multimedia': 'Design & Multimedia',
    'data-science': 'Data Science',
    copywriting: 'Copywriting',
    business: 'Business',
    management: 'Management',
  };

  for (const [key, value] of Object.entries(categoryMap)) {
    if (source.includes(key)) return value;
  }

  return 'General';
};

const extractRegion = (source) => {
  if (source.includes('france')) return 'France';
  if (source.includes('usa')) return 'USA';
  if (source.includes('uk')) return 'UK';
  return '';
};

const validateJobData = (job) => {
  const errors = [];

  if (!job.jobId || job.jobId.trim() === '') {
    errors.push('jobId is required');
  }

  if (!job.title || job.title.trim() === '') {
    errors.push('title is required');
  }

  if (!job.url || job.url.trim() === '') {
    errors.push('url is required');
  }

  if (!job.source || job.source.trim() === '') {
    errors.push('source is required');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

module.exports = {
  transformJobData,
  validateJobData,
  generateJobId,
};
