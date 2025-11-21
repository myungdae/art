// model/application.js
const mongoose = require('mongoose');

const ApplicationSchema = new mongoose.Schema(
  {
    // 지원자 정보
    applicant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Applicant user is required'],
      index: true
    },
    
    // 지원한 채용공고
    jobVacancy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'JobVacancy',
      required: [true, 'Job vacancy is required'],
      index: true
    },
    
    // 지원자 기본 정보 (스냅샷 - 나중에 참조가 삭제되어도 조회 가능)
    applicantName: { type: String, trim: true },
    applicantEmail: { type: String, trim: true, lowercase: true },
    
    // 지원 시점의 공고 정보 (스냅샷)
    jobTitle: { type: String, trim: true },
    companyName: { type: String, trim: true },
    
    // 지원서 내용
    coverLetter: { type: String }, // 자기소개서/커버레터
    resume: { type: String }, // 이력서 내용 또는 링크
    
    // 지원 상태
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'accepted', 'rejected', 'withdrawn'],
      default: 'pending',
      index: true
    },
    
    // 지원일
    appliedAt: { type: Date, default: Date.now, index: true },
    
    // 메모 (기업이 남기는 메모)
    employerNote: { type: String },
  },
  {
    collection: 'applications',
    timestamps: true, // createdAt, updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// 복합 인덱스: 한 사용자가 같은 공고에 중복 지원 방지
ApplicationSchema.index({ applicant: 1, jobVacancy: 1 }, { unique: true });

// 지원일 기준 내림차순 정렬용 인덱스
ApplicationSchema.index({ appliedAt: -1 });

module.exports = mongoose.model('Application', ApplicationSchema);
