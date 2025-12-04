const axios = require('axios');
require('dotenv').config();

async function testDirectRefund() {
  try {
    const storeId = process.env.PORTONE_STORE_ID;
    const apiSecret = process.env.PORTONE_API_SECRET;
    const paymentId = 'employer_1_68f83c28_1764827821146'; // Test payment
    
    console.log('🔑 Testing Direct Refund API');
    console.log('Store ID:', storeId);
    console.log('Payment ID:', paymentId);
    console.log('');
    
    // Try V2 API with store ID in URL
    console.log('📤 Method 1: Trying POST /stores/{storeId}/payments/{paymentId}/cancel');
    
    try {
      const refundResponse = await axios.post(
        `https://api.portone.io/stores/${storeId}/payments/${paymentId}/cancel`,
        {
          reason: 'Test refund request',
          cancelAmount: 39000
        },
        {
          headers: {
            'Authorization': `PortOne ${apiSecret}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('✅ Method 1 Success!');
      console.log('Response:', refundResponse.data);
      return;
    } catch (error) {
      console.log('❌ Method 1 Failed:', error.response?.status, error.response?.data?.type);
    }
    
    // Try with different auth header
    console.log('');
    console.log('📤 Method 2: Trying with Bearer token (Secret Key directly)');
    
    try {
      const refundResponse = await axios.post(
        `https://api.portone.io/payments/${paymentId}/cancel`,
        {
          storeId: storeId,
          reason: 'Test refund request',
          cancelAmount: 39000
        },
        {
          headers: {
            'Authorization': `Bearer ${apiSecret}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('✅ Method 2 Success!');
      console.log('Response:', refundResponse.data);
      return;
    } catch (error) {
      console.log('❌ Method 2 Failed:', error.response?.status, error.response?.data?.type || error.response?.data?.message);
      console.log('Error details:', JSON.stringify(error.response?.data, null, 2));
    }
    
    // Try V1 API with imp_uid
    console.log('');
    console.log('📤 Method 3: Checking if payment exists in V2 API');
    
    try {
      const paymentCheck = await axios.get(
        `https://api.portone.io/payments/${paymentId}`,
        {
          headers: {
            'Authorization': `PortOne ${apiSecret}`
          }
        }
      );
      
      console.log('✅ Payment found!');
      console.log('Payment status:', paymentCheck.data.status);
      console.log('Payment amount:', paymentCheck.data.amount);
    } catch (error) {
      console.log('❌ Payment lookup failed:', error.response?.status, error.response?.data);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testDirectRefund();
