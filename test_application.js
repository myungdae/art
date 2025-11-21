// test_application.js - 지원서 제출 테스트 스크립트
'use strict';

const mongoose = require('mongoose');
require('dotenv').config();

const Application = require('./model/application');
const JobVacancy = require('./model/jobVacancy');
const User = require('./model/user');

async function testApplicationSubmission() {
  try {
    console.log('='.repeat(60));
    console.log('📝 지원서 제출 테스트 시작');
    console.log('='.repeat(60));
    
    // MongoDB 연결
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ MongoDB 연결 성공\n');

    // 1. 구직자 계정 확인
    console.log('1️⃣ 구직자 계정 확인');
    const jobSeekers = await User.find({ role: 'Job_Seeker' }).limit(5);
    console.log(`   총 ${jobSeekers.length}명의 구직자 계정 발견`);
    if (jobSeekers.length > 0) {
      jobSeekers.forEach((user, idx) => {
        console.log(`   ${idx + 1}. ${user.email} (${user.name || 'N/A'})`);
      });
    }
    console.log();

    // 2. 채용공고 확인
    console.log('2️⃣ 활성 채용공고 확인');
    const jobVacancies = await JobVacancy.find({ status: 'active' })
      .sort({ createdAt: -1 })
      .limit(5);
    console.log(`   총 ${jobVacancies.length}개의 활성 채용공고 발견`);
    if (jobVacancies.length > 0) {
      jobVacancies.forEach((job, idx) => {
        console.log(`   ${idx + 1}. [${job._id}] ${job.title}`);
        console.log(`      회사: ${job.companyName || 'N/A'}, 위치: ${job.country || 'N/A'}`);
      });
    }
    console.log();

    // 3. 기존 지원서 확인
    console.log('3️⃣ 기존 지원서 확인');
    const existingApplications = await Application.find()
      .sort({ appliedAt: -1 })
      .limit(10);
    console.log(`   총 ${existingApplications.length}개의 지원서 존재`);
    if (existingApplications.length > 0) {
      existingApplications.forEach((app, idx) => {
        console.log(`   ${idx + 1}. [${app._id}]`);
        console.log(`      지원자: ${app.applicantName} (${app.applicantEmail})`);
        console.log(`      공고: ${app.jobTitle}`);
        console.log(`      상태: ${app.status}, 지원일: ${app.appliedAt.toISOString()}`);
      });
    }
    console.log();

    // 4. 테스트 지원서 생성 (구직자와 공고가 있다면)
    if (jobSeekers.length > 0 && jobVacancies.length > 0) {
      const testJobSeeker = jobSeekers[0];
      const testJobVacancy = jobVacancies[0];
      
      console.log('4️⃣ 테스트 지원서 생성');
      console.log(`   구직자: ${testJobSeeker.email}`);
      console.log(`   채용공고: ${testJobVacancy.title}`);
      
      // 중복 지원 체크
      const existingApp = await Application.findOne({
        applicant: testJobSeeker._id,
        jobVacancy: testJobVacancy._id
      });
      
      if (existingApp) {
        console.log(`   ⚠️  이미 지원한 공고입니다 (지원서 ID: ${existingApp._id})`);
        console.log(`      상태: ${existingApp.status}`);
        console.log(`      지원일: ${existingApp.appliedAt.toISOString()}`);
      } else {
        const testApplication = new Application({
          applicant: testJobSeeker._id,
          jobVacancy: testJobVacancy._id,
          applicantName: testJobSeeker.name || testJobSeeker.email,
          applicantEmail: testJobSeeker.email,
          jobTitle: testJobVacancy.title,
          companyName: testJobVacancy.companyName || 'Test Company',
          coverLetter: `Hello,\n\nI am very interested in the ${testJobVacancy.title} position at ${testJobVacancy.companyName || 'your company'}.\n\nWith my experience and passion for teaching, I believe I would be a great fit for this role.\n\nI look forward to hearing from you.\n\nBest regards,\n${testJobSeeker.name || testJobSeeker.email}`,
          resume: 'https://example.com/my-resume.pdf',
          status: 'pending',
          appliedAt: new Date()
        });
        
        await testApplication.save();
        console.log(`   ✅ 테스트 지원서 생성 완료!`);
        console.log(`      지원서 ID: ${testApplication._id}`);
        console.log(`      상태: ${testApplication.status}`);
      }
    } else {
      console.log('4️⃣ 테스트 지원서 생성 건너뜀');
      console.log('   ⚠️  구직자 또는 채용공고가 없습니다');
    }
    console.log();

    // 5. 최종 통계
    console.log('5️⃣ 최종 통계');
    const totalApplications = await Application.countDocuments();
    const pendingCount = await Application.countDocuments({ status: 'pending' });
    const reviewedCount = await Application.countDocuments({ status: 'reviewed' });
    const acceptedCount = await Application.countDocuments({ status: 'accepted' });
    const rejectedCount = await Application.countDocuments({ status: 'rejected' });
    const withdrawnCount = await Application.countDocuments({ status: 'withdrawn' });
    
    console.log(`   전체 지원서: ${totalApplications}개`);
    console.log(`   - Pending: ${pendingCount}개`);
    console.log(`   - Reviewed: ${reviewedCount}개`);
    console.log(`   - Accepted: ${acceptedCount}개`);
    console.log(`   - Rejected: ${rejectedCount}개`);
    console.log(`   - Withdrawn: ${withdrawnCount}개`);
    console.log();

    console.log('='.repeat(60));
    console.log('✅ 테스트 완료!');
    console.log('='.repeat(60));
    
  } catch (err) {
    console.error('❌ 테스트 중 에러 발생:', err);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ MongoDB 연결 종료');
  }
}

// 실행
testApplicationSubmission();
