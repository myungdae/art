// jobs/scheduler.js
/**
 * Cron 스케줄러 설정
 * node-cron을 사용하여 정기적으로 작업 실행
 */

const cron = require('node-cron');
const { runAccountExpiryJob } = require('./accountExpiryJob');

/**
 * 스케줄러 초기화
 */
function initScheduler() {
  console.log('🔧 Initializing Cron Scheduler...\n');

  // ========================================
  // 계정 만료 작업: 매일 새벽 2시 실행
  // ========================================
  // Cron 표현식: '0 2 * * *' = 매일 02:00
  // - 분 시 일 월 요일
  // - 0  2  *  *  *
  
  const expiryJob = cron.schedule('0 2 * * *', async () => {
    try {
      await runAccountExpiryJob();
    } catch (err) {
      console.error('❌ Account expiry job failed:', err);
    }
  }, {
    scheduled: true,
    timezone: 'UTC', // 또는 'Asia/Seoul'
  });

  console.log('✅ Account Expiry Job scheduled: Daily at 2:00 AM UTC');

  // ========================================
  // 테스트용: 개발 환경에서만 즉시 실행
  // ========================================
  if (process.env.NODE_ENV === 'development' && process.env.RUN_JOBS_ON_START === 'true') {
    console.log('\n🧪 Development mode: Running jobs immediately...\n');
    setTimeout(async () => {
      try {
        await runAccountExpiryJob();
      } catch (err) {
        console.error('❌ Initial job run failed:', err);
      }
    }, 5000); // 5초 후 실행 (DB 연결 대기)
  }

  return {
    expiryJob,
  };
}

/**
 * 모든 스케줄 작업 중지
 */
function stopScheduler(jobs) {
  console.log('\n🛑 Stopping all scheduled jobs...');
  if (jobs && jobs.expiryJob) {
    jobs.expiryJob.stop();
  }
  console.log('✅ All scheduled jobs stopped\n');
}

module.exports = {
  initScheduler,
  stopScheduler,
};
