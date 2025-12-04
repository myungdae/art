const mongoose = require('mongoose');
const axios = require('axios');
require('dotenv').config();

const User = require('./model/user');
const Payment = require('./model/payment');

async function recoverPayment() {
  try {
    // Payment ID from PortOne dashboard (user will provide this)
    const PAYMENT_ID = process.argv[2]; // Get from command line argument
    
    if (!PAYMENT_ID) {
      console.log('❌ Usage: node recover_payment.js <payment_id>');
      console.log('   Example: node recover_payment.js imp_123456789');
      console.log('');
      console.log('📋 Steps:');
      console.log('   1. Go to PortOne dashboard');
      console.log('   2. Find the ₩39,000 payment');
      console.log('   3. Copy the Payment ID (imp_xxx format)');
      console.log('   4. Run: node recover_payment.js <payment_id>');
      process.exit(1);
    }
    
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Get PortOne API credentials
    const portoneApiSecret = process.env.PORTONE_API_SECRET?.trim();
    const portoneApiKey = process.env.PORTONE_API_KEY?.trim();
    
    if (!portoneApiSecret && !portoneApiKey) {
      console.log('❌ PORTONE_API_SECRET or PORTONE_API_KEY not found in .env');
      process.exit(1);
    }
    
    console.log('🔍 Fetching payment details from PortOne...\n');
    
    let portonePayment;
    
    // Try V2 API first (with api-secret)
    if (portoneApiSecret) {
      try {
        console.log('Trying PortOne V2 API...');
        
        // Step 1: Get Access Token
        const tokenResponse = await axios.post(
          'https://api.portone.io/login/api-secret',
          { api_secret: portoneApiSecret }
        );
        
        const accessToken = tokenResponse.data.access_token;
        console.log('✅ V2 Access token obtained');
        
        // Step 2: Get Payment Details
        const paymentResponse = await axios.get(
          `https://api.portone.io/payments/${PAYMENT_ID}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          }
        );
        
        portonePayment = paymentResponse.data;
        
      } catch (v2Error) {
        console.log('⚠️  V2 API failed, trying V1 API...');
        
        // Fallback to V1 API (iamport)
        const iamportResponse = await axios.get(
          `https://api.iamport.kr/payments/${PAYMENT_ID}`,
          {
            headers: {
              'Authorization': portoneApiKey || portoneApiSecret
            }
          }
        );
        
        portonePayment = iamportResponse.data.response;
      }
    }
    
    console.log('\n📋 Payment Details from PortOne:');
    console.log('   Payment ID:', portonePayment.id);
    console.log('   Merchant UID:', portonePayment.merchantUid || 'N/A');
    console.log('   Amount:', `₩${portonePayment.amount?.toLocaleString('ko-KR')}`);
    console.log('   Status:', portonePayment.status);
    console.log('   Paid At:', portonePayment.paidAt);
    console.log('   Method:', portonePayment.method?.type);
    console.log('');
    
    // Find ernie user
    const ernie = await User.findOne({ email: 'dudehdi@gmail.com' });
    
    if (!ernie) {
      console.log('❌ ernie user not found');
      await mongoose.connection.close();
      process.exit(1);
    }
    
    console.log('👤 Found ernie:', ernie.email);
    console.log('');
    
    // Check if payment already exists in DB
    const existingPayment = await Payment.findOne({ 
      paymentId: portonePayment.id 
    });
    
    if (existingPayment) {
      console.log('⚠️  Payment already exists in database!');
      console.log('   Payment ID:', existingPayment.paymentId);
      console.log('   User:', (await User.findById(existingPayment.userId))?.email);
      console.log('   Amount:', `₩${existingPayment.amount}`);
      console.log('');
      
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      await new Promise((resolve) => {
        readline.question('Update this payment? (yes/no): ', (answer) => {
          readline.close();
          if (answer.toLowerCase() !== 'yes') {
            console.log('❌ Cancelled');
            mongoose.connection.close();
            process.exit(0);
          }
          resolve();
        });
      });
    }
    
    // Determine package type and details based on amount
    let packageType = 'job_ads';
    let packageDetails = { quantity: 1 };
    
    if (portonePayment.amount === 39000) {
      packageType = 'job_ads';
      packageDetails = { quantity: 3 }; // Assuming 3 ads for 39000
    } else if (portonePayment.amount === 1000) {
      packageType = 'job_ads';
      packageDetails = { quantity: 1 };
    }
    
    // Create or update payment record
    const paymentData = {
      userId: ernie._id,
      paymentId: portonePayment.id,
      merchantUid: portonePayment.merchantUid || portonePayment.id,
      amount: portonePayment.amount,
      status: portonePayment.status === 'PAID' ? 'paid' : portonePayment.status.toLowerCase(),
      packageType: packageType,
      packageDetails: packageDetails,
      paidAt: new Date(portonePayment.paidAt),
      paymentMethod: portonePayment.method?.type || 'unknown',
      createdAt: new Date(portonePayment.paidAt),
      updatedAt: new Date()
    };
    
    let savedPayment;
    if (existingPayment) {
      Object.assign(existingPayment, paymentData);
      savedPayment = await existingPayment.save();
      console.log('✅ Payment updated in database');
    } else {
      savedPayment = await Payment.create(paymentData);
      console.log('✅ Payment created in database');
    }
    
    // Update user's ad credits
    if (packageType === 'job_ads') {
      ernie.adsAvailable = (ernie.adsAvailable || 0) + packageDetails.quantity;
      await ernie.save();
      console.log(`✅ Added ${packageDetails.quantity} ad credit(s) to ernie`);
      console.log(`   Total ads available: ${ernie.adsAvailable}`);
    }
    
    console.log('\n🎉 Payment recovery completed!');
    console.log('   Payment ID:', savedPayment.paymentId);
    console.log('   Amount:', `₩${savedPayment.amount.toLocaleString('ko-KR')}`);
    console.log('   User:', ernie.email);
    
    await mongoose.connection.close();
    console.log('\n✅ Done');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('   API Error:', error.response.data);
    }
    process.exit(1);
  }
}

recoverPayment();
