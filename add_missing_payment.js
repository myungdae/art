const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./model/user');
const Payment = require('./model/payment');

async function addMissingPayment() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Find ernie
    const ernie = await User.findOne({ email: 'dudehdi@gmail.com' });
    
    if (!ernie) {
      console.log('❌ ernie user not found');
      await mongoose.connection.close();
      return;
    }
    
    console.log('👤 Found ernie:', ernie.email);
    console.log('   User ID:', ernie._id);
    console.log('   Current ads available:', ernie.adsAvailable || 0);
    console.log('');
    
    // Payment data from PortOne dashboard
    const uniqueOrderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const paymentData = {
      userId: ernie._id,
      userEmail: ernie.email,
      userRole: ernie.role,
      paymentId: 'employer_1_68f83c28_1764827821146',
      merchantUid: 'employer_1_68f83c28_1764827821146',
      orderId: uniqueOrderId, // Generate unique orderId
      amount: 39000,
      status: 'paid',
      packageType: 'job_ads',
      packageDetails: { quantity: 3 }, // 39000원 = 3개 광고
      paidAt: new Date('2025-12-04T14:58:20+09:00'),
      paymentMethod: 'card',
      createdAt: new Date('2025-12-04T14:58:20+09:00'),
      updatedAt: new Date()
    };
    
    // Check if already exists
    const existing = await Payment.findOne({ paymentId: paymentData.paymentId });
    
    if (existing) {
      console.log('⚠️  Payment already exists!');
      console.log('   Payment ID:', existing.paymentId);
      console.log('   Amount: ₩' + existing.amount.toLocaleString('ko-KR'));
      console.log('   User:', (await User.findById(existing.userId))?.email);
      console.log('');
      console.log('❌ Skipping - payment already in database');
      await mongoose.connection.close();
      return;
    }
    
    console.log('📋 Creating payment record:');
    console.log('   Payment ID:', paymentData.paymentId);
    console.log('   Amount: ₩' + paymentData.amount.toLocaleString('ko-KR'));
    console.log('   Package: 3 job ads');
    console.log('   Paid At:', paymentData.paidAt);
    console.log('');
    
    // Create payment
    const payment = await Payment.create(paymentData);
    console.log('✅ Payment record created in database');
    
    // Update ernie's ad credits
    ernie.adsAvailable = (ernie.adsAvailable || 0) + 3;
    await ernie.save();
    
    console.log('✅ Updated ernie ad credits');
    console.log('   Previous: ' + ((ernie.adsAvailable || 0) - 3));
    console.log('   Added: +3');
    console.log('   Total now: ' + ernie.adsAvailable);
    console.log('');
    
    console.log('🎉 Missing payment recovered successfully!');
    console.log('   ernie now has access to ₩39,000 payment');
    console.log('   Total ads available: ' + ernie.adsAvailable);
    
    await mongoose.connection.close();
    console.log('\n✅ Done - Please refresh MyPage to see the change');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

addMissingPayment();
