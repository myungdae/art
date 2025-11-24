# Toss Payments 테스트 URL 안내

**작성일:** 2025-11-24  
**프로젝트:** ESL PLUS  
**도메인:** https://eslplus.org

---

## 📋 테스트 MID 정보

**설정 완료:**
- **MID:** `iamporttest_3`
- **PortOne Channel Key:** `channel-key-84d35b65-d8e8-4a22-8ad9-2d186749b80e`
- **PortOne Store ID:** `store-3ba0c64e-b600-4174-b3b0-652fa76be2ff`

---

## 🔗 Toss Payments 테스트 URL

### 1. Job Ads 결제 페이지 (구인광고)
**URL:** https://eslplus.org/portone/checkout

**테스트 방법:**
1. 로그인 필요 (Employer 계정)
2. 패키지 선택 (1개, 4개, 12개, 24개 중 선택)
3. "Select" 버튼 클릭
4. 결제 방법 선택에서 **"Domestic Payment"** (Toss Payments) 선택
5. Toss Payments 결제창 호출 확인

**패키지 옵션:**
- 1 Job Ad: $30 USD → ₩39,000 KRW
- 4 Job Ads: $100 USD → ₩130,000 KRW
- 12 Job Ads: $240 USD → ₩312,000 KRW
- 24 Job Ads: $400 USD → ₩520,000 KRW

---

### 2. Resume Access 결제 페이지 (이력서 열람)
**URL:** https://eslplus.org/portone/checkout?type=resume

**테스트 방법:**
1. 로그인 필요 (Employer 계정)
2. 기간 선택 (30일, 90일, 365일)
3. "Select" 버튼 클릭
4. 결제 방법 선택에서 **"Domestic Payment"** (Toss Payments) 선택
5. Toss Payments 결제창 호출 확인

**패키지 옵션:**
- 30 Days: $30 USD → ₩39,000 KRW
- 90 Days: $70 USD → ₩91,000 KRW
- 365 Days: $200 USD → ₩260,000 KRW

---

### 3. Tutor Listing 결제 페이지 (튜터 등록)
**URL:** https://eslplus.org/portone/checkout?type=tutor

**테스트 방법:**
1. 로그인 필요 (Tutor 계정)
2. 기간 선택 (30일, 90일, 365일)
3. "Select" 버튼 클릭
4. 결제 방법 선택에서 **"Domestic Payment"** (Toss Payments) 선택
5. Toss Payments 결제창 호출 확인

**패키지 옵션:**
- 30 Days: $20 USD → ₩26,000 KRW
- 90 Days: $50 USD → ₩65,000 KRW
- 365 Days: $150 USD → ₩195,000 KRW

---

## 🧪 테스트 계정 정보

### 테스트 계정 생성 방법

**회원가입 URL:** https://eslplus.org/user/register

**계정 타입별 회원가입:**

#### 1. Employer 계정 (Job Ads, Resume Access)
- Role 선택: **"I want to HIRE teachers"**
- 이메일, 비밀번호 입력 후 가입
- 로그인 후 결제 테스트 가능

#### 2. Tutor 계정 (Tutor Listing)
- Role 선택: **"I'm a TEACHER looking for job"**
- 이메일, 비밀번호 입력 후 가입
- 로그인 후 튜터 결제 테스트 가능

---

## 🔍 결제창 호출 기술 정보

### PortOne V2 SDK 사용

**SDK 버전:** PortOne Browser SDK V2

**결제 요청 코드:**
```javascript
const response = await PortOne.requestPayment({
  storeId: 'store-3ba0c64e-b600-4174-b3b0-652fa76be2ff',
  channelKey: 'channel-key-84d35b65-d8e8-4a22-8ad9-2d186749b80e',
  paymentId: merchantUid,
  orderName: 'Job Ad Package - 1 ads',
  totalAmount: 39000, // KRW
  currency: 'KRW',
  payMethod: 'EASY_PAY',
  customer: {
    fullName: '홍길동',
    email: 'test@example.com',
    phoneNumber: '010-1234-5678'
  }
});
```

### merchantUid 형식

**패턴:**
- Job Ads: `employer_{count}_{userId}_${timestamp}`
- Resume: `resume_{days}d_{userId}_${timestamp}`
- Tutor: `tutor_{days}d_{userId}_${timestamp}`

**예시:**
- `employer_1_5f8e9a2b_1732406400000`
- `resume_30d_5f8e9a2b_1732406400000`
- `tutor_30d_5f8e9a2b_1732406400000`

---

## 📱 결제 플로우

### 전체 프로세스

```
1. 사용자 로그인
   ↓
2. 결제 페이지 접속 (위의 3개 URL 중 하나)
   ↓
3. 패키지 선택 (가격 선택)
   ↓
4. "Select" 버튼 클릭
   ↓
5. 결제 방법 선택 화면
   - Domestic Payment (Toss Payments) ← 선택
   - International Payment (PayPal)
   ↓
6. Toss Payments 결제창 호출
   ↓
7. 결제 진행 (카드, 계좌이체, 간편결제 등)
   ↓
8. 결제 완료
   ↓
9. 서버 검증 (/portone/verify)
   ↓
10. 권한 부여 및 성공 페이지 이동
```

---

## 🔐 보안 및 검증

### 서버 측 검증 구현

**Endpoint:** `POST /portone/verify`

**검증 항목:**
- ✅ PortOne API로 결제 정보 조회
- ✅ 결제 상태 확인 (`status === "paid"`)
- ✅ merchantUid 일치 확인
- ✅ 금액 검증
- ✅ MongoDB에 결제 기록 저장

---

## 📊 테스트 체크리스트

### Toss Payments 담당자 확인 사항

- [ ] **결제창 호출 확인**
  - MID `iamporttest_3`로 호출되는지 확인
  - Channel Key 정상 동작 확인

- [ ] **3개 페이지 모두 테스트**
  - Job Ads 결제
  - Resume Access 결제
  - Tutor Listing 결제

- [ ] **결제 금액 확인**
  - USD → KRW 환율 적용 (약 1300원)
  - 패키지별 금액 정확성

- [ ] **결제 수단 확인**
  - 카드 결제
  - 계좌이체
  - 간편결제 (카카오페이, 네이버페이 등)

- [ ] **결제 완료 후 처리**
  - 성공 페이지 리다이렉션
  - 사용자 권한 자동 부여
  - 결제 기록 저장

---

## 🌐 환경 정보

### Production 환경

**도메인:** https://eslplus.org  
**서버:** AWS/Cloud 기반  
**데이터베이스:** MongoDB

### 기술 스택

- **Backend:** Node.js + Express
- **Frontend:** Pug (템플릿 엔진)
- **결제 SDK:** PortOne V2 Browser SDK
- **결제 방식:** 
  - 국내: Toss Payments
  - 해외: PayPal

---

## 📞 연락처

### ESL PLUS 개발팀

**담당자:** 조명대  
**이메일:** myungdae.cho@gmail.com  
**프로젝트:** ESL PLUS (https://eslplus.org)

### 문의 사항

테스트 중 문제가 발생하거나 추가 정보가 필요한 경우:
- 이메일로 문의 주시면 즉시 대응하겠습니다
- 로그인 계정 필요 시 테스트 계정 제공 가능
- 추가 설정이나 코드 수정 필요 시 즉시 반영 가능

---

## 📝 추가 정보

### Webhook 설정 (향후 구현 예정)

**Webhook URL:** https://eslplus.org/portone/webhook

**현재 상태:**
- ✅ Webhook 엔드포인트 구현 완료
- ✅ 결제 완료 시 자동 권한 부여
- ⚠️ Webhook 서명 검증 추가 권장

### 정산 정보

**정산 주기:** Toss Payments 정책 따름  
**정산 계좌:** 사업자 계좌 등록 필요  
**수수료:** Toss Payments 계약 조건 따름

---

## ✅ 테스트 준비 완료

**현재 상태:**
- ✅ `iamporttest_3` MID 설정 완료
- ✅ 3개 결제 페이지 모두 Toss Payments 연동 완료
- ✅ 결제 플로우 정상 작동 확인
- ✅ 서버 검증 로직 구현 완료

**Toss Payments 담당자께서 테스트 진행하시면 됩니다!** 🚀

---

## 🎯 테스트 시나리오 (권장)

### 시나리오 1: 간단 테스트

1. https://eslplus.org/portone/checkout 접속
2. 회원가입 (Employer 선택)
3. 로그인
4. "1 Job Ad - $30" 선택
5. "Domestic Payment" 선택
6. Toss Payments 결제창 확인

### 시나리오 2: 전체 플로우 테스트

1. 3개 URL 모두 접속
2. 각각 다른 패키지 선택
3. 결제창 호출 확인
4. (선택) 테스트 결제 진행
5. 결제 완료 및 권한 부여 확인

---

**테스트 진행 가능합니다!** ✅

궁금하신 점이나 문제가 있으시면 언제든 연락주세요.

---

*문서 버전: 1.0*  
*작성일: 2025-11-24*  
*작성자: ESL PLUS 개발팀*
