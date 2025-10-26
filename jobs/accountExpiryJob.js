// jobs/accountExpiryJob.js
/**
 * 계정 만료 관리 Cron Job
 * - 90일 경과: 첫 번째 알림 이메일 발송
 * - 110일 경과: 최종 알림 이메일 발송
 * - 120일 경과 + 크레딧 0: 계정 자동 삭제
 */

const User = require('../model/user');
const mailer = require('../utils/mailer');

// 날짜 계산 헬퍼
function getDaysAgo(date) {
  const now = new Date();
  const diffMs = now - date;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * 90일 경과 알림 (30일 후 만료 예정)
 */
async function send90DayWarning() {
  try {
    const users = await User.find({
      'expiryNotifications.day90Sent': false,
      role: { $ne: 'Admin' },
    }).lean();

    console.log(`[90-Day Warning] Checking ${users.length} users...`);

    let sentCount = 0;
    for (const user of users) {
      const daysOld = getDaysAgo(user.createdAt);
      
      // 90일 이상 경과한 사용자만
      if (daysOld >= 90) {
        try {
          await mailer.send({
            to: user.email,
            subject: '⚠️ ESL Plus Account - Expiring in 30 Days',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #FF7A00;">Account Expiration Notice</h2>
                <p>Dear ${user.username},</p>
                <p>This is a friendly reminder that your ESL Plus account will expire in <strong>30 days</strong>.</p>
                
                <div style="background-color: #FFF9F5; border-left: 4px solid #FF7A00; padding: 15px; margin: 20px 0;">
                  <h3 style="margin-top: 0; color: #333;">Account Status</h3>
                  <ul style="margin: 10px 0;">
                    <li><strong>Registration Date:</strong> ${new Date(user.createdAt).toLocaleDateString()}</li>
                    <li><strong>Days Active:</strong> ${daysOld} days</li>
                    <li><strong>Current Credits:</strong> ${user.adsAvailable || 0}</li>
                  </ul>
                </div>

                <h3 style="color: #333;">What Happens Next?</h3>
                <ul>
                  <li>Accounts with <strong>0 credits</strong> will be automatically deleted after 120 days</li>
                  <li>Accounts with active credits will <strong>never expire</strong></li>
                  <li>You will receive one more reminder in 20 days</li>
                </ul>

                <div style="background-color: #E3F2FD; border-left: 4px solid #2196F3; padding: 15px; margin: 20px 0;">
                  <strong style="color: #2196F3;">💡 How to Keep Your Account Active:</strong>
                  <p style="margin: 10px 0 0 0;">Purchase ad credits to ensure your account remains active indefinitely.</p>
                </div>

                <p style="margin-top: 30px;">
                  If you have any questions, please contact us at <a href="mailto:myungdae.cho@gmail.com">myungdae.cho@gmail.com</a>
                </p>

                <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                <p style="color: #666; font-size: 12px;">
                  This is an automated message from ESL Plus. Please do not reply to this email.
                </p>
              </div>
            `,
          });

          // 알림 전송 플래그 업데이트
          await User.updateOne(
            { _id: user._id },
            { $set: { 'expiryNotifications.day90Sent': true } }
          );

          sentCount++;
          console.log(`✅ 90-day warning sent to: ${user.email}`);
        } catch (err) {
          console.error(`❌ Failed to send 90-day warning to ${user.email}:`, err.message);
        }
      }
    }

    console.log(`[90-Day Warning] Sent ${sentCount} emails`);
    return sentCount;
  } catch (err) {
    console.error('[90-Day Warning] Error:', err);
    throw err;
  }
}

/**
 * 110일 경과 최종 알림 (10일 후 삭제 예정)
 */
async function send110DayFinalWarning() {
  try {
    const users = await User.find({
      'expiryNotifications.day110Sent': false,
      role: { $ne: 'Admin' },
    }).lean();

    console.log(`[110-Day Final Warning] Checking ${users.length} users...`);

    let sentCount = 0;
    for (const user of users) {
      const daysOld = getDaysAgo(user.createdAt);
      
      // 110일 이상 경과한 사용자만
      if (daysOld >= 110) {
        try {
          await mailer.send({
            to: user.email,
            subject: '🚨 ESL Plus Account - Final Notice: Deleting in 10 Days',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #dc3545;">⚠️ Final Account Expiration Notice</h2>
                <p>Dear ${user.username},</p>
                <p><strong style="color: #dc3545;">This is your final reminder</strong> - your ESL Plus account will be automatically deleted in <strong>10 days</strong>.</p>
                
                <div style="background-color: #FFEBEE; border-left: 4px solid #dc3545; padding: 15px; margin: 20px 0;">
                  <h3 style="margin-top: 0; color: #dc3545;">⏰ Urgent Action Required</h3>
                  <ul style="margin: 10px 0;">
                    <li><strong>Registration Date:</strong> ${new Date(user.createdAt).toLocaleDateString()}</li>
                    <li><strong>Days Active:</strong> ${daysOld} days</li>
                    <li><strong>Current Credits:</strong> ${user.adsAvailable || 0}</li>
                    <li><strong>Deletion Date:</strong> ${new Date(new Date(user.createdAt).getTime() + 120 * 24 * 60 * 60 * 1000).toLocaleDateString()}</li>
                  </ul>
                </div>

                ${user.adsAvailable === 0 ? `
                <div style="background-color: #FFF3CD; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
                  <strong style="color: #856404;">🚨 Your account will be deleted because:</strong>
                  <ul style="margin: 10px 0;">
                    <li>You have <strong>0 credits</strong></li>
                    <li>Your account has been active for more than 110 days</li>
                  </ul>
                </div>
                ` : `
                <div style="background-color: #D4EDDA; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0;">
                  <strong style="color: #155724;">✅ Good News!</strong>
                  <p style="margin: 10px 0 0 0;">You have ${user.adsAvailable} active credits, so your account will NOT be deleted.</p>
                </div>
                `}

                <h3 style="color: #333;">How to Prevent Account Deletion:</h3>
                <ol>
                  <li>Purchase ad credits before the deletion date</li>
                  <li>Any amount of credits will keep your account active indefinitely</li>
                </ol>

                <p style="margin-top: 30px;">
                  <strong>Need Help?</strong> Contact us at <a href="mailto:myungdae.cho@gmail.com">myungdae.cho@gmail.com</a>
                </p>

                <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                <p style="color: #666; font-size: 12px;">
                  This is an automated message from ESL Plus. Please do not reply to this email.
                </p>
              </div>
            `,
          });

          // 알림 전송 플래그 업데이트
          await User.updateOne(
            { _id: user._id },
            { $set: { 'expiryNotifications.day110Sent': true } }
          );

          sentCount++;
          console.log(`✅ 110-day final warning sent to: ${user.email}`);
        } catch (err) {
          console.error(`❌ Failed to send 110-day warning to ${user.email}:`, err.message);
        }
      }
    }

    console.log(`[110-Day Final Warning] Sent ${sentCount} emails`);
    return sentCount;
  } catch (err) {
    console.error('[110-Day Final Warning] Error:', err);
    throw err;
  }
}

/**
 * 120일 경과 + 크레딧 0 계정 자동 삭제
 */
async function deleteExpiredAccounts() {
  try {
    const users = await User.find({
      role: { $ne: 'Admin' },
      adsAvailable: { $lte: 0 }, // 크레딧 0 이하
    }).lean();

    console.log(`[Account Deletion] Checking ${users.length} users with 0 credits...`);

    let deletedCount = 0;
    const deletedUsers = [];

    for (const user of users) {
      const daysOld = getDaysAgo(user.createdAt);
      
      // 120일 이상 경과한 사용자만 삭제
      if (daysOld >= 120) {
        try {
          // 삭제 전 최종 이메일 발송
          await mailer.send({
            to: user.email,
            subject: 'ESL Plus Account Deleted',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #666;">Account Deletion Notice</h2>
                <p>Dear ${user.username},</p>
                <p>Your ESL Plus account has been automatically deleted as per our 120-day policy.</p>
                
                <div style="background-color: #F5F5F5; border-left: 4px solid #999; padding: 15px; margin: 20px 0;">
                  <h3 style="margin-top: 0; color: #333;">Account Details</h3>
                  <ul style="margin: 10px 0;">
                    <li><strong>Email:</strong> ${user.email}</li>
                    <li><strong>Registration Date:</strong> ${new Date(user.createdAt).toLocaleDateString()}</li>
                    <li><strong>Deletion Date:</strong> ${new Date().toLocaleDateString()}</li>
                    <li><strong>Days Active:</strong> ${daysOld} days</li>
                  </ul>
                </div>

                <p>You are welcome to register again at any time at <a href="https://eslplus.org/user/register">ESL Plus</a></p>

                <p style="margin-top: 30px;">
                  Thank you for using ESL Plus. We hope to see you again!
                </p>

                <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                <p style="color: #666; font-size: 12px;">
                  This is an automated message from ESL Plus.
                </p>
              </div>
            `,
          });

          // 계정 삭제
          await User.deleteOne({ _id: user._id });

          deletedUsers.push({
            email: user.email,
            username: user.username,
            daysOld,
          });

          deletedCount++;
          console.log(`✅ Deleted expired account: ${user.email} (${daysOld} days old)`);
        } catch (err) {
          console.error(`❌ Failed to delete account ${user.email}:`, err.message);
        }
      }
    }

    console.log(`[Account Deletion] Deleted ${deletedCount} accounts`);
    
    // 관리자에게 삭제 리포트 발송
    if (deletedCount > 0) {
      await sendDeletionReport(deletedUsers);
    }

    return deletedCount;
  } catch (err) {
    console.error('[Account Deletion] Error:', err);
    throw err;
  }
}

/**
 * 관리자에게 삭제 리포트 발송
 */
async function sendDeletionReport(deletedUsers) {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'myungdae.cho@gmail.com';
    
    const userList = deletedUsers.map(u => 
      `<li><strong>${u.username}</strong> (${u.email}) - Active for ${u.daysOld} days</li>`
    ).join('');

    await mailer.send({
      to: adminEmail,
      subject: `ESL Plus: ${deletedUsers.length} Accounts Automatically Deleted`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Account Deletion Report</h2>
          <p>The following accounts were automatically deleted due to 120-day expiration policy:</p>
          
          <div style="background-color: #F5F5F5; padding: 15px; margin: 20px 0;">
            <h3>Deleted Accounts (${deletedUsers.length})</h3>
            <ul>${userList}</ul>
          </div>

          <p style="color: #666; font-size: 12px;">
            Date: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}
          </p>
        </div>
      `,
    });

    console.log('✅ Deletion report sent to admin');
  } catch (err) {
    console.error('❌ Failed to send deletion report:', err.message);
  }
}

/**
 * 모든 만료 작업 실행 (메인 함수)
 */
async function runAccountExpiryJob() {
  console.log('\n========================================');
  console.log('🔄 Account Expiry Job Started');
  console.log(`⏰ ${new Date().toISOString()}`);
  console.log('========================================\n');

  try {
    // 1. 90일 알림
    const warning90 = await send90DayWarning();
    
    // 2. 110일 최종 알림
    const warning110 = await send110DayFinalWarning();
    
    // 3. 120일 계정 삭제
    const deleted = await deleteExpiredAccounts();

    console.log('\n========================================');
    console.log('✅ Account Expiry Job Completed');
    console.log(`📊 Summary:`);
    console.log(`   - 90-day warnings sent: ${warning90}`);
    console.log(`   - 110-day warnings sent: ${warning110}`);
    console.log(`   - Accounts deleted: ${deleted}`);
    console.log('========================================\n');

    return {
      success: true,
      warning90,
      warning110,
      deleted,
    };
  } catch (err) {
    console.error('\n❌ Account Expiry Job Failed:', err);
    throw err;
  }
}

module.exports = {
  runAccountExpiryJob,
  send90DayWarning,
  send110DayFinalWarning,
  deleteExpiredAccounts,
};
