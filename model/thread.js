// model/thread.js
const mongoose = require('mongoose');

const ThreadSchema = new mongoose.Schema(
  {
    // what happened
    type:   { type: String, default: 'activity' },   // 'activity' | 'crud' | 'auth' ...
    action: { type: String, required: true },        // 'login' | 'create' | 'update' | 'delete' ...
    source: { type: String, required: true },        // 'job_seekers' | 'online_tutors' | 'auth' ...
    sourceId: { type: String },                      // related document id (string)

    // summary
    title:   { type: String },                       // short title
    summary: { type: String },                       // human-readable summary

    // who did it
    userId:    { type: String },                     // session.user._id
    userEmail: { type: String },                     // session.user.email
    userName:  { type: String },                     // session.user.name/username

    // optional extra
    meta: { type: Object },
  },
  { timestamps: true, collection: 'threads' }
);

// helpful indexes
ThreadSchema.index({ userId: 1, createdAt: -1 });
ThreadSchema.index({ source: 1, sourceId: 1, createdAt: -1 });
ThreadSchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.models.Thread || mongoose.model('Thread', ThreadSchema);
