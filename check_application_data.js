// check_application_data.js - 지원서 데이터 상세 조회
'use strict';

const mongoose = require('mongoose');
require('dotenv').config();

const Application = require('./model/application');
const User = require('./model/user');
const JobVacancy = require('./model/jobVacancy');

async function checkApplicationData() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB 연결 성공\n');

    // 모든 지원서 조회
    const applications = await Application.find()
      .populate('applicant', 'name email role')
      .populate('jobVacancy')
      .sort({ appliedAt: -1 })
      .lean();

    console.log('='.repeat(70));
    console.log('📊 지원서 데이터 상세 조회');
    console.log('='.repeat(70));
    console.log(`총 지원서 개수: ${applications.length}개\n`);

    if (applications.length === 0) {
      console.log('⚠️  등록된 지원서가 없습니다.\n');
    } else {
      applications.forEach((app, idx) => {
        console.log(`📝 지원서 #${idx + 1}`);
        console.log('─'.repeat(70));
        console.log(`   ID: ${app._id}`);
        console.log(`   상태: ${app.status}`);
        console.log(`   지원일: ${new Date(app.appliedAt).toLocaleString()}`);
        console.log('');
        
        console.log('   👤 지원자 정보:');
        console.log(`      이름: ${app.applicantName || 'N/A'}`);
        console.log(`      이메일: ${app.applicantEmail || 'N/A'}`);
        if (app.applicant) {
          console.log(`      User ID: ${app.applicant._id}`);
          console.log(`      Role: ${app.applicant.role || 'N/A'}`);
        }
        console.log('');
        
        console.log('   💼 채용공고 정보:');
        console.log(`      공고 제목: ${app.jobTitle || 'N/A'}`);
        console.log(`      회사명: ${app.companyName || 'N/A'}`);
        if (app.jobVacancy) {
          console.log(`      공고 ID: ${app.jobVacancy._id}`);
          console.log(`      위치: ${app.jobVacancy.country || 'N/A'} - ${app.jobVacancy.jobLocation || 'N/A'}`);
        }
        console.log('');
        
        console.log('   📄 지원서 내용:');
        const coverLetterPreview = app.coverLetter 
          ? (app.coverLetter.substring(0, 100) + (app.coverLetter.length > 100 ? '...' : ''))
          : 'N/A';
        console.log(`      Cover Letter: ${coverLetterPreview}`);
        console.log(`      Resume: ${app.resume || 'N/A'}`);
        
        if (app.employerNote) {
          console.log('');
          console.log('   💬 기업 메모:');
          console.log(`      ${app.employerNote}`);
        }
        
        console.log('');
        console.log('='.repeat(70));
        console.log('');
      });
    }

    // 상태별 통계
    const stats = await Application.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    console.log('\n📈 상태별 통계:');
    console.log('─'.repeat(70));
    stats.forEach(s => {
      console.log(`   ${s._id.padEnd(15)}: ${s.count}개`);
    });
    console.log('');

    // Collection 정보
    const db = mongoose.connection.db;
    const collections = await db.listCollections({ name: 'applications' }).toArray();
    if (collections.length > 0) {
      const stats = await db.collection('applications').stats();
      console.log('\n📦 Collection 정보:');
      console.log('─'.repeat(70));
      console.log(`   Document 개수: ${stats.count}`);
      console.log(`   평균 Document 크기: ${Math.round(stats.avgObjSize)} bytes`);
      console.log(`   Total 크기: ${Math.round(stats.size / 1024)} KB`);
      console.log(`   인덱스 개수: ${stats.nindexes}`);
      console.log('');
    }

  } catch (err) {
    console.error('❌ 에러:', err);
  } finally {
    await mongoose.connection.close();
    console.log('✅ MongoDB 연결 종료\n');
  }
}

checkApplicationData();
