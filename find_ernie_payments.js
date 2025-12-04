const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./model/user');
const Payment = require('./model/payment');

async function findErniePayments() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Find ernie user
    const ernie = await User.findOne({ email: 'dudehdi@gmail.com' });
    
    if (!ernie) {
      console.log('❌ ernie user not found');
      await mongoose.connection.close();
      return;
    }
    
    console.log('👤 ernie user found:');
    console.log('   Email:', ernie.email);
    console.log('   Username:', ernie.username);
    console.log('   Role:', ernie.role);
    console.log('   User ID:', ernie._id);
    console.log('');
    
    // Find ALL payments for ernie
    const payments = await Payment.find({ userId: ernie._id }).sort({ paidAt: -1 });
    
    console.log(`💰 Found ${payments.length} payment(s) for ernie:\n`);
    
    if (payments.length === 0) {
      console.log('⚠️  No payments found in database!');
      console.log('   This could mean:');
      console.log('   1. Payment was made but not saved to database');
      console.log('   2. Payment is under different user ID');
      console.log('   3. Payment record was deleted');
    } else {
      payments.forEach((payment, idx) => {
        console.log(`${idx + 1}. Payment ID: ${payment.paymentId || payment._id}`);
        console.log(`   Merchant UID: ${payment.merchantUid}`);
        console.log(`   Amount: ₩${payment.amount?.toLocaleString('ko-KR')}`);
        console.log(`   Status: ${payment.status}`);
        console.log(`   Package: ${payment.packageType}`);
        console.log(`   Paid At: ${payment.paidAt}`);
        console.log(`   Created At: ${payment.createdAt}`);
        if (payment.refundRequest) {
          console.log(`   Refund Request: ${payment.refundRequest.status}`);
        }
        console.log('');
      });
      
      // Calculate total
      const total = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
      console.log(`📊 Total amount: ₩${total.toLocaleString('ko-KR')}`);
      console.log('');
    }
    
    // Search for 39000 payments (any user)
    console.log('🔍 Searching for ALL ₩39,000 payments (any user):\n');
    const all39000 = await Payment.find({ amount: 39000 }).sort({ paidAt: -1 });
    
    if (all39000.length > 0) {
      console.log(`Found ${all39000.length} payment(s) of ₩39,000:`);
      for (const payment of all39000) {
        const user = await User.findById(payment.userId);
        console.log(`  - Payment ID: ${payment.paymentId}`);
        console.log(`    User: ${user?.email} (${user?.username})`);
        console.log(`    Status: ${payment.status}`);
        console.log(`    Date: ${payment.paidAt}`);
        console.log('');
      }
    } else {
      console.log('❌ No ₩39,000 payments found in database\n');
    }
    
    // Search by payment date (recent)
    console.log('📅 Recent payments (last 30 days, all users):\n');
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentPayments = await Payment.find({
      paidAt: { $gte: thirtyDaysAgo }
    }).sort({ paidAt: -1 }).limit(20);
    
    console.log(`Found ${recentPayments.length} recent payment(s):`);
    for (const payment of recentPayments) {
      const user = await User.findById(payment.userId);
      console.log(`  ${payment.paidAt.toISOString().split('T')[0]} - ₩${payment.amount?.toLocaleString('ko-KR')} - ${user?.email} - ${payment.status}`);
    }
    
    await mongoose.connection.close();
    console.log('\n✅ Done');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

findErniePayments();
