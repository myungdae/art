'use strict';

/**
 * Year-end 2025 프로모 공통 헬퍼
 * - 공통: membership.tier = 'promo-free'
 * - Employer: "첫 1건 무료 등록" (firstPostUsed 플래그로 관리)
 * - Job Seeker: resumeAccess 90일 제공
 * - Online Tutor: tutorAccess 90일 제공
 *
 * 기존에 토큰(jobPostingTokens)을 쓰던 데이터가 남아있어도
 * canPostForFree()에서 함께 감지되도록 호환 처리합니다.
 */

/* ---------- 설정값 (환경변수로 조정 가능) ---------- */
const FREE_UNTIL = process.env.FREE_UNTIL ? new Date(process.env.FREE_UNTIL) : null;
// 프로모 창이 열렸는지 여부 (FREE_UNTIL이 없으면 "닫힘"으로 간주)
function isYearEnd2025Open() {
  return FREE_UNTIL ? (Date.now() <= FREE_UNTIL.getTime()) : false;
}

const SEEKER_DAYS = Number(process.env.FREE_DURATION_SEEKER_DAYS || 90);
const TUTOR_DAYS  = Number(process.env.FREE_DURATION_TUTOR_DAYS  || 90);

/* ---------- 유틸 ---------- */
function normalizeRole(raw) {
  const m = String(raw || '').trim().toLowerCase();
  if (m === 'employer' || m === 'employer / recruiter') return 'Employer';
  if (m === 'job seeker' || m === 'job_seeker' || m === 'jobseeker') return 'Job_Seeker';
  if (m === 'online tutor' || m === 'online_tutor' || m === 'onlinetutor') return 'Online_Tutor';
  return raw || '';
}
function days(n) { return n * 24 * 60 * 60 * 1000; }
function remainingDays(accessObj) {
  if (!accessObj || !accessObj.startDate || !accessObj.durationDays) return 0;
  const start = new Date(accessObj.startDate).getTime();
  const end = start + (Number(accessObj.durationDays) * days(1));
  const diff = Math.ceil((end - Date.now()) / days(1));
  return diff > 0 ? diff : 0;
}

/* -------------------------------------------------------
 * 가입 시/직후에 혜택을 부여
 *   - prefRole: 'Employer' | 'Job Seeker' | 'Online Tutor' (대소문자/스페이스 허용)
 *   - user: Mongoose Document 또는 Plain Object
 * ----------------------------------------------------- */
function applyYearEnd2025(user, prefRole) {
  const role = normalizeRole(prefRole || user.role);
  if (role) user.role = role;

  // 멤버십 표기(유료 active면 건드리지 않음)
  user.membership = user.membership || {};
  if (user.membership.active !== true) {
    user.membership.tier = 'promo-free';
  }

  // 프로모 네임스페이스
  user.promo = user.promo || {};
  user.promo.yearend2025 = user.promo.yearend2025 || { grantedAt: new Date() };

  // 역할별 혜택
  if (user.role === 'Employer') {
    // 첫 1건 무료: firstPostUsed 플래그로 관리
    if (typeof user.promo.yearend2025.firstPostUsed !== 'boolean') {
      user.promo.yearend2025.firstPostUsed = false;
    }
    // (호환) 과거 토큰 필드가 남아있다면 그대로 둠. 새로 추가/증가하지 않음.
  } else if (user.role === 'Job_Seeker') {
    // 무료 이력서 열람권(노출) 90일
    const curLeft = remainingDays(user.resumeAccess);
    if (curLeft < SEEKER_DAYS) {
      user.resumeAccess = {
        startDate: new Date(),
        durationDays: SEEKER_DAYS,
      };
    }
  } else if (user.role === 'Online_Tutor') {
    // 무료 튜터 노출 90일
    const curLeft = remainingDays(user.tutorAccess);
    if (curLeft < TUTOR_DAYS) {
      user.tutorAccess = {
        startDate: new Date(),
        durationDays: TUTOR_DAYS,
      };
    }
  }

  return user;
}

/* -------------------------------------------------------
 * Employer가 "첫 1건 무료"를 쓸 수 있는지
 *   - 프로모 창 열림 + promo-free + Employer + 아직 미사용
 *   - (호환) 예전 jobPostingTokens > 0 이면 허용
 * ----------------------------------------------------- */
function canPostForFree(user) {
  if (!user) return false;
  if (!isYearEnd2025Open()) return false;
  if (user.role !== 'Employer') return false;

  const promoFree = user.membership && user.membership.tier === 'promo-free';
  if (!promoFree) return false;

  const yp = user.promo && user.promo.yearend2025 || {};
  const notUsed = yp.firstPostUsed !== true;

  // (호환) 과거 토큰이 남아있으면 허용
  const legacyTokens = Number(yp.jobPostingTokens || 0) > 0;

  return notUsed || legacyTokens;
}

/* -------------------------------------------------------
 * Employer가 무료 1건을 방금 사용했을 때 호출(선택)
 *   - firstPostUsed = true
 *   - (호환) 과거 토큰이 남아있다면 1 감소
 *   - 호출자에서 user.save() 또는 updateOne() 처리
 * ----------------------------------------------------- */
function consumeEmployerFree(user) {
  if (!user) return user;
  user.promo = user.promo || {};
  user.promo.yearend2025 = user.promo.yearend2025 || { grantedAt: new Date() };
  user.promo.yearend2025.firstPostUsed = true;

  // (호환) 남아있는 과거 토큰이 있으면 1 차감
  const cur = Number(user.promo.yearend2025.jobPostingTokens || 0);
  if (cur > 0) user.promo.yearend2025.jobPostingTokens = cur - 1;

  return user;
}

/* -------------------------------------------------------
 * Seeker/Tutor 무료 노출(기간 내) 여부
 *  - 현재 access 객체가 살아있으면 true
 * ----------------------------------------------------- */
function canListProfile(user) {
  if (!user) return false;
  if (user.role === 'Job_Seeker') return remainingDays(user.resumeAccess) > 0;
  if (user.role === 'Online_Tutor') return remainingDays(user.tutorAccess) > 0;
  return false;
}

module.exports = {
  // 프로모 창 ON/OFF
  isYearEnd2025Open,

  // 가입/직후 혜택 부여
  applyYearEnd2025,

  // 사용 여부 체크 & 소비(옵션)
  canPostForFree,
  consumeEmployerFree,

  // seeker/tutor 노출 가능 여부
  canListProfile,
};
