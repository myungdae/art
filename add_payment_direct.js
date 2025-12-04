const mongoose = require('mongoose');
require('dotenv').config();

async function addPaymentDirect() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Direct MongoDB operation - bypass Mongoose validation
    const db = mongoose.connection.db;
    const paymentsCollection = db.collection('payments');
    const usersCollection = db.collection('users');
    
    // Find ernie
    const ernie = await usersCollection.findOne({ email: 'dudehdi@gmail.com' });
    
    if (!ernie) {
      console.log('❌ ernie user not found');
      await mongoose.connection.close();
      return;
    }
    
    console.log('👤 Found ernie:', ernie.email);
    console.log('   User ID:', ernie._id);
    console.log('   Current ads available:', ernie.adsAvailable || 0);
    console.log('');
    
    const paymentId = 'employer_1_68f83c28_1764827821146';
    
    // Check if already exists
    const existing = await paymentsCollection.findOne({ paymentId });
    
    if (existing) {
      console.log('⚠️  Payment already exists!');
      console.log('   Payment ID:', existing.paymentId);
      console.log('   Amount: ₩' + existing.amount.toLocaleString('ko-KR'));
      await mongoose.connection.close();
      return;
    }
    
    // Generate GUARANTEED unique orderId
    const uniqueOrderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    // Payment data
    const paymentData = {
      userId: ernie._id,
      userEmail: ernie.email,
      userRole: ernie.role,
      paymentId: paymentId,
      merchantUid: paymentId,
      orderId: uniqueOrderId, // UNIQUE orderId
      amount: 39000,
      status: 'paid',
      packageType: 'job_ads',
      packageDetails: { quantity: 3 },
      paidAt: new Date('2025-12-04T14:58:20+09:00'),
      paymentMethod: 'card',
      createdAt: new Date('2025-12-04T14:58:20+09:00'),
      updatedAt: new Date()
    };
    
    console.log('📋 Creating payment record:');
    console.log('   Payment ID:', paymentData.paymentId);
    console.log('   Order ID:', paymentData.orderId);
    console.log('   Amount: ₩' + paymentData.amount.toLocaleString('ko-KR'));
    console.log('   Package: 3 job ads');
    console.log('');
    
    // Insert directly using MongoDB driver (bypass Mongoose)
    const insertResult = await paymentsCollection.insertOne(paymentData);
    console.log('✅ Payment record created in database');
    console.log('   MongoDB _id:', insertResult.insertedId);
    console.log('');
    
    // Update ernie's ad credits
    const currentAds = ernie.adsAvailable || 0;
    const newAds = currentAds + 3;
    
    await usersCollection.updateOne(
      { _id: ernie._id },
      { $set: { adsAvailable: newAds, updatedAt: new Date() } }
    );
    
    console.log('✅ Updated ernie ad credits');
    console.log('   Previous: ' + currentAds);
    console.log('   Added: +3');
    console.log('   Total now: ' + newAds);
    console.log('');
    console.log('🎉 Recovery completed successfully!');
    console.log('👉 Refresh MyPage to see the ₩39,000 payment');
    
    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    await mongoose.connection.close();
    process.exit(1);
  }
}

addPaymentDirect();
