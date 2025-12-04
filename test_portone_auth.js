const axios = require('axios');
require('dotenv').config();

async function testPortOneAuth() {
  try {
    const apiSecret = process.env.PORTONE_API_SECRET;
    
    console.log('🔑 Testing PortOne API Authentication');
    console.log('API Secret length:', apiSecret?.length);
    console.log('API Secret:', apiSecret);
    console.log('');
    
    console.log('📤 Sending POST request to https://api.portone.io/login/api-secret');
    console.log('Request body:', JSON.stringify({ apiSecret: apiSecret }));
    console.log('');
    
    // Try with camelCase apiSecret
    const tokenResponse = await axios.post(
      'https://api.portone.io/login/api-secret',
      {
        apiSecret: apiSecret
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Authentication successful!');
    console.log('Access token received:', tokenResponse.data.access_token?.substring(0, 20) + '...');
    console.log('Token expires at:', tokenResponse.data.expires_at);
    console.log('');
    console.log('🎉 PortOne API authentication is working correctly!');
    
  } catch (error) {
    console.error('❌ Authentication failed!');
    console.error('Status:', error.response?.status);
    console.error('Error type:', error.response?.data?.type);
    console.error('Error message:', error.response?.data?.message);
    console.error('');
    console.error('Full error response:', JSON.stringify(error.response?.data, null, 2));
  }
}

testPortOneAuth();
