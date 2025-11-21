const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  // Payment Identification
  paymentId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  merchantUid: {
    type: String,
    required: true,
    index: true
  },
  
  // User Information
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  userEmail: {
    type: String,
    required: true
  },
  userRole: {
    type: String,
    enum: ['Employer', 'Job_Seeker', 'Online_Tutor'],
    required: true
  },
  
  // Payment Details
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'KRW'
  },
  paymentMethod: {
    type: String, // EASY_PAY, CARD, etc.
    required: true
  },
  
  // Package/Product Information
  packageType: {
    type: String, // 'job_ads', 'resume_access', 'tutor_access'
    required: true,
    index: true
  },
  packageDetails: {
    quantity: Number, // For job ads: number of ads
    duration: Number, // For access: duration in days
    description: String
  },
  
  // Payment Status
  status: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'cancelled', 'refunded'],
    default: 'pending',
    index: true
  },
  
  // Gateway Information (PortOne/Iamport)
  gatewayResponse: {
    type: mongoose.Schema.Types.Mixed // Store full gateway response
  },
  
  // Timestamps
  paidAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  
  // Additional Notes
  notes: {
    type: String
  },
  
  // Refund Information
  refundInfo: {
    refundedAt: Date,
    refundAmount: Number,
    refundReason: String
  }
});

// Update timestamps on save
paymentSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Indexes for performance
paymentSchema.index({ createdAt: -1 });
paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
