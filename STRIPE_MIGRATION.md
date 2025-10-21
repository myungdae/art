# Stripe 결제 시스템 마이그레이션 가이드

## 🎉 변경 사항

### ✅ 완료된 작업
1. **PayPal → Stripe 전환**
   - PayPal SDK 제거 및 Stripe 패키지 설치 완료
   - 모든 결제 라우트를 `/paypal/*` → `/stripe/*`로 변경

2. **보안 강화**
   - SESSION_SECRET 설정 오류 수정
   - 안전한 세션 키 생성 및 적용

3. **Stripe 통합 구현**
   - ✅ Job Vacancy Ads 결제
   - ✅ Resume Access 결제 (30/90/365일)
   - ✅ Tutor Listing 결제 (30/90/365일)
   - ✅ 결제 성공/실패 처리
   - ✅ Webhook 지원 (선택사항)

## 🔑 필수 설정: Stripe API 키

### 1. Stripe 계정 생성
1. https://stripe.com 방문
2. 계정 생성 (무료)
3. Dashboard → Developers → API Keys 이동

### 2. API 키 복사
테스트 환경 (Sandbox):
- **Publishable key**: `pk_test_...`로 시작
- **Secret key**: `sk_test_...`로 시작

프로덕션 환경:
- **Publishable key**: `pk_live_...`로 시작
- **Secret key**: `sk_live_...`로 시작

### 3. .env 파일 업데이트

`.env` 파일에서 다음 값들을 **실제 Stripe 키**로 교체하세요:

```bash
# Stripe Configuration (테스트 환경)
STRIPE_PUBLIC_KEY=pk_test_51xxxxxxxxxxxxx
STRIPE_SECRET_KEY=sk_test_51xxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx  # Webhook 설정 시
```

**⚠️ 중요**: 
- `pk_test_your_stripe_public_key_here` → 실제 Publishable key로 교체
- `sk_test_your_stripe_secret_key_here` → 실제 Secret key로 교체
- `.env` 파일을 **절대 Git에 커밋하지 마세요**

## 🚀 테스트 방법

### 1. 로컬 서버 시작
```bash
cd /home/user/esl
npm install
npm run dev
```

### 2. 결제 테스트 카드 번호
Stripe 테스트 환경에서 사용 가능한 카드:

| 카드 번호 | 상태 |
|---------|------|
| `4242 4242 4242 4242` | 성공 |
| `4000 0000 0000 0002` | 카드 거절 |
| `4000 0025 0000 3155` | 3D Secure 필요 |

- **만료일**: 미래의 아무 날짜 (예: 12/25)
- **CVC**: 아무 3자리 숫자 (예: 123)
- **우편번호**: 아무 5자리 (예: 12345)

### 3. 테스트 순서
1. 사용자 로그인
2. Job Vacancy 등록 시도 → 결제 페이지로 이동
3. Stripe Checkout에서 테스트 카드로 결제
4. 결제 성공 후 자동으로 리다이렉트
5. 광고 크레딧이 추가되었는지 확인

## 📋 결제 플로우

### Employer (Job Ads)
```
1. /job-vacancies/new 접근
2. 크레딧 없음 → /stripe/checkout으로 리다이렉트
3. 패키지 선택 (1개, 4개, 12개, 24개)
4. Stripe Checkout 페이지로 이동
5. 결제 완료 → /stripe/success
6. DB 업데이트: adsAvailable 증가
7. /job-vacancies/new_paid_user로 이동
```

### Job Seeker (Resume Access)
```
1. /user/mypage-jobseeker 접근
2. Resume Access 구매 버튼 클릭
3. /stripe/checkout-resume 페이지
4. 기간 선택 (30/90/365일)
5. 결제 완료 → DB 업데이트
6. 마이페이지로 이동
```

### Tutor (Listing Visibility)
```
1. /user/mypage-tutor 접근
2. Tutor Access 구매 버튼 클릭
3. /stripe/checkout?type=tutor&accessPeriod=30
4. 결제 완료 → DB 업데이트
5. 마이페이지로 이동
```

## 🌍 글로벌 사용성

### ✅ 한국 고객
- **계정 불필요**: PayPal과 달리 Stripe는 카드 정보만으로 결제 가능
- **지원 카드**: Visa, Mastercard, Amex 등 국제 카드
- **한국 발행 카드**: 완벽 지원

### ✅ 전 세계
- **135개 이상 통화** 지원
- **카드 결제**: 가장 보편적인 결제 수단
- **깔끔한 UI**: 모바일/데스크톱 최적화

## 🔧 Webhook 설정 (선택사항)

Webhook은 결제 검증을 위한 선택적 기능입니다.

### 1. Stripe Dashboard에서 Webhook 생성
1. Dashboard → Developers → Webhooks
2. "Add endpoint" 클릭
3. URL: `https://esl.eventpool.kr/stripe/webhook`
4. 이벤트 선택: `checkout.session.completed`

### 2. Webhook Secret 복사
생성된 Webhook의 Signing Secret을 복사하여 `.env`에 추가:
```bash
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

## 📁 새로 추가된 파일

```
esl/
├── router/
│   └── stripe.js          # Stripe 결제 라우터 (NEW)
├── views/
│   └── stripe/
│       ├── checkout.pug          # Job Ads 결제 페이지
│       ├── checkout_resume.pug   # Resume 결제 페이지
│       └── checkout_tutor.pug    # Tutor 결제 페이지
└── .env                   # SESSION_SECRET 수정, Stripe 키 추가
```

## ⚠️ 삭제된/변경된 파일

- ❌ `router/paypal.js` - 더 이상 사용하지 않음
- ❌ `views/paypal/*` - 더 이상 사용하지 않음
- ✏️ `router/jobVacancy.js` - `/paypal/` → `/stripe/` 변경
- ✏️ `router/user.js` - `/paypal/` → `/stripe/` 변경
- ✏️ `app.js` - paypalRoutes → stripeRoutes
- ✏️ `package.json` - paypal-rest-sdk 제거, stripe 추가

## 🚨 문제 해결

### 에러: "No such publishable key"
→ `.env`의 `STRIPE_PUBLIC_KEY`를 실제 Stripe key로 교체하세요

### 에러: "Invalid API Key"
→ `.env`의 `STRIPE_SECRET_KEY`를 실제 Stripe key로 교체하세요

### 결제 성공했는데 크레딧이 안늘어남
→ Webhook이 제대로 설정되었는지 확인 (선택사항)
→ `/stripe/success` 라우트가 정상 작동하는지 확인

### 한국 카드가 안되는 경우
→ 테스트 환경에서는 Stripe 테스트 카드만 사용 가능
→ 프로덕션 환경(pk_live_*, sk_live_*)에서는 실제 카드 사용

## 📞 다음 단계

1. ✅ Stripe 계정 생성
2. ✅ API 키 발급
3. ✅ `.env` 파일에 실제 키 입력
4. ✅ 서버 재시작
5. ✅ 테스트 카드로 결제 테스트
6. ✅ 프로덕션 키로 변경 (라이브 배포 시)

## 🎯 장점 요약

| 항목 | PayPal | Stripe |
|-----|--------|--------|
| 한국 카드 지원 | ⚠️ 제한적 | ✅ 완벽 |
| 계정 필요 | ✅ 필수 | ❌ 불필요 |
| UI/UX | ⚠️ 복잡 | ✅ 깔끔 |
| 개발자 친화성 | ⚠️ 보통 | ✅ 우수 |
| 글로벌 지원 | ✅ 좋음 | ✅ 매우 좋음 |
| 수수료 | 2.9% + $0.30 | 2.9% + $0.30 |

---

**작업 완료일**: 2025년 10월 21일  
**작업자**: Claude (AI Assistant)  
**GitHub Commit**: 94f7bb8
