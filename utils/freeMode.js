// utils/freeMode.js
'use strict';

const FREE_UNTIL = process.env.FREE_UNTIL ? new Date(process.env.FREE_UNTIL) : null;

function isFreeWindowOpen() {
  return FREE_UNTIL ? Date.now() <= FREE_UNTIL.getTime() : false;
}

// helpers for durations
function days(n) { return n * 24 * 60 * 60 * 1000; }
function addDays(d, n) { return new Date(d.getTime() + days(n)); }

// configurable defaults (can be overridden via .env)
const CFG = {
  employerQuota: Number(process.env.FREE_QUOTA_EMPLOYER || 1),   // free postings for employers
  seekerDays:    Number(process.env.FREE_DURATION_SEEKER_DAYS || 90), // free listing days
  tutorDays:     Number(process.env.FREE_DURATION_TUTOR_DAYS  || 90), // free listing days
};

module.exports = { isFreeWindowOpen, FREE_UNTIL, addDays, CFG };
