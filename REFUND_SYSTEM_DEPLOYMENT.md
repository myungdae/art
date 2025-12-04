# 🚀 환불 시스템 배포 가이드

## 📋 목차
1. [시스템 개요](#시스템-개요)
2. [배포 절차](#배포-절차)
3. [기능 테스트](#기능-테스트)
4. [문제 해결](#문제-해결)

---

## 🎯 시스템 개요

### ✅ 완료된 기능

#### 1. **사용자 환불 요청 시스템**
- **위치**: 모든 사용자 마이페이지
  - Employer: `/user/mypage-employer`
  - Job Seeker: `/user/mypage-jobseeker`
  - Online Tutor: `/user/mypage-tutor`
  
- **기능**:
  - 구매 내역 테이블 (최근 10개 거래)
  - 환불 요청 버튼 (상태별 조건부 표시)
  - 환불 사유 입력 모달
  - 자동 승인 vs 관리자 검토 안내

#### 2. **자동 승인 로직**
- **Employer** (Job Ad Credits):
  - 구매 후 7일 이내
  - 구매 이후 새로운 Job Ad 미게시
  
- **Job Seeker** (Resume Access):
  - 구매 후 7일 이내
  - Resume Access 미사용 (사용 기간이 아직 시작되지 않음)
  
- **Online Tutor** (Tutor Visibility):
  - 구매 후 7일 이내
  - Tutor 프로필 미생성

#### 3. **관리자 환불 관리**
- **위치**: `/admin/revenue/transactions`
- **기능**:
  - 환불 요청 통계 카드
  - 승인/거부 버튼 (대기 중인 요청)
  - 환불 사유 표시
  - 직접 환불 버튼 (일반 거래)

#### 4. **PortOne 통합**
- API Secret 설정 완료
- Webhook Secret 설정 완료
- Webhook URL: `https://eslplus.org/portone/webhook`
- 결제 자동 처리 (Webhook)
- 환불 자동 처리 (API)

---

## 🚀 배포 절차

### Step 1: 서버 코드 업데이트

```bash
# 1. 서버 접속
ssh ubuntu@ip-172-31-2-218

# 2. 프로젝트 디렉토리로 이동
cd ~/esl

# 3. 현재 브랜치 확인
git branch

# 4. genspark_ai_developer 브랜치로 전환 (최신 코드 있음)
git checkout genspark_ai_developer

# 5. 최신 코드 가져오기
git pull origin genspark_ai_developer

# 6. 최신 커밋 확인 (b6df44c - 환불 UI 추가)
git log --oneline -5
```

**기대 결과**:
```
b6df44c feat(refund): Add user-facing refund request UI to all user mypages with auto-approval logic
ef3eaa6 feat(refund): Implement user-initiated refund request system with auto-approval
d77ebe1 fix(webhook): Temporarily bypass signature verification and add detailed logging
621c7b2 fix(config): Add PortOne V2 Webhook Secret for webhook signature verification
...
```

---

### Step 2: 환경 변수 확인

```bash
# .env 파일 확인
cat ~/esl/.env | grep PORTONE

# 다음 값들이 올바르게 설정되어 있어야 함:
# PORTONE_STORE_ID=store-3ba0c64e-b600-4174-b3b0-652fa76be2ff
# PORTONE_API_SECRET=live_sk_EP59LybZ8Bz5Zm9BJoJB86GYo7pR
# PORTONE_WEBHOOK_SECRET=wo9eAl8pcYQWKrW9uXdY05zByMMBgzmSIqN8qC6gSupj60b0u6cUNGMd1KfhKoPkU0uoIgThOQayiajN
# PORTONE_TEST_MODE=false
```

---

### Step 3: 서버 재시작

```bash
# 1. PM2 앱 중지
pm2 stop linked_esl_app

# 2. PM2 앱 삭제 (환경 변수 재로드 위해)
pm2 delete linked_esl_app

# 3. PM2 앱 시작
pm2 start ecosystem.config.js

# 4. 서버 상태 확인
pm2 list

# 5. 로그 확인 (에러 없는지 체크)
pm2 logs linked_esl_app --lines 50 --nostream
```

**기대 로그**:
```
✅ app.js started
✅ 몽고디비 연결 성공
✅ Cron Scheduler initialized
✅ SMTP: transporter verified
Listening on port 8608
```

---

### Step 4: 웹훅 테스트 (선택 사항)

```bash
# PortOne 대시보드에서 Webhook 테스트 호출 또는
# 서버에서 직접 테스트
curl -X POST https://eslplus.org/portone/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "imp_uid": "imp_test_deploy_check",
    "merchant_uid": "employer_1_68f83c28_1733320000000",
    "status": "paid",
    "amount": 1000,
    "pay_method": "card",
    "name": "Deployment Test",
    "buyer_email": "test@example.com",
    "buyer_name": "Test User"
  }'

# 로그 확인
pm2 logs linked_esl_app --lines 30 --nostream | grep "PortOne Webhook"
```

---

## 🧪 기능 테스트

### Test 1: 사용자 환불 요청 (Employer)

1. **Employer 계정으로 로그인**
   - URL: `https://eslplus.org/admin/login` (Admin 계정) 또는
   - URL: `https://eslplus.org/login` (일반 Employer 계정)

2. **Employer 마이페이지 접속**
   - URL: `https://eslplus.org/user/mypage-employer`

3. **구매 내역 확인**
   - 페이지 하단에 "Purchase History" 섹션 표시
   - 최근 구매 내역이 테이블로 표시됨

4. **환불 요청**
   - "Request Refund" 버튼 클릭
   - 환불 사유 입력 (예: "테스트 환불 요청")
   - "Submit Request" 클릭

5. **결과 확인**
   - 7일 이내 구매: "✅ 자동 승인되었습니다!" 메시지
   - 7일 이후 구매: "✅ 관리자 검토 중입니다." 메시지
   - 페이지 리로드 후 상태 변경 확인 (Paid → Refund Requested 또는 Refunded)

---

### Test 2: 관리자 환불 승인/거부

1. **Admin 계정으로 로그인**
   - URL: `https://eslplus.org/admin/login`

2. **거래 페이지 접속**
   - URL: `https://eslplus.org/admin/revenue/transactions`

3. **통계 확인**
   - "Refund Requests" 카드에 대기 중인 환불 요청 수 표시

4. **환불 요청 관리**
   - 대기 중인 환불 요청 찾기 (노란색 "Refund Requested" 배지)
   - 환불 사유 확인
   - **승인**: "Approve" 버튼 클릭 → 확인 → 자동 환불 처리
   - **거부**: "Reject" 버튼 클릭 → 사유 입력 → 확인

5. **결과 확인**
   - 승인 시: 상태가 "Refunded"로 변경
   - 거부 시: "Refund Requested" 상태 제거
   - 사용자 크레딧/접근 권한 자동 차감 확인

---

### Test 3: 직접 환불 (Admin)

1. **Admin 계정으로 로그인**
   - URL: `https://eslplus.org/admin/revenue/transactions`

2. **일반 거래 찾기**
   - 상태가 "Paid"인 거래 선택

3. **환불 처리**
   - "Refund" 버튼 클릭
   - 환불 사유 입력
   - 확인

4. **결과 확인**
   - 상태가 "Refunded"로 변경
   - PortOne API 호출 성공
   - 사용자 크레딧/접근 권한 자동 차감

---

## 🔧 문제 해결

### 문제 1: 환불 요청 버튼이 안 보임

**원인**: 구매 내역이 없거나 이미 환불 요청됨

**해결**:
```bash
# MongoDB에서 사용자 결제 내역 확인
mongo
use eventpool
db.payments.find({ userId: ObjectId("USER_ID") })
```

---

### 문제 2: 자동 승인이 작동하지 않음

**원인**: 자동 승인 조건 불만족

**해결**:
- Employer: 구매 후 Job Ad 게시 여부 확인
- Job Seeker: Resume Access 사용 여부 확인
- Online Tutor: Tutor 프로필 생성 여부 확인

```bash
# Job Ad 게시 확인
db.job_vacancies.find({ 
  user: ObjectId("USER_ID"), 
  createdAt: { $gte: ISODate("PAYMENT_DATE") } 
})

# Resume Access 확인
db.users.findOne({ _id: ObjectId("USER_ID") }, { resumeAccess: 1 })

# Tutor 프로필 확인
db.online_tutors.findOne({ email: "USER_EMAIL" })
```

---

### 문제 3: PortOne API 환불 실패

**원인**: API Secret 또는 Payment ID 오류

**해결**:
```bash
# 1. API Secret 확인
cat ~/esl/.env | grep PORTONE_API_SECRET

# 2. PM2 에러 로그 확인
pm2 logs linked_esl_app --err --lines 50

# 3. PortOne 대시보드에서 Payment ID 확인
# https://admin.portone.io/payments

# 4. 수동 환불 API 테스트
curl -X POST https://api.portone.io/payments/{PAYMENT_ID}/cancel \
  -H "Authorization: PortOne {API_SECRET}" \
  -H "Content-Type: application/json" \
  -d '{"reason": "테스트 환불"}'
```

---

### 문제 4: Webhook이 수신되지 않음

**원인**: Webhook URL 미등록 또는 이벤트 미활성화

**해결**:
1. PortOne 대시보드 → Developer Center → Webhooks
2. Endpoint URL 확인: `https://eslplus.org/portone/webhook`
3. Events 활성화 확인:
   - `Transaction.Paid` ✅
   - `Transaction.Failed` ✅
   - `Transaction.Cancelled` ✅
4. "Test Webhook" 기능으로 수동 테스트
5. 서버 로그 확인:
```bash
pm2 logs linked_esl_app --lines 100 | grep "PortOne Webhook"
```

---

## 📊 배포 체크리스트

### 배포 전
- [ ] `.env` 파일에 PortOne API Secret 설정
- [ ] `.env` 파일에 PortOne Webhook Secret 설정
- [ ] 코드 리뷰 완료 (PR #12)
- [ ] 로컬 테스트 완료

### 배포 중
- [ ] 서버 코드 업데이트 (`git pull`)
- [ ] PM2 재시작 (`pm2 restart` 또는 `pm2 delete` + `pm2 start`)
- [ ] 서버 로그 확인 (에러 없음)
- [ ] Webhook 테스트 (PortOne 대시보드)

### 배포 후
- [ ] 사용자 환불 요청 기능 테스트 (Employer, Job Seeker, Tutor)
- [ ] 자동 승인 로직 테스트 (7일 이내 조건)
- [ ] 관리자 승인/거부 기능 테스트
- [ ] 직접 환불 기능 테스트
- [ ] 크레딧/접근 권한 자동 차감 확인
- [ ] 결제 기록 상태 업데이트 확인

---

## 🔗 관련 링크

- **PR #12**: https://github.com/myungdae/esl/pull/12
- **사용자 가이드**: `USER_REFUND_GUIDE.md`
- **PortOne 대시보드**: https://admin.portone.io
- **Admin 거래 페이지**: https://eslplus.org/admin/revenue/transactions

---

## ✅ 완료 상태

### 코드 변경
- [x] Payment 모델에 `refundRequest` 필드 추가
- [x] `/user/request-refund` API 구현 (자동 승인 로직)
- [x] `/admin/approve-refund` API 구현 (승인/거부)
- [x] Employer 마이페이지 UI 추가
- [x] Job Seeker 마이페이지 UI 추가
- [x] Online Tutor 마이페이지 UI 추가
- [x] Admin 거래 페이지 UI 개선
- [x] 자동 승인 조건 로직 구현
- [x] 크레딧/접근 권한 자동 차감 구현

### 배포 준비
- [x] PortOne API Secret 설정
- [x] PortOne Webhook Secret 설정
- [x] Webhook URL 등록 (`https://eslplus.org/portone/webhook`)
- [x] Webhook 이벤트 활성화 (Transaction.Paid, etc.)
- [x] PR #12 생성 및 업데이트
- [x] 배포 가이드 작성

### 테스트 대기
- [ ] 서버 배포 (`git pull` + `pm2 restart`)
- [ ] 사용자 환불 요청 테스트
- [ ] 관리자 승인/거부 테스트
- [ ] 자동 승인 로직 테스트
- [ ] 크레딧 차감 테스트

---

## 📝 다음 단계

1. **서버 배포**:
   ```bash
   cd ~/esl
   git checkout genspark_ai_developer
   git pull origin genspark_ai_developer
   pm2 restart linked_esl_app --update-env
   ```

2. **기능 테스트**: 위 "기능 테스트" 섹션 참조

3. **Production 배포**: 
   - PR #12 머지
   - `main` 브랜치로 전환
   - 최종 배포

---

**배포 완료 후 테스트 결과를 공유해주세요!** 🚀
