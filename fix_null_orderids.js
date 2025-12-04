const mongoose = require('mongoose');
require('dotenv').config();

const Payment = require('./model/payment');

async function fixNullOrderIds() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Find all payments with null orderId
    const paymentsWithNullOrderId = await Payment.find({ orderId: null });
    
    console.log(`🔍 Found ${paymentsWithNullOrderId.length} payment(s) with orderId: null\n`);
    
    if (paymentsWithNullOrderId.length === 0) {
      console.log('✅ No payments with null orderId - all good!');
      await mongoose.connection.close();
      return;
    }
    
    // Update each payment with a unique orderId
    let updated = 0;
    for (const payment of paymentsWithNullOrderId) {
      const uniqueOrderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      payment.orderId = uniqueOrderId;
      await payment.save();
      console.log(`✅ Updated payment ${payment.paymentId} with orderId: ${uniqueOrderId}`);
      updated++;
      
      // Small delay to ensure unique timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    console.log(`\n✅ Successfully updated ${updated} payment(s)`);
    console.log('👉 Now you can run: node add_missing_payment.js');
    
    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await mongoose.connection.close();
    process.exit(1);
  }
}

fixNullOrderIds();
