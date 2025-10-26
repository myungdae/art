// jobs/testJob.js
/**
 * Cron Job 테스트 스크립트
 * 개별적으로 각 기능을 테스트할 수 있음
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { 
  runAccountExpiryJob,
  send90DayWarning,
  send110DayFinalWarning,
  deleteExpiredAccounts 
} = require('./accountExpiryJob');

// MongoDB 연결
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err);
    process.exit(1);
  }
}

// 명령줄 인자 파싱
const args = process.argv.slice(2);
const command = args[0] || 'all';

async function main() {
  await connectDB();

  console.log(`\n🧪 Running test: ${command}\n`);

  try {
    switch (command) {
      case '90':
        await send90DayWarning();
        break;
      
      case '110':
        await send110DayFinalWarning();
        break;
      
      case 'delete':
        await deleteExpiredAccounts();
        break;
      
      case 'all':
      default:
        await runAccountExpiryJob();
        break;
    }

    console.log('\n✅ Test completed successfully\n');
  } catch (err) {
    console.error('\n❌ Test failed:', err, '\n');
  } finally {
    await mongoose.disconnect();
    console.log('👋 MongoDB disconnected');
    process.exit(0);
  }
}

main();
