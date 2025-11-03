# PortOne (Eximbay) 결제 연동 가이드

## 📋 개요
이 문서는 ESL Plus 프로젝트에 PortOne을 통한 Eximbay 결제 시스템 연동 방법을 설명합니다.

## 🔧 구현 완료 사항

### 1. 환경 설정 (.env)
```bash
# Portone (Eximbay) Configuration
PORTONE_CHANNEL_KEY=your_portone_channel_key_here
PORTONE_STORE_ID=1849705C64
PORTONE_API_SECRET=your_portone_api_secret_here
PORTONE_WEBHOOK_SECRET=your_portone_webhook_secret_here
PORTONE_TEST_MODE=true
```

### 2. 라우터 구현 (/router/portone.js)
- ✅ GET `/portone/checkout` - 결제 페이지 (Employer, Resume, Tutor)
- ✅ POST `/portone/webhook` - PortOne Webhook 엔드포인트
- ✅ POST `/portone/verify` - 서버측 결제 검증
- ✅ GET `/portone/success` - 결제 성공 페이지
- ✅ GET `/portone/cancel` - 결제 취소 페이지

### 3. View 템플릿 (Pug)
- ✅ `/views/portone/checkout.pug` - Employer 광고 결제
- ✅ `/views/portone/checkout_resume.pug` - Resume Access 결제
- ✅ `/views/portone/checkout_tutor.pug` - Tutor Listing 결제

### 4. 애플리케이션 통합 (app.js)
- ✅ PortOne 라우터 마운트: `/portone`

## 📝 PortOne 설정 방법

### 1단계: PortOne 회원가입 및 채널 설정
1. [PortOne 관리자 콘솔](https://admin.portone.io) 접속
2. 회원가입 및 로그인
3. "채널 설정" 메뉴로 이동
4. 새 채널 생성:
   - **연동 모드**: 테스트 연동
   - **결제대행사**: 엑심베이
   - **결제모듈**: 결제창 일반결제
   - **채널 이름**: ESL Eximbay (임의 설정 가능)
   - **PG상점아이디(MID)**: `1849705C64` (테스트용)

### 2단계: API 키 발급
1. PortOne 콘솔에서 "API 키" 메뉴로 이동
2. **API Secret** 발급 (서버측 검증용)
3. **채널 키(Channel Key)** 복사 (결제창 호출용)

### 3단계: Webhook 설정
1. PortOne 콘솔에서 "웹훅" 메뉴로 이동
2. 웹훅 URL 설정: `https://esl.eventpool.kr/portone/webhook`
3. **Webhook Secret** 생성 및 복사

### 4단계: 환경 변수 설정
`.env` 파일에 발급받은 키를 입력:
```bash
PORTONE_CHANNEL_KEY=channel_key_xxxxxxxxxxxxx
PORTONE_STORE_ID=1849705C64
PORTONE_API_SECRET=api_secret_xxxxxxxxxxxxx
PORTONE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
PORTONE_TEST_MODE=true
```

## 🧪 테스트 방법

### 로컬 테스트
```bash
# 서버 시작
cd /home/user/esl
pm2 start ecosystem.config.js

# 테스트 결제 페이지 접속
# Employer Ads: http://localhost:8608/portone/checkout
# Resume Access: http://localhost:8608/portone/checkout?type=resume&accessPeriod=30
# Tutor Listing: http://localhost:8608/portone/checkout?type=tutor&accessPeriod=30
```

### Eximbay 테스트 카드
PortOne 문서에서 제공하는 Eximbay 테스트 카드 정보를 사용하세요:
- 테스트 카드 정보는 [PortOne 문서](https://developers.portone.io/opi/ko/integration/pg/v1/eximbay) 참고

### 국내 결제창 테스트 (한국 카드)
국내 결제창을 호출하려면 `bypass.issuercountry: "KR"` 설정이 필요합니다.
현재 구현에서는 자동으로 설정되지 않으니, 필요시 템플릿 수정 필요.

## 🔄 결제 흐름

### 1. 클라이언트 결제 요청
```javascript
// 프론트엔드 (Pug 템플릿)
const response = await PortOne.requestPayment({
  storeId: 'store_id',
  channelKey: 'channel_key',
  paymentId: 'order_' + new Date().getTime(),
  orderName: 'Product Name',
  totalAmount: 100,
  currency: 'USD',
  payMethod: 'CARD',
  customer: { ... },
  customData: {
    userId: 'user_id',
    type: 'employer',
    adPackage: '10'
  }
});
```

### 2. 서버측 결제 검증
```javascript
// 백엔드 (router/portone.js)
POST /portone/verify
{
  "imp_uid": "payment_id",
  "merchant_uid": "order_id"
}
```

### 3. Webhook 수신 (자동)
```javascript
POST /portone/webhook
{
  "status": "paid",
  "merchant_uid": "order_id",
  "custom_data": { ... }
}
```

### 4. 사용자 데이터 업데이트
- **Employer**: `adsAvailable` 증가
- **Resume**: `resumeAccess` 활성화
- **Tutor**: `tutorAccess` 활성화

## 🌐 프로덕션 배포 체크리스트

### 실 운영 전환 시
1. [ ] Eximbay와 계약 체결
2. [ ] Eximbay에서 실 운영용 MID 및 Secret Key 발급
3. [ ] PortOne 콘솔에서 "실 연동" 모드로 채널 설정 변경
4. [ ] `.env` 파일 업데이트:
   ```bash
   PORTONE_STORE_ID=your_production_mid
   PORTONE_API_SECRET=your_production_secret
   PORTONE_TEST_MODE=false
   ```
5. [ ] Webhook URL을 프로덕션 도메인으로 변경
6. [ ] 실제 카드로 테스트 결제 진행
7. [ ] 결제 완료 후 데이터베이스 업데이트 확인

## 📚 참고 문서
- [PortOne 공식 문서](https://developers.portone.io/)
- [Eximbay 채널 설정](https://help.portone.io/content/eximbay)
- [PortOne JavaScript SDK](https://developers.portone.io/opi/ko/integration/pg/v1/eximbay)

## 🐛 트러블슈팅

### 결제창이 뜨지 않는 경우
- PortOne SDK가 로드되었는지 확인
- 콘솔에서 에러 메시지 확인
- `channelKey`와 `storeId`가 올바른지 확인

### Webhook이 수신되지 않는 경우
- Webhook URL이 올바른지 확인
- 서버가 외부에서 접근 가능한지 확인
- PortOne 콘솔의 Webhook 로그 확인

### 결제 검증 실패
- API Secret이 올바른지 확인
- Access Token 발급이 정상적으로 되는지 확인
- PortOne API 엔드포인트가 올바른지 확인

## 💡 추가 기능 구현 가이드

### 다른 통화 지원
```javascript
// USD 대신 KRW 사용
currency: 'KRW',
totalAmount: 10000, // 원화 금액
```

### 정기 결제 (현재 미지원)
PortOne은 Eximbay 정기결제를 지원하지 않습니다.
정기결제가 필요한 경우 다른 PG사 고려 필요.

### 국내 결제창 호출
```javascript
bypass: {
  eximbay: {
    issuercountry: "KR"  // 국내 결제창
  }
}
```

## 🔗 관련 파일
- `/router/portone.js` - 라우터 로직
- `/views/portone/*.pug` - 결제 페이지 템플릿
- `/.env` - 환경 변수 설정
- `/app.js` - 라우터 마운트

---

**작성일**: 2025-11-03  
**작성자**: AI Assistant  
**버전**: 1.0.0
