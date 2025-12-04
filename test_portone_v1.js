const axios = require('axios');
require('dotenv').config();

async function testPortOneV1() {
  try {
    const apiKey = process.env.PORTONE_API_KEY || process.env.PORTONE_API_SECRET;
    const apiSecret = process.env.PORTONE_API_SECRET;
    
    console.log('🔑 Testing PortOne V1 API (iamport.kr)');
    console.log('API Key:', apiKey?.substring(0, 20) + '...');
    console.log('API Secret:', apiSecret?.substring(0, 20) + '...');
    console.log('');
    
    console.log('📤 Sending POST request to https://api.iamport.kr/users/getToken');
    
    const tokenResponse = await axios.post(
      'https://api.iamport.kr/users/getToken',
      {
        imp_key: apiKey,
        imp_secret: apiSecret
      }
    );
    
    console.log('✅ V1 Authentication successful!');
    console.log('Access token received:', tokenResponse.data.response.access_token?.substring(0, 30) + '...');
    console.log('Token expires at:', tokenResponse.data.response.expired_at);
    console.log('');
    console.log('🎉 PortOne V1 API is working!');
    console.log('👉 We should use V1 API for refunds');
    
  } catch (error) {
    console.error('❌ V1 Authentication failed!');
    console.error('Status:', error.response?.status);
    console.error('Error:', error.response?.data);
  }
}

testPortOneV1();
