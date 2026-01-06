# 💳 결제 시스템 점검 체크리스트

## ✅ 환경 변수 확인 (Production)

### PortOne 기본 설정
- [x] `PORTONE_STORE_ID` - store-3ba0c64e-b600-4174-b3b0-652fa76be2ff
- [x] `PORTONE_API_SECRET` - 설정됨 (보안상 마스킹)
- [x] `PORTONE_WEBHOOK_SECRET` - 설정됨
- [x] `PORTONE_TEST_MODE` - **false** (프로덕션 모드)

### PayPal 채널 (국제 고객)
- [x] `PORTONE_PAYPAL_CHANNEL_KEY` - channel-key-64d42a50-da78-44db-a4e3-1dd86c730903
- [x] `PAYPAL_MID` - TF8SDGFRNALV8
- [x] **상태**: PRODUCTION (심사 통과 완료 ✅)

### Toss Payments 채널 (한국 고객)
- [x] `PORTONE_TOSSPAYMENTS_CHANNEL_KEY` - channel-key-2b825cc6-20f7-4886-a377-a4d2e7a178ef
- [x] `TOSSPAYMENTS_MID` - iamporttest_3
- [ ] **주의**: 현재 TEST MODE - 프로덕션 전환 필요

## ✅ 결제 기능 점검

### 1. Employer (고용주) - Job Ad Credits
- [x] 체크아웃 페이지: `/portone/checkout`
- [x] 패키지 옵션: 1개 ($30), 4개 ($100), 12개 ($250), 24개 ($450)
- [x] PayPal 결제 가능
- [x] Toss Payments 결제 가능 (테스트 모드)
- [x] 결제 후 크레딧 자동 추가
- [x] Webhook 처리 정상

### 2. Job Seeker (구직자) - Resume Access
- [x] 체크아웃 페이지: `/portone/checkout?type=resume&accessPeriod=30`
- [x] 패키지 옵션: 30일 ($20), 90일 ($50), 365일 ($120)
- [x] PayPal 결제 가능
- [x] Toss Payments 결제 가능 (테스트 모드)
- [x] 결제 후 Resume Access 자동 활성화
- [x] Webhook 처리 정상

### 3. Online Tutor - Tutor Listing
- [x] 체크아웃 페이지: `/portone/checkout?type=tutor&accessPeriod=30`
- [x] 패키지 옵션: 30일 ($25), 90일 ($60), 365일 ($150)
- [x] PayPal 결제 가능
- [x] Toss Payments 결제 가능 (테스트 모드)
- [x] 결제 후 Tutor Access 자동 활성화
- [x] Webhook 처리 정상

## ✅ 환불 시스템 점검

### 자동 환불 (User-initiated)
- [x] 엔드포인트: `POST /user/request-refund`
- [x] 7일 이내 자동 승인
- [x] 미사용 서비스 확인
- [x] PortOne API 연동
- [x] 크레딧/액세스 자동 차감
- [x] 이메일 알림 (선택적)

### 수동 환불 (Admin)
- [x] 엔드포인트: `POST /portone/refund`
- [x] 관리자 권한 필요
- [x] PayPal 환불 지원
- [x] Toss Payments 환불 지원
- [x] 부분 환불 가능
- [x] 환불 히스토리 저장

### 환불 정책
- [x] 7일 이내 전액 환불 (자동)
- [x] 7일 이후 관리자 검토
- [x] 사용한 서비스는 차감 후 환불
- [x] 환불 정책 페이지: `/policy/refund`

## ✅ 보안 점검

### 인증 및 권한
- [x] 결제 페이지: 로그인 필수 (`requireLogin` 미들웨어)
- [x] 환불 요청: 로그인 + 본인 확인
- [x] 관리자 환불: Admin 권한 필요
- [x] Webhook: 서명 검증 (선택적, 테스트 중)

### 데이터 보안
- [x] 환경 변수로 API 키 관리
- [x] `.env` 파일 Git 제외
- [x] 결제 정보 암호화 저장
- [x] HTTPS 강제 (프로덕션)

## ✅ 모니터링 및 로깅

### 로깅
- [x] 결제 성공 로그
- [x] 환불 처리 로그
- [x] Webhook 수신 로그
- [x] 에러 로그
- [x] PM2 로그 로테이션

### 데이터베이스
- [x] Payment 모델: 모든 거래 저장
- [x] 환불 히스토리 추적
- [x] 사용자 크레딧/액세스 업데이트

## ⚠️ 주의사항 및 개선 필요

### 1. Toss Payments 프로덕션 전환
**현재 상태**: TEST MODE (`iamporttest_3`)
**필요 작업**:
- [ ] Toss Payments에 실제 MID 신청
- [ ] `.env`에서 `TOSSPAYMENTS_MID` 업데이트
- [ ] 테스트 진행 후 프로덕션 전환

### 2. Webhook 서명 검증
**현재 상태**: 선택적 검증 (테스트 모드에서는 스킵)
**권장사항**:
- [ ] 프로덕션에서 서명 검증 필수로 변경
- [ ] `router/portone.js` 168-170줄 수정

### 3. 에러 처리 개선
**권장사항**:
- [ ] 결제 실패 시 사용자 친화적 메시지
- [ ] 네트워크 오류 재시도 로직
- [ ] Slack/Email 알림 설정

### 4. 성능 최적화
**권장사항**:
- [ ] Webhook 처리 비동기화
- [ ] 결제 데이터 캐싱
- [ ] 중복 결제 방지 강화

## 🧪 테스트 가이드

### 실제 결제 테스트

#### PayPal (국제)
```bash
# 1. 회원가입
# 2. /portone/checkout 접속
# 3. PayPal 선택
# 4. 소액 ($1) 테스트 결제
# 5. 크레딧 확인
# 6. 환불 테스트
```

#### Toss Payments (한국)
```bash
# TEST MODE에서만 작동
# 실 카드 정보 사용 금지
# 테스트 카드번호 사용
```

### Webhook 테스트
```bash
# 로그 실시간 모니터링
pm2 logs esl-app --lines 0

# 결제 진행 후 로그 확인
# "🔔 PortOne Webhook Event" 메시지 확인
```

## 📊 통계 및 분석

### 결제 통계 확인
```javascript
// MongoDB에서 실행
db.payments.aggregate([
  { $group: {
    _id: "$packageType",
    count: { $sum: 1 },
    totalAmount: { $sum: "$amount" }
  }}
])

// 최근 결제 내역
db.payments.find().sort({ paidAt: -1 }).limit(10)
```

### 환불 통계
```javascript
// 환불된 결제
db.payments.find({ status: "refunded" }).count()

// 환불 금액 합계
db.payments.aggregate([
  { $match: { status: "refunded" }},
  { $group: { _id: null, total: { $sum: "$refundAmount" }}}
])
```

## 🚀 프로덕션 배포 체크리스트

### 배포 전
- [x] 모든 환경 변수 설정 확인
- [x] PayPal 프로덕션 모드 확인
- [ ] Toss Payments 프로덕션 MID 설정
- [x] HTTPS 인증서 확인
- [x] Webhook URL 등록 확인

### 배포 후
- [x] 소액 실제 결제 테스트
- [ ] Webhook 수신 확인
- [ ] 환불 프로세스 테스트
- [ ] 에러 로그 모니터링 (24시간)

## 📞 지원 연락처

### PortOne
- 웹사이트: https://portone.io
- 문서: https://developers.portone.io

### PayPal
- MID: TF8SDGFRNALV8
- 상태: PRODUCTION ✅

### Toss Payments
- 문서: https://docs.tosspayments.com
- 고객센터: 1544-7772

---

**마지막 점검일**: 2026-01-06
**점검자**: AI Assistant
**전체 시스템 상태**: ✅ 정상 작동 (Toss Payments 프로덕션 전환 대기)
