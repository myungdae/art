// utils/threadLog.js
const Thread = require('../model/thread');

function asString(v, fallback = '') {
  if (v === null || v === undefined) return fallback;
  return typeof v === 'string' ? v : String(v);
}

/**
 * Log an activity into the 'threads' collection.
 * Safe to call inside request handlers; failures won't crash the request.
 *
 * @param {import('express').Request} req
 * @param {{
 *   type?: string,
 *   action: string,
 *   source: string,
 *   sourceId?: string,
 *   title?: string,
 *   summary?: string,
 *   meta?: object
 * }} payload
 */
async function logThread(req, payload) {
  try {
    const u = (req && req.session && req.session.user) || {};
    await Thread.create({
      type:    payload.type || 'activity',
      action:  asString(payload.action),
      source:  asString(payload.source),
      sourceId: asString(payload.sourceId || ''),
      title:   asString(payload.title || ''),
      summary: asString(payload.summary || ''),
      userId:    asString(u._id || ''),
      userEmail: asString(u.email || ''),
      userName:  asString(u.name || u.username || ''),
      meta: payload.meta || {},
    });
  } catch (e) {
    // Do not throw; just log
    console.error('[threadLog] failed:', e.message || e);
  }
}

module.exports = { logThread };
