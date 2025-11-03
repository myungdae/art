# 🧪 PortOne 결제 테스트 가이드

## 📋 현재 구현 상태

### ✅ 완료된 사항
1. **V2 SDK 구현** (권장 버전)
   - `PortOne.requestPayment()` 사용
   - 최신 SDK: `https://cdn.portone.io/v2/browser-sdk.js`
   - 채널 키 방식 사용

2. **채널 설정 완료**
   - 채널 키: `channel-key-0cc08dd4-cf14-4419-aa2b-4307afa1b11c`
   - PG상점아이디: `1849705C64` (테스트용)
   - 연동 모드: 테스트 연동

3. **3가지 결제 타입**
   - Employer Ads (채용 광고)
   - Resume Access (이력서 열람)
   - Tutor Listing (튜터 프로필)

---

## 🚀 테스트 시작하기

### 1단계: 로그인
```
https://esl.eventpool.kr/user/login
```
- 기존 계정으로 로그인
- 또는 관리자 계정 사용

---

### 2단계: 결제 페이지 접속

#### Option A: Employer Ads 결제
```
https://esl.eventpool.kr/portone/checkout
```

#### Option B: Resume Access 결제 (30일)
```
https://esl.eventpool.kr/portone/checkout?type=resume&accessPeriod=30
```

#### Option C: Tutor Listing 결제 (30일)
```
https://esl.eventpool.kr/portone/checkout?type=tutor&accessPeriod=30
```

---

### 3단계: 패키지 선택
- 원하는 패키지의 **[Select]** 또는 **[Purchase Now]** 버튼 클릭
- PortOne 결제창이 팝업으로 표시됩니다

---

### 4단계: 결제 정보 입력

#### 💳 Eximbay 테스트 카드
PortOne 공식 문서에서 제공하는 테스트 카드 정보 사용:
- 📚 https://developers.portone.io/opi/ko/integration/pg/v1/eximbay

일반적인 테스트 카드 형식:
- **카드번호**: Eximbay 제공 테스트 카드
- **유효기간**: 미래 날짜 (예: 12/25)
- **CVC**: 임의의 3자리 (예: 123)
- **카드소유자명**: 임의 입력

---

### 5단계: 결제 완료 확인

#### 성공 시
- ✅ 결제 성공 메시지
- ✅ 자동으로 해당 페이지로 리다이렉트
  - Employer → `/job-vacancies/new_paid_user`
  - Resume → `/user/mypage-jobseeker`
  - Tutor → `/user/mypage-tutor`

#### 실패 시
- ❌ 에러 메시지 표시
- 브라우저 콘솔(F12)에서 자세한 에러 확인

---

## 🔍 예상되는 화면 흐름

### 1. 결제 페이지
```
┌─────────────────────────────────┐
│  Purchase Job Vacancy Ads       │
├─────────────────────────────────┤
│                                 │
│  ┌──────────┐  ┌──────────┐   │
│  │ Package 1│  │ Package 2│   │
│  │  $50     │  │  $100    │   │
│  │ [Select] │  │ [Select] │   │
│  └──────────┘  └──────────┘   │
│                                 │
└─────────────────────────────────┘
```

### 2. PortOne 결제창 (팝업)
```
┌─────────────────────────────────┐
│  PortOne Payment                │
├─────────────────────────────────┤
│  Eximbay                        │
│                                 │
│  카드번호: [________________]  │
│  유효기간: [__/__]             │
│  CVC:     [___]                │
│  소유자명: [________________]  │
│                                 │
│           [결제하기]            │
└─────────────────────────────────┘
```

### 3. 결제 완료
```
┌─────────────────────────────────┐
│  ✅ Payment Successful!         │
│                                 │
│  Redirecting to your page...   │
└─────────────────────────────────┘
```

---

## 🐛 문제 해결 가이드

### 문제 1: 결제창이 뜨지 않음

#### 증상
- [Select] 버튼 클릭해도 아무 반응 없음

#### 해결 방법
1. **브라우저 콘솔 확인**
   ```
   F12 → Console 탭
   에러 메시지 확인
   ```

2. **팝업 차단 해제**
   ```
   브라우저 주소창 옆 팝업 아이콘 클릭
   "항상 허용" 선택
   페이지 새로고침
   ```

3. **PortOne SDK 로딩 확인**
   ```javascript
   // 콘솔에서 실행
   console.log(typeof PortOne);
   // "object" 또는 "function"이 나와야 정상
   ```

---

### 문제 2: "channelKey is invalid" 에러

#### 증상
- 콘솔에 채널 키 관련 에러 메시지

#### 해결 방법
1. **.env 파일 확인**
   ```bash
   cat /home/user/esl/.env | grep PORTONE_CHANNEL_KEY
   ```
   
2. **올바른 값 확인**
   ```
   PORTONE_CHANNEL_KEY=channel-key-0cc08dd4-cf14-4419-aa2b-4307afa1b11c
   ```

3. **서버 재시작**
   ```bash
   cd /home/user/esl
   pm2 restart esl
   ```

---

### 문제 3: 결제는 성공했지만 데이터가 업데이트 안 됨

#### 증상
- 결제 성공 메시지는 나왔지만
- 광고 크레딧이나 액세스가 추가되지 않음

#### 해결 방법
1. **서버 로그 확인**
   ```bash
   pm2 logs esl --nostream --lines 100
   ```

2. **Webhook 확인**
   - 포트원 관리자 콘솔 → Webhook 로그 확인
   - Webhook URL이 올바른지 확인
   ```
   https://esl.eventpool.kr/portone/webhook
   ```

3. **데이터베이스 직접 확인**
   - MongoDB에서 해당 사용자의 데이터 확인

---

### 문제 4: "Payment verification failed" 에러

#### 증상
- 결제는 완료되었지만 검증 실패

#### 해결 방법
1. **API Secret 확인** (실 운영 시)
   ```bash
   cat /home/user/esl/.env | grep PORTONE_API_SECRET
   ```

2. **서버 로그 확인**
   ```bash
   pm2 logs esl --nostream | grep -i error
   ```

3. **테스트 모드 확인**
   ```bash
   cat /home/user/esl/.env | grep PORTONE_TEST_MODE
   # true 여야 함
   ```

---

### 문제 5: 서버가 응답하지 않음

#### 증상
- 페이지가 로딩되지 않음
- 502 Bad Gateway 또는 504 Gateway Timeout

#### 해결 방법
1. **서버 상태 확인**
   ```bash
   pm2 status
   ```

2. **서버 재시작**
   ```bash
   cd /home/user/esl
   pm2 restart esl
   ```

3. **포트 확인 및 정리**
   ```bash
   fuser -k 8608/tcp
   pm2 restart esl
   ```

---

## 📊 테스트 체크리스트

### 기본 기능 테스트
```
□ 로그인 성공
□ 결제 페이지 로딩 확인
□ 패키지 목록 표시 확인
□ [Select] 버튼 클릭 시 결제창 팝업
□ 결제창에 Eximbay 로고 표시
□ 테스트 카드 정보 입력
□ 결제 진행 버튼 클릭
□ 결제 성공 메시지 확인
□ 자동 리다이렉트 확인
□ 데이터 업데이트 확인 (크레딧 추가 등)
```

### 3가지 결제 타입 테스트
```
□ Employer Ads 결제 테스트
□ Resume Access 결제 테스트
□ Tutor Listing 결제 테스트
```

### 에러 케이스 테스트
```
□ 잘못된 카드번호 입력 시 에러 처리
□ 결제 취소 시 처리 확인
□ 네트워크 에러 시 처리 확인
```

---

## 🔧 개발자 도구 활용

### 브라우저 콘솔에서 확인
```javascript
// 1. PortOne SDK 로딩 확인
console.log(typeof PortOne);

// 2. 채널 키 확인 (페이지 소스에서)
// View Page Source → 검색: channelKey

// 3. 결제 요청 전 로그
console.log('Payment request:', {
  channelKey: 'channel-key-...',
  paymentId: 'order_...',
  amount: 50
});

// 4. 결제 응답 로그
console.log('Payment response:', response);
```

### 서버 로그 실시간 모니터링
```bash
# 실시간 로그 보기
pm2 logs esl

# 최근 100줄만 보기
pm2 logs esl --nostream --lines 100

# 에러만 필터링
pm2 logs esl --err
```

---

## 📞 지원 요청

### 포트원 고객센터
```
📧 support@portone.io
🌐 https://help.portone.io
💬 관리자콘솔 우측 하단 채팅
```

### Eximbay 고객센터
```
☎️ 1566-3441
📧 cs@eximbay.com
🌐 https://support.eximbay.com
```

### 스크린샷 준비사항
문의 시 다음 정보를 함께 제공하면 빠른 해결 가능:
1. 브라우저 콘솔 스크린샷 (F12)
2. 에러 메시지 전문
3. 발생 시점 (날짜/시간)
4. 사용한 테스트 URL

---

## 🎯 다음 단계

### 테스트 성공 후
1. ✅ 테스트 결제 3가지 모두 성공 확인
2. ✅ 데이터베이스 업데이트 확인
3. ✅ Webhook 정상 작동 확인
4. → **Eximbay 실 계약 진행** (`CONTRACT_SUMMARY.md` 참고)

### 실 운영 전환 시
1. Eximbay와 계약 완료
2. 실 운영용 MID 및 Secret Key 발급
3. `.env` 파일 업데이트
   ```bash
   PORTONE_CHANNEL_KEY=실제채널키
   PORTONE_STORE_ID=실제MID
   PORTONE_API_SECRET=실제API시크릿
   PORTONE_TEST_MODE=false
   ```
4. 포트원 채널 설정을 "실 연동"으로 변경
5. 실제 카드로 테스트
6. 운영 시작!

---

**작성일**: 2025-11-03  
**테스트 환경**: https://esl.eventpool.kr  
**서버 포트**: 8608  
**SDK 버전**: V2 (최신 권장 버전)
