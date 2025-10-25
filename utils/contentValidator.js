// utils/contentValidator.js
'use strict';

/**
 * Validates content to ensure it only contains English characters and standard punctuation
 * Two validation modes:
 * 1. Strict (Title fields): Block emojis + non-English languages
 * 2. Permissive (Description fields): Block only non-English languages (emojis allowed)
 */

/**
 * For Title fields: Block emojis + non-English languages
 */
function containsNonEnglishWithEmoji(text) {
  if (!text || typeof text !== 'string') return null;

  // Unicode ranges for non-English scripts + emojis
  const nonEnglishRegex = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf\uac00-\ud7a3]|[\u{1F300}-\u{1F9FF}]|[\u2600-\u27BF]/u;
  
  if (nonEnglishRegex.test(text)) {
    return 'Non-English characters or emojis detected';
  }

  return null;
}

/**
 * For Description fields: Block only non-English languages (emojis allowed)
 */
function containsNonEnglishLanguagesOnly(text) {
  if (!text || typeof text !== 'string') return null;

  // Unicode ranges for CJK languages only (no emoji ranges)
  const languageRegex = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf\uac00-\ud7a3]/u;
  
  if (languageRegex.test(text)) {
    return 'Non-English characters detected (Korean, Chinese, or Japanese)';
  }

  return null;
}

/**
 * Legacy function for backward compatibility - uses strict mode
 * @deprecated Use containsNonEnglishWithEmoji or containsNonEnglishLanguagesOnly instead
 */
function containsNonEnglish(text) {
  return containsNonEnglishWithEmoji(text);
}

/**
 * Validates multiple fields in a payload (strict mode - no emojis)
 * Use for: Title, Company Name, Job Location, etc.
 * @param {Object} payload - Object containing fields to validate
 * @param {Array<string>} fields - Array of field names to validate
 * @returns {Object} - Object with field names as keys and error messages as values
 */
function validateFields(payload, fields) {
  const errors = {};

  fields.forEach(field => {
    const value = payload[field];
    if (value && typeof value === 'string') {
      // Use strict validation (no emojis allowed)
      const error = containsNonEnglishWithEmoji(value);
      if (error) {
        errors[field] = error;
      }
    }
  });

  return errors;
}

/**
 * Sanitizes HTML content by stripping tags and validating text (permissive mode)
 * Use for: Description fields where emojis should be allowed
 * @param {string} html - HTML content to validate
 * @returns {string|null} - Error message or null if valid
 */
function validateHtmlContent(html) {
  if (!html) return null;
  
  // Strip HTML tags to get plain text
  const plainText = html.replace(/<[^>]*>/g, '');
  
  // Use permissive validation (emojis allowed)
  return containsNonEnglishLanguagesOnly(plainText);
}

module.exports = {
  containsNonEnglish,              // Legacy - strict mode
  containsNonEnglishWithEmoji,     // Strict: no emojis (for Title fields)
  containsNonEnglishLanguagesOnly, // Permissive: emojis OK (for Description fields)
  validateFields,                  // Strict validation for text fields
  validateHtmlContent              // Permissive validation for HTML content
};
