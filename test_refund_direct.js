// test_refund_direct.js - Direct Refund Test
const axios = require('axios');
require('dotenv').config();

const BASE_URL = 'http://localhost:8608';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// Payment to refund (from V2 API test)
const TEST_PAYMENT_ID = 'employer_1_68f83c28_1764827821146';

console.log('🔍 Testing Refund Functionality\n');
console.log('📌 Base URL:', BASE_URL);
console.log('📌 Admin Email:', ADMIN_EMAIL);
console.log('📌 Payment ID:', TEST_PAYMENT_ID);
console.log('');

async function loginAsAdmin() {
  try {
    console.log('🔐 Step 1: Logging in as admin...');
    
    const response = await axios.post(
      `${BASE_URL}/admin/login`,
      `email=${encodeURIComponent(ADMIN_EMAIL)}&password=${encodeURIComponent(ADMIN_PASSWORD)}`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        maxRedirects: 0,
        validateStatus: () => true
      }
    );

    if (response.status === 302 && response.headers['set-cookie']) {
      const sessionCookie = response.headers['set-cookie'][0].split(';')[0];
      console.log('✅ Admin login successful');
      console.log('🍪 Session cookie obtained');
      return sessionCookie;
    } else {
      console.log('❌ Admin login failed');
      console.log('Status:', response.status);
      return null;
    }
  } catch (error) {
    console.error('❌ Login error:', error.message);
    return null;
  }
}

async function testRefund(sessionCookie, paymentId, reason) {
  try {
    console.log(`\n\n🔄 Step 2: Processing refund for ${paymentId}...`);
    console.log('Reason:', reason);
    
    const response = await axios.post(
      `${BASE_URL}/portone/refund`,
      {
        paymentId: paymentId,
        reason: reason
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Cookie': sessionCookie
        },
        validateStatus: () => true
      }
    );

    console.log('\n📦 Refund Response:');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));

    if (response.data.success) {
      console.log('\n✅ REFUND SUCCESSFUL!');
      console.log('Payment has been refunded successfully');
      return true;
    } else {
      console.log('\n❌ REFUND FAILED');
      console.log('Message:', response.data.message);
      console.log('Error:', response.data.error);
      return false;
    }
  } catch (error) {
    console.error('\n❌ Refund request error:', error.message);
    if (error.response) {
      console.error('Response Status:', error.response.status);
      console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
    }
    return false;
  }
}

async function main() {
  console.log('='.repeat(70));
  console.log('🧪 REFUND FUNCTIONALITY TEST');
  console.log('='.repeat(70) + '\n');

  // Login as admin
  const sessionCookie = await loginAsAdmin();
  
  if (!sessionCookie) {
    console.log('\n❌ Cannot continue without admin session');
    process.exit(1);
  }

  // Test refund
  const success = await testRefund(
    sessionCookie,
    TEST_PAYMENT_ID,
    'Testing refund functionality with V2 API'
  );

  console.log('\n' + '='.repeat(70));
  if (success) {
    console.log('✅ TEST PASSED - Refund system is working!');
  } else {
    console.log('❌ TEST FAILED - Check logs above for details');
  }
  console.log('='.repeat(70));
}

main().catch(error => {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
});
