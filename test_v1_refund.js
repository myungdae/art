// test_v1_refund.js - Test PortOne V1 REST API Refund
const axios = require('axios');
require('dotenv').config();

const IMP_KEY = process.env.PORTONE_IMP_KEY;
const API_SECRET = process.env.PORTONE_API_SECRET;

console.log('🔍 Testing PortOne V1 REST API Authentication\n');
console.log('📌 IMP_KEY:', IMP_KEY);
console.log('📌 API_SECRET:', API_SECRET ? '***' + API_SECRET.slice(-10) : 'NOT SET');
console.log('');

async function testV1Authentication() {
  try {
    console.log('🔑 Step 1: Getting V1 Access Token...');
    console.log('   Request URL: https://api.iamport.kr/users/getToken');
    console.log('   Request Body:', { imp_key: IMP_KEY, imp_secret: '***' + API_SECRET.slice(-10) });
    
    const tokenResponse = await axios.post(
      'https://api.iamport.kr/users/getToken',
      {
        imp_key: IMP_KEY,
        imp_secret: API_SECRET
      },
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );

    console.log('📦 Token Response:', JSON.stringify(tokenResponse.data, null, 2));

    if (tokenResponse.data.code === 0) {
      const accessToken = tokenResponse.data.response.access_token;
      console.log('\n✅ Authentication successful!');
      console.log('🎫 Access Token:', accessToken.substring(0, 20) + '...');
      return accessToken;
    } else {
      console.log('\n❌ Authentication failed!');
      console.log('Error Code:', tokenResponse.data.code);
      console.log('Error Message:', tokenResponse.data.message);
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

async function testGetPayments(accessToken) {
  try {
    console.log('\n\n🔍 Step 2: Testing Payment Retrieval...');
    
    const response = await axios.get(
      'https://api.iamport.kr/payments',
      {
        headers: { 
          'Authorization': accessToken,
          'Content-Type': 'application/json'
        },
        params: {
          status: 'paid',
          limit: 5
        }
      }
    );

    console.log('📦 Payments Response:', JSON.stringify(response.data, null, 2));

    if (response.data.code === 0) {
      const payments = response.data.response.list || [];
      console.log(`\n✅ Found ${payments.length} paid payments`);
      
      payments.forEach((payment, i) => {
        console.log(`\n${i + 1}. Payment:`);
        console.log(`   imp_uid: ${payment.imp_uid}`);
        console.log(`   merchant_uid: ${payment.merchant_uid}`);
        console.log(`   amount: ₩${payment.amount?.toLocaleString()}`);
        console.log(`   status: ${payment.status}`);
        console.log(`   paid_at: ${new Date(payment.paid_at * 1000).toLocaleString()}`);
      });

      return payments;
    } else {
      console.log('\n❌ Failed to retrieve payments');
      return [];
    }
  } catch (error) {
    console.error('\n❌ Request failed:', error.message);
    if (error.response) {
      console.error('Response Status:', error.response.status);
      console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
    }
    return [];
  }
}

async function main() {
  console.log('='.repeat(70));
  console.log('🧪 PORTONE V1 REST API TEST');
  console.log('='.repeat(70) + '\n');

  // Test authentication
  const accessToken = await testV1Authentication();
  
  if (!accessToken) {
    console.log('\n❌ Cannot continue without valid access token');
    process.exit(1);
  }

  // Test getting payments
  await testGetPayments(accessToken);

  console.log('\n' + '='.repeat(70));
  console.log('✅ Test completed');
  console.log('='.repeat(70));
}

main().catch(error => {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
});
