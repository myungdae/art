const mongoose = require('mongoose');
require('dotenv').config();

async function resetRefundRequests() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');
    
    const Payment = require('./model/payment');
    
    // Find ernie's payments with pending refund requests
    const payments = await Payment.find({
      userId: mongoose.Types.ObjectId('68f83c28247ded1c7ff0a0d4'),
      'refundRequest.status': 'pending'
    });
    
    if (payments.length === 0) {
      console.log('ℹ️  No pending refund requests found');
      await mongoose.connection.close();
      return;
    }
    
    console.log(`🔍 Found ${payments.length} payment(s) with pending refund requests:\n`);
    
    for (const payment of payments) {
      console.log('💳 Payment ID:', payment.paymentId);
      console.log('   Amount: ₩' + payment.amount.toLocaleString('ko-KR'));
      console.log('   Refund Request Status:', payment.refundRequest.status);
      console.log('   Requested At:', payment.refundRequest.requestedAt);
      
      // Reset refund request
      payment.refundRequest = undefined;
      await payment.save();
      
      console.log('   ✅ Refund request reset\n');
    }
    
    console.log('🎉 All refund requests have been reset');
    console.log('👉 You can now test refund requests again');
    
    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await mongoose.connection.close();
    process.exit(1);
  }
}

resetRefundRequests();
