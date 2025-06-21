// 📄 middleware/requirePaidTutor.js

const OnlineTutor = require('../model/onlineTutor'); // ✅ 정확히 이 모델을 사용

// ✅ 비동기 미들웨어 함수 정의
async function requirePaidTutor(req, res, next) {
  try {
    const email = req.user.email;

    // DB에서 유료 등록된 튜터인지 확인
    const paidTutor = await OnlineTutor.findOne({ email });

    if (!paidTutor || !paidTutor.resumeAccess || !paidTutor.resumeAccess.startDate) {
      console.log('❌ Access denied: Not a paid tutor');
      return res.redirect('/online-tutor/payment-required');
    }

    // ✅ 세션 사용자에 추가 정보 동기화
    req.user.resumeAccess = paidTutor.resumeAccess;
    req.user.adsAvailable = paidTutor.adsAvailable || 0;

    next();
  } catch (err) {
    console.error('❌ requirePaidTutor error:', err);
    res.status(500).send("Internal Server Error");
  }
}

module.exports = { requirePaidTutor };
