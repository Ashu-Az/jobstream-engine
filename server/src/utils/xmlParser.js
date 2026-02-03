const xml2js = require('xml2js');
const logger = require('./logger');

const cleanXmlData = (xmlData) => {
  if (typeof xmlData !== 'string') return xmlData;

  // Remove problematic attributes without values
  let cleaned = xmlData.replace(/(\w+)=\s*>/g, '>');

  // Remove empty attributes
  cleaned = cleaned.replace(/\s+\w+=""\s*/g, ' ');

  // Fix unclosed CDATA sections
  cleaned = cleaned.replace(/<!\[CDATA\[(?!.*\]\]>)/g, '<![CDATA[]]>');

  // Remove invalid control characters
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

  return cleaned;
};

const parseXmlToJson = async (xmlData) => {
  try {
    // Clean the XML data first
    const cleanedXml = cleanXmlData(xmlData);

    const parser = new xml2js.Parser({
      explicitArray: false,
      mergeAttrs: true,
      trim: true,
      normalize: true,
      normalizeTags: true,
      explicitRoot: false,
      strict: false,
      attrkey: 'attributes',
      charkey: 'value',
      ignoreAttrs: false,
      emptyTag: null,
    });

    const result = await parser.parseStringPromise(cleanedXml);
    return result;
  } catch (error) {
    logger.error(`XML parsing error: ${error.message}`);

    // Try one more time with even more lenient settings
    try {
      const veryLenientParser = new xml2js.Parser({
        explicitArray: false,
        ignoreAttrs: true,
        strict: false,
        explicitRoot: false,
      });

      const cleaned = xmlData.replace(/<[^>]*>/g, (match) => {
        return match.replace(/(\w+)=(?!\s*["'])/g, '$1=""');
      });

      const result = await veryLenientParser.parseStringPromise(cleaned);
      logger.info('Successfully parsed XML with lenient parser');
      return result;
    } catch (fallbackError) {
      throw new Error(`Failed to parse XML: ${error.message}`);
    }
  }
};

const extractJobsFromFeed = (parsedData) => {
  try {
    if (!parsedData) {
      return [];
    }

    let items = [];

    if (parsedData.channel && parsedData.channel.item) {
      items = Array.isArray(parsedData.channel.item)
        ? parsedData.channel.item
        : [parsedData.channel.item];
    } else if (parsedData.item) {
      items = Array.isArray(parsedData.item) ? parsedData.item : [parsedData.item];
    } else if (Array.isArray(parsedData)) {
      items = parsedData;
    }

    return items;
  } catch (error) {
    logger.error(`Error extracting jobs from feed: ${error.message}`);
    return [];
  }
};

module.exports = {
  parseXmlToJson,
  extractJobsFromFeed,
};
