// model/jobSeeker.js
const mongoose = require('mongoose');

const ResumeAccessSchema = new mongoose.Schema(
  {
    // 시작일 + 기간(일)로 만료일을 계산합니다. (expiresAt 직접 저장도 허용)
    startDate: { type: Date },
    durationDays: { type: Number, min: 0 },
    expiresAt: { type: Date },
  },
  { _id: false }
);

const JobSeekerSchema = new mongoose.Schema(
  {
    // 기본 정보
    fullName: { type: String, trim: true },
    email:    { type: String, required: true, trim: true, lowercase: true, index: true },

    // 제목/소개 (CKEditor HTML 저장 가능)
    title:       { type: String, trim: true },   // rdfs:label
    description: { type: String },               // dc:description (HTML 허용)

    // 시맨틱 입력 3종
    nationality:           { type: String, trim: true }, // http://schema.org/nationality[@value]
    preferredWorkLocation: { type: String, trim: true }, // esl:preferredWorkLocation[@value]
    major:                 { type: String, trim: true }, // esl:major[@value]

    // 기타
    languageSpoken: { type: [String], default: [] },     // ["English","Korean"] 권장
    dateAvailable:  { type: Date },

    // 이력서 열람권 (Admin 대시보드에서 남은 일수 계산용)
    resumeAccess: ResumeAccessSchema,
  },
  {
    collection: 'job_seekers',
    timestamps: true, // createdAt, updatedAt
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

/* ---------- Hooks ---------- */
// startDate + durationDays로 expiresAt 자동 설정(빈 값이면 건너뜀)
JobSeekerSchema.pre('save', function (next) {
  const ra = this.resumeAccess;
  if (ra && ra.startDate && typeof ra.durationDays === 'number' && ra.durationDays >= 0) {
    if (!ra.expiresAt) {
      ra.expiresAt = new Date(ra.startDate.getTime() + ra.durationDays * 86400000);
    }
  }
  next();
});

/* ---------- Virtuals ---------- */
// 남은 일수(오늘 기준, 음수면 0으로)
JobSeekerSchema.virtual('resumeAccessRemainingDays').get(function () {
  const ra = this.resumeAccess;
  if (!ra) return 0;
  const now = Date.now();
  let end = null;

  if (ra.expiresAt instanceof Date) end = ra.expiresAt.getTime();
  else if (ra.startDate instanceof Date && typeof ra.durationDays === 'number') {
    end = ra.startDate.getTime() + ra.durationDays * 86400000;
  }

  if (!end) return 0;
  const diff = Math.ceil((end - now) / 86400000);
  return Math.max(0, diff);
});

module.exports = mongoose.model('JobSeeker', JobSeekerSchema);
