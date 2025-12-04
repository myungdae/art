# 환불 시스템 가이드 (Refund System Guide)

## 📋 개요

ESL+ 플랫폼의 환불 시스템은 포트원(PortOne) API를 통해 PayPal과 Toss Payments 결제를 100% 환불 처리할 수 있습니다.

---

## ✅ 환불 기능 현황

### 1. 구현된 환불 기능

#### **API 엔드포인트**
- **경로**: `POST /portone/refund`
- **인증**: Admin 권한 필요
- **위치**: `/home/user/webapp/router/portone.js` (Line 477-602)

#### **지원 기능**
- ✅ PayPal 결제 환불
- ✅ Toss Payments (삼성카드 포함) 결제 환불
- ✅ 전액 환불 지원
- ✅ 부분 환불 지원
- ✅ 환불 사유 기록
- ✅ 환불 내역 추적
- ✅ 자동 크레딧 차감 (Employer 광고 크레딧)

#### **환불 프로세스**
```
1. 관리자가 거래 내역에서 환불 버튼 클릭
2. 환불 사유 입력
3. 확인 팝업
4. PortOne API를 통해 실제 결제 취소 요청
5. 데이터베이스에 환불 기록 저장
6. 사용자 크레딧/액세스 자동 차감
7. 상태 업데이트 (paid → refunded)
```

---

## 🔧 환불 시스템 구성

### 1. 데이터베이스 스키마

**Payment 모델** (`/home/user/webapp/model/payment.js`)
```javascript
{
  paymentId: String,          // PortOne 결제 ID
  merchantUid: String,        // 주문 고유 번호
  userId: ObjectId,           // 사용자 ID
  userEmail: String,          // 사용자 이메일
  amount: Number,             // 결제 금액
  currency: String,           // 통화 (KRW, USD 등)
  paymentMethod: String,      // 결제 수단
  packageType: String,        // job_ads, resume_access, tutor_access
  status: String,             // paid, refunded, cancelled 등
  
  // 환불 정보
  refundedAt: Date,           // 환불 일시
  refundAmount: Number,       // 환불 금액
  refundReason: String,       // 환불 사유
  refundHistory: [{           // 환불 이력 (부분환불 대응)
    refundedAt: Date,
    amount: Number,
    reason: String,
    refundId: String,
    adminUser: String
  }]
}
```

### 2. API 요청/응답 구조

#### **환불 요청**
```javascript
POST /portone/refund
Content-Type: application/json

{
  "paymentId": "imp_123456789",     // 필수: PortOne 결제 ID
  "reason": "고객 요청",              // 선택: 환불 사유
  "amount": 50000                    // 선택: 부분환불 금액 (없으면 전액)
}
```

#### **성공 응답**
```javascript
{
  "success": true,
  "message": "Refund processed successfully",
  "refund": {
    "cancellation_id": "cancel_abc123",
    "payment_id": "imp_123456789",
    "amount": 50000,
    "status": "cancelled"
  }
}
```

#### **실패 응답**
```javascript
{
  "success": false,
  "message": "Payment is not in paid status",
  "error": { ... }
}
```

---

## 🎯 환불 테스트 체크리스트

### A. 사전 준비

- [ ] 관리자 계정으로 로그인
- [ ] 테스트 결제 건이 존재하는지 확인
- [ ] 결제 상태가 'paid'인지 확인

### B. 관리자 페이지 테스트

#### 1. 거래 내역 페이지 접속
```
URL: https://your-domain.com/admin/revenue/transactions
```

- [ ] 페이지가 정상적으로 로드됨
- [ ] 모든 거래 내역이 표시됨
- [ ] 각 거래별로 상태 배지가 표시됨
- [ ] 'paid' 상태 거래에 "Refund" 버튼이 표시됨
- [ ] 'refunded' 상태 거래에는 "Refunded" 텍스트만 표시됨

#### 2. 검색 기능 테스트
- [ ] 검색창에 사용자 이름 입력 시 필터링됨
- [ ] 검색창에 이메일 입력 시 필터링됨
- [ ] 검색창에 Payment ID 입력 시 필터링됨
- [ ] 검색 초기화 시 모든 내역이 다시 표시됨

#### 3. 통계 카드 확인
- [ ] Total Transactions 수치 정확함
- [ ] Paid 건수 정확함
- [ ] Pending 건수 정확함
- [ ] Failed 건수 정확함
- [ ] Refunded 건수 정확함
- [ ] Total Revenue 금액 정확함
- [ ] Avg Transaction 금액 정확함

### C. 환불 프로세스 테스트

#### 1. 테스트 결제 환불 (Employer - Job Ads)
```javascript
// 테스트 시나리오
- Package Type: job_ads
- Original Amount: ₩50,000 (1 광고 크레딧)
- Expected Result: 
  - 전액 환불 완료
  - adsAvailable 1 감소
  - 상태가 'refunded'로 변경
```

**테스트 단계:**
1. [ ] "Refund" 버튼 클릭
2. [ ] 환불 사유 입력 프롬프트 표시됨
3. [ ] 환불 사유 입력: "테스트 환불"
4. [ ] 확인 팝업 표시됨
5. [ ] 확인 버튼 클릭
6. [ ] 성공 메시지 표시됨
7. [ ] 페이지 자동 새로고침됨
8. [ ] 해당 거래 상태가 "Refunded"로 변경됨
9. [ ] Refund 버튼이 "Refunded" 텍스트로 변경됨
10. [ ] Refunded 통계 카드 수치 증가 확인
11. [ ] 사용자 adsAvailable 1 감소 확인

#### 2. 테스트 결제 환불 (Job Seeker - Resume Access)
```javascript
// 테스트 시나리오
- Package Type: resume_access
- Original Amount: ₩20,000 (30일 액세스)
- Expected Result: 
  - 전액 환불 완료
  - resumeAccess 정보는 유지 (수동 처리 필요)
  - 상태가 'refunded'로 변경
```

**테스트 단계:**
1. [ ] "Refund" 버튼 클릭
2. [ ] 환불 사유 입력: "서비스 불만족"
3. [ ] 확인 팝업 승인
4. [ ] 성공 메시지 확인
5. [ ] 상태 변경 확인
6. [ ] 사용자 resumeAccess는 유지됨 (차감 미구현)

#### 3. 테스트 결제 환불 (Tutor - Tutor Listing)
```javascript
// 테스트 시나리오
- Package Type: tutor_access
- Original Amount: ₩30,000 (30일 리스팅)
- Expected Result: 
  - 전액 환불 완료
  - tutorAccess 정보는 유지 (수동 처리 필요)
  - 상태가 'refunded'로 변경
```

**테스트 단계:**
1. [ ] "Refund" 버튼 클릭
2. [ ] 환불 사유 입력: "중복 결제"
3. [ ] 확인 팝업 승인
4. [ ] 성공 메시지 확인
5. [ ] 상태 변경 확인
6. [ ] 사용자 tutorAccess는 유지됨 (차감 미구현)

### D. 환불 제한 사항 테스트

#### 1. 이미 환불된 거래 재환불 방지
- [ ] 'refunded' 상태 거래에는 Refund 버튼이 없음
- [ ] 강제로 API 호출 시 400 에러 반환
- [ ] 에러 메시지: "Payment is not in paid status"

#### 2. Pending/Failed 거래 환불 방지
- [ ] 'pending' 상태 거래에는 Refund 버튼이 없음
- [ ] 'failed' 상태 거래에는 Refund 버튼이 없음
- [ ] 강제로 API 호출 시 400 에러 반환

#### 3. 권한 체크
- [ ] 비로그인 상태에서 환불 API 호출 시 403 에러
- [ ] 일반 사용자 계정으로 환불 API 호출 시 403 에러
- [ ] Admin 계정만 환불 가능

### E. PortOne API 연동 테스트

#### 1. API 인증
- [ ] `PORTONE_API_SECRET` 환경변수가 설정되어 있음
- [ ] Access Token 발급 성공
- [ ] Authorization 헤더에 Bearer 토큰 포함

#### 2. 결제 조회
- [ ] `GET /payments/{paymentId}` API 호출 성공
- [ ] 결제 상태 확인 가능
- [ ] 결제 금액 확인 가능

#### 3. 환불 처리
- [ ] `POST /payments/{paymentId}/cancel` API 호출 성공
- [ ] 환불 ID (cancellation_id) 반환됨
- [ ] PortOne 대시보드에서 환불 내역 확인 가능

### F. 데이터베이스 업데이트 테스트

#### 1. Payment 문서 업데이트
- [ ] `status` 필드가 'paid'에서 'refunded'로 변경됨
- [ ] `refundedAt` 필드에 현재 시간 기록됨
- [ ] `refundAmount` 필드에 환불 금액 기록됨
- [ ] `refundReason` 필드에 환불 사유 기록됨

#### 2. 환불 이력 추가
- [ ] `refundHistory` 배열에 새 항목 추가됨
- [ ] `refundedAt`, `amount`, `reason` 기록됨
- [ ] `refundId` (PortOne cancellation_id) 기록됨
- [ ] `adminUser` (관리자 이메일) 기록됨

#### 3. 사용자 크레딧 차감
- [ ] job_ads 패키지 환불 시 `adsAvailable` 감소
- [ ] 정확한 수량만큼 감소 (packageDetails.quantity)
- [ ] 크레딧이 음수가 되지 않음 (0 이하 방지)

---

## 🔍 환불 시스템 개선 사항

### 현재 구현된 기능
✅ 관리자 페이지에서 환불 UI 제공  
✅ PortOne API 연동 (PayPal, Toss Payments)  
✅ 전액/부분 환불 지원  
✅ 환불 이력 추적  
✅ Employer 광고 크레딧 자동 차감  

### 개선 필요 사항

#### 1. **사용자 Self-Service 환불** (우선순위: 중)
현재는 관리자만 환불 가능하며, 사용자가 직접 환불을 요청할 수 없습니다.

**제안:**
```javascript
// router/user.js 또는 router/portone.js

router.post('/my-payments/:paymentId/refund-request', requireLogin, async (req, res) => {
  // 사용자가 자신의 결제 건에 대해 환불 요청
  // 관리자 승인 대기 상태로 변경
  // 이메일 알림 발송
});
```

**구현 방법:**
1. 마이페이지에 "내 결제 내역" 섹션 추가
2. 각 결제 건에 "환불 요청" 버튼 추가 (7일 이내, 미사용 상태만)
3. 환불 요청 시 Payment 문서에 `refundRequest: { requested: true, requestedAt: Date, reason: String }` 필드 추가
4. 관리자 대시보드에 "환불 요청 대기" 섹션 추가
5. 관리자가 승인/거부 처리

#### 2. **Resume/Tutor Access 자동 차감** (우선순위: 높음)
현재 Employer 광고 크레딧만 자동 차감되며, Resume/Tutor Access는 수동 처리가 필요합니다.

**현재 코드 (portone.js Line 565-572):**
```javascript
// Job Ads만 자동 차감됨
if (paymentRecord && paymentRecord.packageType === 'job_ads') {
  const quantity = paymentRecord.packageDetails?.quantity || 0;
  await User.findByIdAndUpdate(paymentRecord.userId, {
    $inc: { adsAvailable: -quantity }
  });
}
```

**개선 코드:**
```javascript
// Job Ads 자동 차감 (기존)
if (paymentRecord && paymentRecord.packageType === 'job_ads') {
  const quantity = paymentRecord.packageDetails?.quantity || 0;
  await User.findByIdAndUpdate(paymentRecord.userId, {
    $inc: { adsAvailable: -quantity }
  });
  console.log(`✅ Deducted ${quantity} ad credits from user ${paymentRecord.userId}`);
}

// Resume Access 자동 비활성화 (신규)
if (paymentRecord && paymentRecord.packageType === 'resume_access') {
  await User.findByIdAndUpdate(paymentRecord.userId, {
    $unset: { resumeAccess: "" }  // resumeAccess 필드 제거
  });
  console.log(`✅ Deactivated resume access for user ${paymentRecord.userId}`);
}

// Tutor Access 자동 비활성화 (신규)
if (paymentRecord && paymentRecord.packageType === 'tutor_access') {
  await User.findByIdAndUpdate(paymentRecord.userId, {
    $unset: { tutorAccess: "" }  // tutorAccess 필드 제거
  });
  console.log(`✅ Deactivated tutor listing for user ${paymentRecord.userId}`);
}
```

#### 3. **환불 가능 기간 제한** (우선순위: 중)
현재는 모든 paid 상태 거래를 환불할 수 있습니다.

**제안:**
- 결제 후 7일 이내만 환불 가능
- 서비스 사용 여부 체크 (예: 광고 게시 여부)
- 부분 환불 정책 (사용 기간에 비례한 환불)

```javascript
// portone.js refund 엔드포인트에 추가
const payment = paymentResponse.data;
const paymentDate = new Date(payment.paid_at);
const now = new Date();
const daysSincePaid = Math.floor((now - paymentDate) / (1000 * 60 * 60 * 24));

if (daysSincePaid > 7) {
  return res.status(400).json({
    success: false,
    message: "Refund period expired (7 days limit)"
  });
}
```

#### 4. **이메일 알림** (우선순위: 낮음)
환불 처리 시 사용자에게 이메일 알림을 보냅니다.

**제안:**
```javascript
// services/emailService.js (신규 생성 필요)
const sendRefundNotification = async (userEmail, paymentId, amount, reason) => {
  // 환불 완료 이메일 발송
  // 제목: "환불이 완료되었습니다"
  // 내용: 결제 ID, 환불 금액, 환불 사유, 예상 입금 일자
};
```

#### 5. **부분 환불 UI** (우선순위: 낮음)
현재는 전액 환불만 UI에서 가능하며, 부분 환불은 API를 직접 호출해야 합니다.

**제안:**
```javascript
// views/admin/transactions.pug에 추가
button.action-btn.partial-refund-btn(
  onclick=`partialRefundPayment('${txn.paymentId}', '${txn.userName}', ${txn.amount})`
)
  i.fas.fa-percent.me-1
  | Partial Refund

// JavaScript 함수 추가
async function partialRefundPayment(paymentId, userName, totalAmount) {
  const amountStr = prompt(`부분 환불 금액을 입력하세요 (최대 ₩${totalAmount.toLocaleString()}):`);
  const amount = parseInt(amountStr);
  
  if (isNaN(amount) || amount <= 0 || amount > totalAmount) {
    alert('❌ 유효하지 않은 금액입니다.');
    return;
  }
  
  const reason = prompt('환불 사유를 입력하세요:');
  if (!reason) return;
  
  // ... 환불 API 호출 (amount 파라미터 포함)
}
```

---

## 🚀 환불 시스템 사용 방법

### 1. 관리자가 환불 처리하는 경우

**단계:**
1. 관리자 대시보드 로그인
   - URL: `https://your-domain.com/admin/login`
   - Admin 계정 사용

2. 거래 내역 페이지 접속
   - URL: `https://your-domain.com/admin/revenue/transactions`
   - 또는 대시보드 메뉴에서 "Revenue" → "Transactions" 클릭

3. 환불할 거래 찾기
   - 검색창 사용 (사용자 이름, 이메일, Payment ID)
   - 또는 목록에서 직접 찾기

4. 환불 버튼 클릭
   - "Refund" 버튼 클릭
   - 환불 사유 입력 (예: "고객 요청", "서비스 불만족", "중복 결제" 등)
   - 확인 팝업에서 "OK" 클릭

5. 환불 완료 확인
   - 성공 메시지 확인
   - 페이지 새로고침 후 상태가 "Refunded"로 변경된 것 확인
   - Refunded 통계 카드 수치 증가 확인

### 2. 프로그래밍 방식으로 환불 처리하는 경우

**cURL 예제:**
```bash
curl -X POST https://your-domain.com/portone/refund \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=YOUR_ADMIN_SESSION_COOKIE" \
  -d '{
    "paymentId": "imp_123456789",
    "reason": "고객 요청",
    "amount": 50000
  }'
```

**JavaScript (Fetch) 예제:**
```javascript
const response = await fetch('/portone/refund', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    paymentId: 'imp_123456789',
    reason: '고객 요청',
    amount: 50000  // 선택사항: 부분환불 금액
  })
});

const result = await response.json();
if (result.success) {
  console.log('✅ 환불 완료:', result.refund);
} else {
  console.error('❌ 환불 실패:', result.message);
}
```

**Node.js (Axios) 예제:**
```javascript
const axios = require('axios');

async function refundPayment(paymentId, reason, amount) {
  try {
    const response = await axios.post('https://your-domain.com/portone/refund', {
      paymentId: paymentId,
      reason: reason,
      amount: amount
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'connect.sid=YOUR_ADMIN_SESSION_COOKIE'
      }
    });
    
    console.log('✅ 환불 완료:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ 환불 실패:', error.response?.data || error.message);
    throw error;
  }
}

// 사용 예제
refundPayment('imp_123456789', '고객 요청', 50000);
```

---

## 📊 환불 통계 확인

### 1. 거래 내역 페이지 통계 카드
- **Total Transactions**: 전체 거래 건수
- **Paid**: 결제 완료 건수
- **Pending**: 결제 대기 건수
- **Failed**: 결제 실패 건수
- **Refunded**: 환불 완료 건수
- **Total Revenue**: 총 매출 (환불 제외)
- **Avg Transaction**: 평균 거래 금액

### 2. MongoDB 쿼리로 확인

**전체 환불 내역 조회:**
```javascript
db.payments.find({ status: 'refunded' }).sort({ refundedAt: -1 });
```

**특정 기간 환불 내역:**
```javascript
db.payments.find({ 
  status: 'refunded',
  refundedAt: { 
    $gte: ISODate('2024-01-01T00:00:00Z'),
    $lt: ISODate('2024-12-31T23:59:59Z')
  }
});
```

**환불 총액 계산:**
```javascript
db.payments.aggregate([
  { $match: { status: 'refunded' } },
  { $group: { 
    _id: null, 
    totalRefunded: { $sum: '$refundAmount' },
    count: { $sum: 1 }
  }}
]);
```

**사용자별 환불 내역:**
```javascript
db.payments.aggregate([
  { $match: { status: 'refunded' } },
  { $group: { 
    _id: '$userId', 
    refundCount: { $sum: 1 },
    totalRefunded: { $sum: '$refundAmount' }
  }},
  { $sort: { refundCount: -1 } }
]);
```

---

## 🛠️ 문제 해결 (Troubleshooting)

### 문제 1: 환불 버튼이 보이지 않음

**원인:**
- 거래 상태가 'paid'가 아님
- 이미 환불된 거래 ('refunded' 상태)
- 관리자 권한이 없음

**해결:**
1. 거래 상태 확인: MongoDB에서 `db.payments.findOne({ paymentId: 'imp_xxx' })` 실행
2. 상태가 'pending', 'failed', 'refunded'인 경우 환불 불가
3. 관리자 세션 확인: `req.session.isAdmin === true` 여부 확인

### 문제 2: 환불 API 호출 시 403 Forbidden

**원인:**
- 관리자 권한이 없음
- 세션이 만료됨

**해결:**
1. `/admin/login`으로 다시 로그인
2. 환경변수 확인: `ADMIN_EMAIL`, `ADMIN_PASSWORD` 설정 확인
3. MongoDB User 컬렉션에서 `role: 'Admin'` 사용자 존재 확인

### 문제 3: 환불 API 호출 시 400 Bad Request

**원인:**
- Payment ID가 잘못됨
- 결제 상태가 'paid'가 아님
- PortOne API 인증 실패

**해결:**
1. Payment ID 확인: 정확한 `imp_` 또는 `pay_` 형식 확인
2. 환경변수 확인: `PORTONE_API_SECRET` 설정 확인
3. PortOne 대시보드에서 API Secret 키 재확인

### 문제 4: 환불 후 크레딧이 차감되지 않음

**원인:**
- packageType이 'job_ads'가 아님
- packageDetails.quantity 정보 누락
- User 업데이트 실패

**해결:**
1. Payment 문서 확인: `packageType`, `packageDetails` 필드 확인
2. User 문서 확인: `adsAvailable` 필드 존재 여부 확인
3. 서버 로그 확인: "Deducted X ad credits" 메시지 확인
4. Resume/Tutor 패키지는 수동 차감 필요 (현재 미구현)

### 문제 5: PortOne API 에러

**에러 메시지:**
- "Unauthorized": API Secret 키 오류
- "Payment not found": 잘못된 Payment ID
- "Payment cannot be cancelled": 이미 취소됨 또는 취소 불가 상태
- "Cancellable amount exceeded": 부분환불 금액이 잘못됨

**해결:**
1. PortOne 대시보드 로그인 → API 설정 확인
2. `.env` 파일 확인:
   ```
   PORTONE_API_SECRET=live_your_secret_key
   PORTONE_STORE_ID=your_store_id
   ```
3. PortOne 대시보드에서 해당 결제 건 상태 확인
4. 실제 결제가 승인되었는지 확인 (테스트 결제는 환불 불가)

---

## 📝 환불 정책 권장사항

### 1. 환불 가능 조건
- ✅ 결제 후 7일 이내
- ✅ 서비스를 사용하지 않은 경우
- ✅ 결제 오류 또는 중복 결제
- ✅ 서비스 품질 불만족 (사유 확인 필요)

### 2. 환불 불가 조건
- ❌ 결제 후 7일 초과
- ❌ 서비스를 이미 사용한 경우 (광고 게시, 이력서 조회 등)
- ❌ 이미 환불 처리된 건
- ❌ 무효화된 결제 건

### 3. 부분 환불 정책
- 사용 기간에 비례한 환불
- 예: 30일 패키지 중 10일 사용 → 20일분 환불
- 계산식: `환불금액 = 원결제금액 × (남은일수 / 전체일수)`

### 4. 크레딧/액세스 차감 정책
- **Employer (Job Ads)**: 환불 시 즉시 크레딧 차감
- **Job Seeker (Resume Access)**: 환불 시 즉시 액세스 비활성화 (구현 필요)
- **Tutor (Tutor Listing)**: 환불 시 즉시 리스팅 비활성화 (구현 필요)

---

## 🔐 보안 고려사항

### 1. 관리자 인증
- ✅ 세션 기반 인증 사용
- ✅ Admin 권한 체크 (`requireAdmin` middleware)
- ⚠️ 개선 필요: CSRF 토큰 추가

### 2. API 인증
- ✅ PortOne API Secret을 환경변수로 관리
- ✅ Bearer 토큰 인증 사용
- ✅ HTTPS 연결 사용

### 3. 데이터 검증
- ✅ Payment ID 존재 여부 확인
- ✅ 결제 상태 확인 ('paid' 상태만 환불 가능)
- ✅ 환불 금액 검증 (결제 금액 초과 방지)
- ⚠️ 개선 필요: 중복 환불 요청 방지

### 4. 감사 로그
- ✅ `refundHistory` 배열에 환불 이력 기록
- ✅ 관리자 계정 기록 (`adminUser` 필드)
- ✅ 환불 사유 기록 (`refundReason` 필드)
- ⚠️ 개선 필요: 별도 감사 로그 테이블

---

## 📞 고객 지원 가이드

### 환불 요청 접수 시 체크리스트

1. **고객 정보 확인**
   - 이름, 이메일, 전화번호
   - 결제 일시, 결제 금액

2. **결제 정보 확인**
   - Payment ID 확인
   - 결제 상태 확인 (paid/refunded)
   - 결제 수단 확인 (PayPal/Toss Payments)

3. **환불 사유 확인**
   - 중복 결제
   - 서비스 불만족
   - 기술적 오류
   - 기타 (상세 기재)

4. **환불 가능 여부 판단**
   - 결제 후 경과일 확인 (7일 이내)
   - 서비스 사용 여부 확인
   - 환불 정책 적용

5. **환불 처리**
   - 관리자 대시보드 로그인
   - 거래 내역에서 해당 건 찾기
   - 환불 버튼 클릭 및 사유 입력
   - 환불 완료 확인

6. **고객 안내**
   - 환불 완료 통보
   - 환불 금액 및 예상 입금 일자 안내
   - 크레딧/액세스 차감 안내

---

## 🎓 추가 학습 자료

### PortOne API 문서
- [PortOne 공식 문서](https://developers.portone.io/)
- [결제 취소 API](https://developers.portone.io/docs/api/rest-v2/payment#post-payments-payment_id-cancel)
- [Webhook 가이드](https://developers.portone.io/docs/guides/webhook)

### 관련 코드 파일
- `/home/user/webapp/router/portone.js` - 환불 API 구현
- `/home/user/webapp/router/admin.js` - 관리자 페이지
- `/home/user/webapp/views/admin/transactions.pug` - 거래 내역 UI
- `/home/user/webapp/model/payment.js` - Payment 스키마

### 환경 변수
- `PORTONE_API_SECRET` - PortOne API Secret Key
- `PORTONE_STORE_ID` - PortOne Store ID
- `ADMIN_EMAIL` - 관리자 이메일
- `ADMIN_PASSWORD` - 관리자 비밀번호

---

## 📌 요약

✅ **환불 기능 완전 구현됨**
- Admin 페이지에서 UI로 환불 가능
- PortOne API 연동 완료 (PayPal, Toss Payments)
- 전액/부분 환불 지원
- 환불 이력 추적
- Employer 광고 크레딧 자동 차감

⚠️ **개선 필요 사항**
- Resume/Tutor Access 자동 차감 구현
- 사용자 Self-Service 환불 요청 기능
- 환불 가능 기간 제한 (7일)
- 이메일 알림
- 부분 환불 UI

🎯 **테스트 방법**
1. 관리자 로그인
2. Transactions 페이지 접속
3. Paid 상태 거래에서 Refund 버튼 클릭
4. 환불 사유 입력 및 확인
5. 성공 메시지 확인 및 상태 변경 확인

---

**작성일**: 2024-12-04  
**버전**: 1.0.0  
**작성자**: GenSpark AI Developer
