// test_v2_refund.js - Test PortOne V2 API Refund
const axios = require('axios');
require('dotenv').config();

const API_SECRET = process.env.PORTONE_API_SECRET;
const STORE_ID = process.env.PORTONE_STORE_ID;

console.log('🔍 Testing PortOne V2 API Authentication\n');
console.log('📌 Store ID:', STORE_ID);
console.log('📌 API Secret:', API_SECRET ? '***' + API_SECRET.slice(-10) : 'NOT SET');
console.log('');

async function testV2Authentication() {
  try {
    console.log('🔑 Step 1: Getting V2 Access Token...');
    console.log('   Request URL: https://api.portone.io/login/api-secret');
    console.log('   Request Body:', { apiSecret: '***' + API_SECRET.slice(-10) });
    
    const tokenResponse = await axios.post(
      'https://api.portone.io/login/api-secret',
      {
        apiSecret: API_SECRET
      },
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );

    console.log('📦 Token Response Status:', tokenResponse.status);
    console.log('📦 Token Response Data:', JSON.stringify(tokenResponse.data, null, 2));

    if (tokenResponse.data.accessToken) {
      const accessToken = tokenResponse.data.accessToken;
      console.log('\n✅ Authentication successful!');
      console.log('🎫 Access Token:', accessToken.substring(0, 30) + '...');
      return accessToken;
    } else {
      console.log('\n❌ Authentication failed - No access token in response');
      return null;
    }
  } catch (error) {
    console.error('\n❌ Request failed:', error.message);
    if (error.response) {
      console.error('Response Status:', error.response.status);
      console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
    }
    return null;
  }
}

async function testGetPayment(accessToken, paymentId) {
  try {
    console.log(`\n\n🔍 Step 2: Testing Payment Retrieval for ${paymentId}...`);
    
    const response = await axios.get(
      `https://api.portone.io/payments/${paymentId}`,
      {
        headers: { 
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('📦 Payment Response Status:', response.status);
    console.log('📦 Payment Response Data:', JSON.stringify(response.data, null, 2));

    const payment = response.data;
    console.log(`\n✅ Payment found`);
    console.log(`   ID: ${payment.id}`);
    console.log(`   Status: ${payment.status}`);
    console.log(`   Amount: ${payment.amount?.total} ${payment.currency}`);
    console.log(`   Method: ${payment.method?.type}`);

    return payment;
  } catch (error) {
    console.error('\n❌ Request failed:', error.message);
    if (error.response) {
      console.error('Response Status:', error.response.status);
      console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
    }
    return null;
  }
}

async function testListPayments(accessToken) {
  try {
    console.log('\n\n🔍 Step 2: Listing Recent Payments...');
    
    // V2 API doesn't have a direct list endpoint, we'll try to get transactions
    const response = await axios.get(
      `https://api.portone.io/payments`,
      {
        headers: { 
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        params: {
          storeId: STORE_ID,
          status: 'PAID'
        }
      }
    );

    console.log('📦 Payments Response Status:', response.status);
    console.log('📦 Payments Response Data:', JSON.stringify(response.data, null, 2));

    return response.data;
  } catch (error) {
    console.error('\n⚠️ List payments not available or failed:', error.message);
    if (error.response) {
      console.error('Response Status:', error.response.status);
      console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
    }
    return null;
  }
}

async function main() {
  console.log('='.repeat(70));
  console.log('🧪 PORTONE V2 API TEST');
  console.log('='.repeat(70) + '\n');

  // Test authentication
  const accessToken = await testV2Authentication();
  
  if (!accessToken) {
    console.log('\n❌ Cannot continue without valid access token');
    process.exit(1);
  }

  // Try to list payments (might not be supported)
  await testListPayments(accessToken);

  // If you have a specific payment ID to test, uncomment and use:
  // await testGetPayment(accessToken, 'your-payment-id-here');

  console.log('\n' + '='.repeat(70));
  console.log('✅ Test completed');
  console.log('='.repeat(70));
  console.log('\n💡 Next steps:');
  console.log('   1. If authentication succeeded, V2 API is working!');
  console.log('   2. Test refund with a real payment ID from your database');
  console.log('   3. Use the admin panel to trigger a refund');
}

main().catch(error => {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
});
