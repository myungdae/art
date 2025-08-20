// model/onlineTutor.js
const mongoose = require('mongoose');

const ResumeAccessSchema = new mongoose.Schema(
  {
    startDate: { type: Date },
    durationDays: { type: Number, min: 0 },
    expiresAt: { type: Date },
  },
  { _id: false }
);

const OnlineTutorSchema = new mongoose.Schema(
  {
    // 기본
    fullName: { type: String, trim: true },
    email:    { type: String, required: true, trim: true, lowercase: true, index: true },

    // 소개 (CKEditor HTML 저장)
    description: { type: String }, // dc:description

    // 시맨틱 입력 3종
    expertise:          { type: String, trim: true }, // esl:expertise
    tutoringExperience: { type: String, trim: true }, // esl:tutoringExperience
    gender:             { type: String, trim: true }, // esl:gender

    // 연락
    skypeId: { type: String, trim: true }, // Skype_ID

    // 열람권
    resumeAccess: ResumeAccessSchema,
  },
  {
    collection: 'online_tutors',
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// expiresAt 자동 보완
OnlineTutorSchema.pre('save', function (next) {
  const ra = this.resumeAccess;
  if (ra && ra.startDate && typeof ra.durationDays === 'number' && ra.durationDays >= 0) {
    if (!ra.expiresAt) {
      ra.expiresAt = new Date(ra.startDate.getTime() + ra.durationDays * 86400000);
    }
  }
  next();
});

OnlineTutorSchema.virtual('resumeAccessRemainingDays').get(function () {
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

module.exports = mongoose.model('OnlineTutor', OnlineTutorSchema);
