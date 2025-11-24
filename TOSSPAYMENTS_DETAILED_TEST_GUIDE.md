# Toss Payments 상세 테스트 가이드

**작성일:** 2025-11-24  
**담당자:** 토스페이먼츠 검증팀

---

## ⚠️ 중요: 반드시 "Domestic Payment" 선택 필요

저희 시스템은 **2가지 결제 방식**을 제공합니다:
- **Domestic Payment (국내 결제)** → **Toss Payments** ✅ 이것을 선택하세요!
- **International Payment (해외 결제)** → PayPal

반드시 **"Domestic Payment"**를 선택하셔야 Toss Payments 결제창이 호출됩니다.

---

## 📋 현재 설정 정보

```
MID: iamporttest_3
Store ID: store-3ba0c64e-b600-4174-b3b0-652fa76be2ff
Channel Key: channel-key-84d35b65-d8e8-4a22-8ad9-2d186749b80e
```

**코드 구현 상태:**
```javascript
const response = await PortOne.requestPayment({
  storeId: 'store-3ba0c64e-b600-4174-b3b0-652fa76be2ff',
  channelKey: 'channel-key-84d35b65-d8e8-4a22-8ad9-2d186749b80e',
  paymentId: merchantUid,
  orderName: 'Job Ad Package - 1 ads',
  totalAmount: 39000,
  currency: 'KRW',
  payMethod: 'EASY_PAY',
  customer: customerData
});
```

✅ Toss Payments 테스트 채널이 정상적으로 지정되어 있습니다.

---

## 🔍 단계별 테스트 방법

### Step 1: 회원가입 (필수)

**URL:** https://eslplus.org/user/register

1. 페이지 접속
2. Role 선택: **"I want to HIRE teachers"** 클릭
3. 이메일, 비밀번호 입력
4. "Register" 버튼 클릭

**테스트 계정 예시:**
```
이메일: tosstest@example.com
비밀번호: test1234!
```

---

### Step 2: 로그인

**URL:** https://eslplus.org/user/login

1. 위에서 생성한 계정으로 로그인
2. 로그인 성공 후 자동으로 마이페이지로 이동

---

### Step 3: 결제 페이지 접속

**URL:** https://eslplus.org/portone/checkout

로그인하지 않으면 로그인 페이지로 리다이렉트됩니다.

---

### Step 4: 패키지 선택

화면에 4개의 패키지가 표시됩니다:
- 1 Job Ad: $30
- 4 Job Ads: $100
- 12 Job Ads: $240
- 24 Job Ads: $400

**아무 패키지나 선택** → "Select" 버튼 클릭

---

### Step 5: 결제 방법 선택 ⚠️ 중요!

패키지 선택 후 **2가지 결제 방법**이 표시됩니다:

```
┌─────────────────────────────┐  ┌─────────────────────────────┐
│   Domestic Payment          │  │ International Payment       │
│   (국내 결제)                │  │ (해외 결제)                  │
│                             │  │                             │
│   💳 Card / Bank Transfer   │  │   💰 PayPal                 │
│   Toss Payments             │  │                             │
└─────────────────────────────┘  └─────────────────────────────┘
     ↑ 이것을 클릭하세요!
```

**반드시 왼쪽의 "Domestic Payment"를 클릭하세요!**

---

### Step 6: Toss Payments 결제창 호출 확인

"Domestic Payment" 선택 후:

1. **결제 UI가 로드됩니다**
2. **Toss Payments 결제창이 표시됩니다**
3. 브라우저 개발자 도구(F12) → Console 탭에서 다음 로그 확인:

```javascript
🔍 Toss Payments request: {
  storeId: "store-3ba0c64e-b600-4174-b3b0-652fa76be2ff",
  channelKey: "channel-key-84d35b65-d8e8-4a22-8ad9-2d186749b80e",
  paymentId: "employer_1_5f8e9a2b_1732406400000",
  orderName: "Job Ad Package - 1 ads",
  totalAmount: 39000,
  currency: "KRW"
}
```

---

## 🎯 테스트 체크리스트

테스트 시 다음 사항을 확인해주세요:

- [ ] 회원가입 완료
- [ ] 로그인 완료
- [ ] https://eslplus.org/portone/checkout 접속
- [ ] 패키지 선택 (1 Job Ad 추천)
- [ ] **"Domestic Payment" 선택** (중요!)
- [ ] Toss Payments 결제창 호출 확인
- [ ] Channel Key가 `channel-key-84d35b65-d8e8-4a22-8ad9-2d186749b80e`인지 확인
- [ ] MID가 `iamporttest_3`로 호출되는지 확인

---

## 🔧 문제 발생 시 확인 사항

### 문제 1: "Domestic Payment" 버튼이 안 보임

**원인:** 로그인하지 않았거나, 패키지를 선택하지 않음

**해결:**
1. 로그인 확인
2. 패키지 선택 ("Select" 버튼 클릭)
3. 결제 방법 선택 화면이 나타나야 함

---

### 문제 2: "International Payment"만 보임

**원인:** 화면 스크롤이 필요하거나, CSS 문제

**해결:**
1. 화면을 아래로 스크롤
2. 2개의 결제 방법이 나란히 표시되어야 함

---

### 문제 3: 결제창이 호출되지 않음

**원인:** JavaScript 오류 또는 네트워크 문제

**해결:**
1. 브라우저 개발자 도구(F12) → Console 탭 확인
2. 오류 메시지 확인
3. 네트워크 탭에서 `portone.io` 호출 확인

---

## 💡 추가 테스트 URL

같은 방법으로 다른 결제 유형도 테스트 가능합니다:

### Resume Access 결제
**URL:** https://eslplus.org/portone/checkout?type=resume

**방법:**
1. 로그인 (Employer 계정)
2. 위 URL 접속
3. 기간 선택 (30일, 90일, 365일)
4. "Select" 클릭
5. **"Domestic Payment" 선택**

---

### Tutor Listing 결제
**URL:** https://eslplus.org/portone/checkout?type=tutor

**방법:**
1. 회원가입 시 **"I'm a TEACHER looking for job"** 선택
2. 로그인 (Tutor 계정)
3. 위 URL 접속
4. 기간 선택 (30일, 90일, 365일)
5. "Select" 클릭
6. **"Domestic Payment" 선택**

---

## 🖼️ 예상 화면 플로우

```
1. 패키지 선택 화면
   ┌─────────────────────────┐
   │ 1 Job Ad - $30          │
   │ [Select]                │ ← 클릭
   └─────────────────────────┘

           ↓

2. 결제 방법 선택 화면
   ┌─────────────────┐  ┌─────────────────┐
   │ Domestic Payment│  │International    │
   │ [Toss Payments] │  │[PayPal]         │
   └─────────────────┘  └─────────────────┘
         ↓ 클릭
         
3. Toss Payments 결제창
   ┌─────────────────────────┐
   │ Toss Payments           │
   │ ₩39,000                 │
   │ [카드 결제]              │
   │ [계좌이체]               │
   │ [간편결제]               │
   └─────────────────────────┘
```

---

## 🛠️ 기술 정보

### SDK 버전
- **PortOne V2 Browser SDK**
- CDN: `https://cdn.portone.io/v2/browser-sdk.js`

### 코드 위치
- Frontend: `/views/portone/checkout.pug` (Line 273-282)
- Backend: `/router/portone.js` (Line 234-353)

### 환경 변수
```bash
# .env 파일
PORTONE_STORE_ID=store-3ba0c64e-b600-4174-b3b0-652fa76be2ff
PORTONE_TOSSPAYMENTS_CHANNEL_KEY=channel-key-84d35b65-d8e8-4a22-8ad9-2d186749b80e
TOSSPAYMENTS_MID=iamporttest_3
```

---

## 📞 연락처

**개발팀:** 조명대  
**이메일:** myungdae.cho@gmail.com  
**프로젝트:** ESL PLUS  
**도메인:** https://eslplus.org

테스트 중 문제가 발생하면 다음 정보와 함께 연락 주세요:
- 브라우저 Console 로그 (F12 → Console)
- 네트워크 요청 정보 (F12 → Network)
- 발생한 오류 메시지

---

## ✅ 최종 확인

**Toss Payments 테스트 채널이 정상적으로 구현되어 있습니다.**

- ✅ Channel Key 설정 완료
- ✅ MID (`iamporttest_3`) 설정 완료
- ✅ 3개 결제 페이지 모두 Toss Payments 지원
- ✅ `PortOne.requestPayment()` 정상 호출
- ✅ 결제창 호출 코드 구현 완료

**"Domestic Payment" 선택만 하시면 Toss Payments 결제창이 정상적으로 호출됩니다!**

---

*문서 버전: 1.0*  
*작성일: 2025-11-24*  
*작성자: ESL PLUS 개발팀*
