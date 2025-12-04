const mongoose = require('mongoose');
require('dotenv').config();

async function forceClearRefund() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Use direct MongoDB operation to ensure no caching
    const db = mongoose.connection.db;
    const paymentsCollection = db.collection('payments');
    
    const paymentId1 = 'employer_1_68f83c28_1733315000000';
    const paymentId2 = 'employer_1_68f83c28_1764827821146';
    
    console.log('🔍 Checking current state before clearing...\n');
    
    const payment1 = await paymentsCollection.findOne({ paymentId: paymentId1 });
    const payment2 = await paymentsCollection.findOne({ paymentId: paymentId2 });
    
    console.log('💳 Payment 1 (₩1,000):');
    console.log('   Payment ID:', payment1?.paymentId);
    console.log('   Refund Request:', payment1?.refundRequest ? JSON.stringify(payment1.refundRequest) : 'NONE');
    console.log('');
    
    console.log('💳 Payment 2 (₩39,000):');
    console.log('   Payment ID:', payment2?.paymentId);
    console.log('   Refund Request:', payment2?.refundRequest ? JSON.stringify(payment2.refundRequest) : 'NONE');
    console.log('');
    
    // Force clear using updateMany
    const result = await paymentsCollection.updateMany(
      { 
        paymentId: { $in: [paymentId1, paymentId2] }
      },
      { 
        $unset: { refundRequest: "" } 
      }
    );
    
    console.log('🔧 Force clearing refundRequest fields...');
    console.log('   Matched:', result.matchedCount);
    console.log('   Modified:', result.modifiedCount);
    console.log('');
    
    // Verify after clearing
    console.log('✅ Verifying after clearing...\n');
    
    const verifyPayment1 = await paymentsCollection.findOne({ paymentId: paymentId1 });
    const verifyPayment2 = await paymentsCollection.findOne({ paymentId: paymentId2 });
    
    console.log('💳 Payment 1 (₩1,000):');
    console.log('   Refund Request:', verifyPayment1?.refundRequest ? JSON.stringify(verifyPayment1.refundRequest) : 'CLEARED ✅');
    console.log('');
    
    console.log('💳 Payment 2 (₩39,000):');
    console.log('   Refund Request:', verifyPayment2?.refundRequest ? JSON.stringify(verifyPayment2.refundRequest) : 'CLEARED ✅');
    console.log('');
    
    console.log('🎉 Refund requests force cleared!');
    console.log('👉 Now restart PM2: pm2 restart linked_esl_app');
    console.log('👉 Then try refund request again on MyPage');
    
    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    await mongoose.connection.close();
    process.exit(1);
  }
}

forceClearRefund();
