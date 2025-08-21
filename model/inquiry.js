// model/inquiry.js
const mongoose = require('mongoose');

const InquirySchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true, maxlength: 100 },
    email:       { type: String, required: true, trim: true, lowercase: true, maxlength: 200 },
    subject:     { type: String, required: true, trim: true, maxlength: 200 },
    message:     { type: String, required: true, trim: true, maxlength: 5000 },
    userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // 로그인 유저면 저장
    userAgent:   { type: String, default: '' },
    ip:          { type: String, default: '' },
    status:      { type: String, enum: ['new','read','closed'], default: 'new' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Inquiry', InquirySchema);
