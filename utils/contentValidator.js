// utils/contentValidator.js
'use strict';

/**
 * Validates content to ensure it only contains English characters and standard punctuation
 * Detects and rejects: Korean, Chinese, Japanese, Emojis, excessive special characters
 */

function containsNonEnglish(text) {
  if (!text || typeof text !== 'string') return null;

  // Unicode ranges for non-English scripts
  const nonEnglishRegex = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf\uac00-\ud7a3]|[\u{1F300}-\u{1F9FF}]|[\u2600-\u27BF]/u;
  
  // Detect non-English characters (CJK, emojis)
  if (nonEnglishRegex.test(text)) {
    return 'Non-English characters detected (Korean, Chinese, Japanese, or emojis)';
  }

  // Detect excessive special characters (beyond standard punctuation)
  const excessiveSpecialChars = /[^a-zA-Z0-9\s.,!?;:()\-'"\/&%$@#+=\n\r]/g;
  const matches = text.match(excessiveSpecialChars) || [];
  const specialCharCount = matches.length;
  
  if (specialCharCount > text.length * 0.15) {
    return `Excessive special characters detected (${specialCharCount} unusual characters found)`;
  }

  return null;
}

/**
 * Validates multiple fields in a payload
 * @param {Object} payload - Object containing fields to validate
 * @param {Array<string>} fields - Array of field names to validate
 * @returns {Object} - Object with field names as keys and error messages as values
 */
function validateFields(payload, fields) {
  const errors = {};

  fields.forEach(field => {
    const value = payload[field];
    if (value && typeof value === 'string') {
      const error = containsNonEnglish(value);
      if (error) {
        errors[field] = error;
      }
    }
  });

  return errors;
}

/**
 * Sanitizes HTML content by stripping tags and validating text
 * @param {string} html - HTML content to validate
 * @returns {string|null} - Error message or null if valid
 */
function validateHtmlContent(html) {
  if (!html) return null;
  
  // Strip HTML tags to get plain text
  const plainText = html.replace(/<[^>]*>/g, '');
  return containsNonEnglish(plainText);
}

module.exports = {
  containsNonEnglish,
  validateFields,
  validateHtmlContent
};
