const mongoose = require('mongoose');
require('dotenv').config();

async function clearRefundRequests() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Use direct MongoDB operation
    const db = mongoose.connection.db;
    const paymentsCollection = db.collection('payments');
    
    // Find ernie's payments
    const ernieUserId = mongoose.Types.ObjectId('68f83c28247ded1c7ff0a0d4');
    
    const payments = await paymentsCollection.find({ userId: ernieUserId }).toArray();
    
    console.log(`🔍 Found ${payments.length} payment(s) for ernie:\n`);
    
    let cleared = 0;
    for (const payment of payments) {
      console.log('💳 Payment ID:', payment.paymentId);
      console.log('   Amount: ₩' + payment.amount.toLocaleString('ko-KR'));
      console.log('   Refund Request:', payment.refundRequest ? 'EXISTS' : 'NONE');
      
      if (payment.refundRequest) {
        // Clear refundRequest field
        await paymentsCollection.updateOne(
          { _id: payment._id },
          { $unset: { refundRequest: "" } }
        );
        console.log('   ✅ Cleared refund request');
        cleared++;
      }
      
      console.log('');
    }
    
    if (cleared > 0) {
      console.log(`🎉 Successfully cleared ${cleared} refund request(s)`);
      console.log('👉 You can now test refund requests again on MyPage');
    } else {
      console.log('ℹ️  No refund requests to clear');
    }
    
    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    await mongoose.connection.close();
    process.exit(1);
  }
}

clearRefundRequests();
