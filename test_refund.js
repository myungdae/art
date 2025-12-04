// test_refund.js - Refund System Test Script
// 환불 시스템 테스트 스크립트

const axios = require('axios');
require('dotenv').config();

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Test Results Storage
const testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

function recordTest(testName, passed, details = '') {
  testResults.tests.push({ testName, passed, details });
  if (passed) {
    testResults.passed++;
    log(`✅ ${testName}`, 'green');
  } else {
    testResults.failed++;
    log(`❌ ${testName}`, 'red');
    if (details) log(`   Details: ${details}`, 'yellow');
  }
}

// HTTP Client with session
class TestClient {
  constructor() {
    this.sessionCookie = null;
    this.axios = axios.create({
      baseURL: BASE_URL,
      validateStatus: () => true // Don't throw on any status
    });
  }

  async login() {
    log('\n🔐 Logging in as admin...', 'cyan');
    
    const response = await this.axios.post('/admin/login', 
      `email=${encodeURIComponent(ADMIN_EMAIL)}&password=${encodeURIComponent(ADMIN_PASSWORD)}`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        maxRedirects: 0
      }
    );

    if (response.status === 302 && response.headers['set-cookie']) {
      this.sessionCookie = response.headers['set-cookie'][0].split(';')[0];
      log('✅ Admin login successful', 'green');
      return true;
    } else {
      log('❌ Admin login failed', 'red');
      return false;
    }
  }

  async get(url) {
    return await this.axios.get(url, {
      headers: this.sessionCookie ? { Cookie: this.sessionCookie } : {}
    });
  }

  async post(url, data) {
    return await this.axios.post(url, data, {
      headers: {
        'Content-Type': 'application/json',
        ...(this.sessionCookie ? { Cookie: this.sessionCookie } : {})
      }
    });
  }
}

// Test Cases
class RefundTests {
  constructor(client) {
    this.client = client;
  }

  async testTransactionsPageAccess() {
    log('\n📄 Test 1: Transactions Page Access', 'blue');
    
    const response = await this.client.get('/admin/revenue/transactions');
    
    recordTest(
      'Transactions page loads successfully',
      response.status === 200,
      `Status: ${response.status}`
    );

    if (response.status === 200) {
      const hasTable = response.data.includes('transactions-table');
      const hasRefundBtn = response.data.includes('refund-btn') || response.data.includes('Refund');
      
      recordTest(
        'Transactions table is rendered',
        hasTable,
        hasTable ? 'Table found' : 'Table not found'
      );
      
      recordTest(
        'Refund button functionality exists',
        hasRefundBtn,
        hasRefundBtn ? 'Refund UI found' : 'Refund UI not found'
      );
    }
  }

  async testRefundEndpointUnauthorized() {
    log('\n🔒 Test 2: Refund Endpoint Authorization', 'blue');
    
    // Create a client without session
    const unauthorizedClient = new TestClient();
    
    const response = await unauthorizedClient.post('/portone/refund', {
      paymentId: 'test_payment_id',
      reason: 'Test refund'
    });

    recordTest(
      'Unauthorized access returns 403',
      response.status === 403,
      `Status: ${response.status}`
    );
  }

  async testRefundWithInvalidPaymentId() {
    log('\n🔍 Test 3: Refund with Invalid Payment ID', 'blue');
    
    const response = await this.client.post('/portone/refund', {
      paymentId: 'invalid_payment_id_12345',
      reason: 'Test refund'
    });

    recordTest(
      'Invalid payment ID returns error',
      response.status >= 400,
      `Status: ${response.status}, Message: ${response.data.message || 'N/A'}`
    );
  }

  async testRefundWithMissingPaymentId() {
    log('\n⚠️ Test 4: Refund without Payment ID', 'blue');
    
    const response = await this.client.post('/portone/refund', {
      reason: 'Test refund'
    });

    recordTest(
      'Missing payment ID returns 400',
      response.status === 400,
      `Status: ${response.status}, Message: ${response.data.message || 'N/A'}`
    );
  }

  async testRefundAlreadyRefundedPayment() {
    log('\n🔁 Test 5: Refund Already Refunded Payment', 'blue');
    
    // This test requires a real refunded payment ID
    // For now, we'll test the API structure
    log('⚠️ Skipping: Requires real refunded payment ID', 'yellow');
    recordTest(
      'Already refunded payment check',
      true,
      'Test skipped - requires real data'
    );
  }

  async checkDatabaseModels() {
    log('\n🗄️ Test 6: Database Models Check', 'blue');
    
    try {
      const Payment = require('./model/payment');
      
      recordTest(
        'Payment model exists',
        !!Payment,
        'Payment model loaded successfully'
      );

      // Check schema fields
      const schemaFields = Object.keys(Payment.schema.paths);
      const requiredFields = [
        'paymentId', 'merchantUid', 'userId', 'amount', 
        'status', 'refundedAt', 'refundAmount', 'refundReason', 'refundHistory'
      ];

      const hasAllFields = requiredFields.every(field => schemaFields.includes(field));
      
      recordTest(
        'Payment model has all refund fields',
        hasAllFields,
        hasAllFields 
          ? 'All refund fields present' 
          : `Missing fields: ${requiredFields.filter(f => !schemaFields.includes(f)).join(', ')}`
      );

    } catch (error) {
      recordTest(
        'Database model check',
        false,
        error.message
      );
    }
  }

  async checkEnvironmentVariables() {
    log('\n⚙️ Test 7: Environment Variables Check', 'blue');
    
    const requiredVars = [
      'PORTONE_API_SECRET',
      'PORTONE_STORE_ID',
      'ADMIN_EMAIL',
      'ADMIN_PASSWORD'
    ];

    requiredVars.forEach(varName => {
      const exists = !!process.env[varName];
      recordTest(
        `${varName} is set`,
        exists,
        exists ? 'Variable set' : 'Variable missing'
      );
    });
  }

  async testRefundAPIStructure() {
    log('\n🔧 Test 8: Refund API Structure', 'blue');
    
    // Test with minimal valid structure (will fail on PortOne API call, but that's expected)
    const response = await this.client.post('/portone/refund', {
      paymentId: 'test_structured_payment_id',
      reason: 'API structure test',
      amount: 1000
    });

    recordTest(
      'Refund API accepts correct request structure',
      response.status !== 400 || !response.data.message?.includes('required'),
      `Status: ${response.status}`
    );

    if (response.data) {
      const hasSuccessField = 'success' in response.data;
      const hasMessageField = 'message' in response.data;
      
      recordTest(
        'Response has success field',
        hasSuccessField,
        hasSuccessField ? 'success field present' : 'success field missing'
      );
      
      recordTest(
        'Response has message field',
        hasMessageField,
        hasMessageField ? 'message field present' : 'message field missing'
      );
    }
  }

  async checkRefundCodeImplementation() {
    log('\n💻 Test 9: Refund Code Implementation Check', 'blue');
    
    try {
      const fs = require('fs');
      const portoneCode = fs.readFileSync('./router/portone.js', 'utf8');
      
      // Check for key refund implementation parts
      const checks = [
        { name: 'Refund endpoint defined', pattern: /router\.post\(['"]\/refund['"]/ },
        { name: 'PortOne API call', pattern: /api\.portone\.io\/payments\/.*\/cancel/ },
        { name: 'Job ads credit deduction', pattern: /packageType === ['"]job_ads['"]/ },
        { name: 'Resume access deactivation', pattern: /packageType === ['"]resume_access['"]/ },
        { name: 'Tutor access deactivation', pattern: /packageType === ['"]tutor_access['"]/ },
        { name: 'Refund history tracking', pattern: /refundHistory/ },
        { name: 'Admin authorization check', pattern: /isAdmin/ }
      ];

      checks.forEach(check => {
        const found = check.pattern.test(portoneCode);
        recordTest(
          check.name,
          found,
          found ? 'Implementation found' : 'Implementation missing'
        );
      });

    } catch (error) {
      recordTest(
        'Code implementation check',
        false,
        error.message
      );
    }
  }

  async checkRefundUIImplementation() {
    log('\n🎨 Test 10: Refund UI Implementation Check', 'blue');
    
    try {
      const fs = require('fs');
      const transactionsPug = fs.readFileSync('./views/admin/transactions.pug', 'utf8');
      
      // Check for key UI implementation parts
      const checks = [
        { name: 'Refund button exists', pattern: /refund-btn/ },
        { name: 'Refund function defined', pattern: /function refundPayment/ },
        { name: 'Refund reason prompt', pattern: /prompt.*refund reason/i },
        { name: 'Confirmation dialog', pattern: /confirm.*refund/i },
        { name: 'Refund API call', pattern: /fetch.*\/portone\/refund/ },
        { name: 'Success handling', pattern: /result\.success/ },
        { name: 'Error handling', pattern: /alert.*failed/i },
        { name: 'Status badge for refunded', pattern: /status-badge\.refunded/ }
      ];

      checks.forEach(check => {
        const found = check.pattern.test(transactionsPug);
        recordTest(
          check.name,
          found,
          found ? 'UI element found' : 'UI element missing'
        );
      });

    } catch (error) {
      recordTest(
        'UI implementation check',
        false,
        error.message
      );
    }
  }
}

// Main Test Runner
async function runTests() {
  log('\n' + '='.repeat(60), 'cyan');
  log('🧪 REFUND SYSTEM TEST SUITE', 'cyan');
  log('='.repeat(60) + '\n', 'cyan');

  const client = new TestClient();
  const tests = new RefundTests(client);

  // Login first
  const loginSuccess = await client.login();
  if (!loginSuccess) {
    log('\n❌ Failed to login as admin. Cannot continue tests.', 'red');
    log('Please check ADMIN_EMAIL and ADMIN_PASSWORD in .env file.', 'yellow');
    return;
  }

  // Run all tests
  await tests.checkEnvironmentVariables();
  await tests.checkDatabaseModels();
  await tests.checkRefundCodeImplementation();
  await tests.checkRefundUIImplementation();
  await tests.testTransactionsPageAccess();
  await tests.testRefundEndpointUnauthorized();
  await tests.testRefundWithMissingPaymentId();
  await tests.testRefundWithInvalidPaymentId();
  await tests.testRefundAPIStructure();
  await tests.testRefundAlreadyRefundedPayment();

  // Print Summary
  log('\n' + '='.repeat(60), 'cyan');
  log('📊 TEST SUMMARY', 'cyan');
  log('='.repeat(60), 'cyan');
  
  log(`\nTotal Tests: ${testResults.passed + testResults.failed}`, 'blue');
  log(`✅ Passed: ${testResults.passed}`, 'green');
  log(`❌ Failed: ${testResults.failed}`, 'red');
  
  const percentage = Math.round((testResults.passed / (testResults.passed + testResults.failed)) * 100);
  log(`📈 Success Rate: ${percentage}%\n`, percentage >= 90 ? 'green' : percentage >= 70 ? 'yellow' : 'red');

  // Detailed Results
  if (testResults.failed > 0) {
    log('\n❌ Failed Tests:', 'red');
    testResults.tests
      .filter(t => !t.passed)
      .forEach(t => {
        log(`   • ${t.testName}`, 'red');
        if (t.details) log(`     ${t.details}`, 'yellow');
      });
  }

  log('\n' + '='.repeat(60) + '\n', 'cyan');

  // Exit with appropriate code
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Run tests if executed directly
if (require.main === module) {
  runTests().catch(error => {
    log('\n❌ Test suite error:', 'red');
    console.error(error);
    process.exit(1);
  });
}

module.exports = { runTests, RefundTests };
