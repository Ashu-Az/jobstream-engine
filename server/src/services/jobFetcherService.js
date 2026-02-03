const axios = require('axios');
const logger = require('../utils/logger');
const { parseXmlToJson, extractJobsFromFeed } = require('../utils/xmlParser');
const { transformJobData } = require('../utils/jobTransformer');

class JobFetcherService {
  constructor() {
    this.timeout = parseInt(process.env.REQUEST_TIMEOUT) || 30000;
    this.maxRetries = 3;
  }

  async fetchJobsFromUrl(url, retryCount = 0) {
    try {
      logger.info(`Fetching jobs from: ${url}`);

      const response = await axios.get(url, {
        timeout: this.timeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; JobImporter/1.0)',
        },
      });

      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const xmlData = response.data;
      const parsedData = await parseXmlToJson(xmlData);
      const jobItems = extractJobsFromFeed(parsedData);

      logger.info(`Fetched ${jobItems.length} jobs from ${url}`);

      const transformedJobs = jobItems
        .map((job) => {
          try {
            return transformJobData(job, url);
          } catch (error) {
            logger.warn(`Failed to transform job: ${error.message}`);
            return null;
          }
        })
        .filter((job) => job !== null);

      return {
        success: true,
        url,
        jobs: transformedJobs,
        totalFetched: transformedJobs.length,
      };
    } catch (error) {
      logger.error(`Error fetching jobs from ${url}: ${error.message}`);

      // Don't retry on XML parsing errors - they won't be fixed by retrying
      const isParsingError = error.message.includes('parse') || error.message.includes('XML');

      if (!isParsingError && retryCount < this.maxRetries) {
        logger.info(`Retrying... Attempt ${retryCount + 1} of ${this.maxRetries}`);
        await this.delay(Math.pow(2, retryCount) * 1000);
        return this.fetchJobsFromUrl(url, retryCount + 1);
      }

      if (isParsingError) {
        logger.warn(`Skipping retry for parsing error from ${url}`);
      }

      return {
        success: false,
        url,
        jobs: [],
        totalFetched: 0,
        error: error.message,
      };
    }
  }

  async fetchFromMultipleSources(urls) {
    const results = await Promise.allSettled(
      urls.map((url) => this.fetchJobsFromUrl(url))
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        logger.error(`Failed to fetch from ${urls[index]}: ${result.reason}`);
        return {
          success: false,
          url: urls[index],
          jobs: [],
          totalFetched: 0,
          error: result.reason.message,
        };
      }
    });
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = new JobFetcherService();
