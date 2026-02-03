/**
 * Sample test file for jobTransformer utility
 * Run with: npm test
 */

const { transformJobData, validateJobData } = require('../jobTransformer');

describe('jobTransformer', () => {
  describe('transformJobData', () => {
    it('should transform raw job data correctly', () => {
      const rawJob = {
        guid: 'test-123',
        title: 'Software Engineer',
        company: 'Tech Corp',
        location: 'Remote',
        description: 'Great opportunity',
        link: 'https://example.com/job',
        pubdate: '2024-01-01',
      };

      const source = 'https://jobicy.com/?feed=job_feed';
      const result = transformJobData(rawJob, source);

      expect(result).toHaveProperty('jobId', 'test-123');
      expect(result).toHaveProperty('title', 'Software Engineer');
      expect(result).toHaveProperty('company', 'Tech Corp');
      expect(result).toHaveProperty('source', source);
      expect(result).toHaveProperty('isActive', true);
    });

    it('should handle missing fields with defaults', () => {
      const rawJob = {
        guid: 'test-456',
        link: 'https://example.com/job2',
      };

      const source = 'https://jobicy.com/?feed=job_feed';
      const result = transformJobData(rawJob, source);

      expect(result.title).toBe('Untitled Position');
      expect(result.company).toBe('Unknown');
      expect(result.location).toBe('Remote');
    });

    it('should clean HTML from description', () => {
      const rawJob = {
        guid: 'test-789',
        title: 'Developer',
        description: '<p>Great <strong>opportunity</strong> &nbsp; here</p>',
        link: 'https://example.com/job3',
      };

      const source = 'https://jobicy.com/?feed=job_feed';
      const result = transformJobData(rawJob, source);

      expect(result.description).not.toContain('<p>');
      expect(result.description).not.toContain('&nbsp;');
      expect(result.description).toContain('Great opportunity here');
    });
  });

  describe('validateJobData', () => {
    it('should validate correct job data', () => {
      const job = {
        jobId: 'test-123',
        title: 'Software Engineer',
        url: 'https://example.com/job',
        source: 'https://jobicy.com/?feed=job_feed',
      };

      const result = validateJobData(job);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors for missing required fields', () => {
      const job = {
        jobId: '',
        title: 'Software Engineer',
      };

      const result = validateJobData(job);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('jobId is required');
      expect(result.errors).toContain('url is required');
      expect(result.errors).toContain('source is required');
    });
  });
});
