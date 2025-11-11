# PayPal 연동 설정 가이드 (PortOne)

**작성일:** 2025년 1월 15일  
**플랫폼:** ESL PLUS (https://eslplus.org)  
**결제 방식:** PayPal SPB (Smart Payment Button) via PortOne V2

---

## 🎯 개요

이 가이드는 ESL PLUS 플랫폼에 PayPal 해외결제를 연동하는 전체 과정을 안내합니다.

**좋은 소식:** 
- ✅ 포트원을 통해 **별도 계약 없이** PayPal 가입 가능
- ✅ 코드 연동 **이미 완료됨** (3개 checkout 페이지 모두)
- ✅ 승인이 빠름 (보통 1-2일)

**필요한 단계:**
1. PayPal Business 계정 생성
2. PortOne 콘솔에서 PayPal 채널 추가
3. 테스트 및 배포

---

## 📋 사전 준비사항

### 1. PayPal Business 계정
- 개인 PayPal 계정이 있어도 Business로 업그레이드 필요
- 한국 사업자로 등록 가능
- **중요:** 한국 판매자는 한국 구매자로부터 결제 불가 (해외 구매자만 가능)

### 2. PortOne 계정
- 이미 보유 중 (Eximbay 신청 시 생성됨)
- Store ID: 기존과 동일 사용
- 새로운 Channel Key 필요 (PayPal 전용)

### 3. 사업자 정보
- 사업자등록증
- 대표자 정보
- 은행 계좌 (PayPal 정산 수령용)

---

## 🚀 Step 1: PayPal Business 계정 생성

### 1.1 PayPal 가입
https://www.paypal.com/kr/webapps/mpp/account-selection

**계정 유형 선택:**
- ❌ 개인 계정
- ✅ **비즈니스 계정** (Business Account)

**필수 입력 정보:**
- 사업체명: Linked Data Center Co., Ltd.
- 사업자등록번호
- 대표자명: Myungdae Cho
- 이메일: myungdae.cho@gmail.com (또는 사업용 이메일)
- 전화번호
- 주소
- 은행 계좌 정보

### 1.2 계정 인증
PayPal에서 요구하는 서류 제출:
- 사업자등록증 사본
- 신분증 (대표자)
- 은행 계좌 인증 (소액 입금 확인)

**소요 시간:** 1-3일

---

## 🔧 Step 2: PortOne 콘솔에서 PayPal 채널 추가

### 2.1 PortOne 콘솔 로그인
https://admin.portone.io/

**로그인 정보:**
- 이메일: (Eximbay 신청 시 사용한 이메일)
- 비밀번호: (기존 비밀번호)

### 2.2 결제 대행사 채널 추가

**경로:** 
```
PortOne 콘솔 → 결제 연동 → 결제대행사 설정 → 채널 추가
```

**설정 내용:**

1. **PG사 선택:**
   - PayPal 선택

2. **채널 이름:**
   - 예: "PayPal International"

3. **채널 유형:**
   - SPB (Smart Payment Button) 선택

4. **연동 방식:**
   - "PortOne을 통한 가입" 선택 ⭐
   - (별도 PayPal API 키 불필요)

5. **환경 설정:**
   - 테스트 환경: Sandbox
   - 운영 환경: Production
   
   **중요:** 처음에는 Sandbox로 테스트 후 Production으로 전환

6. **통화 설정:**
   - USD 선택 (기본)

7. **저장 후 Channel Key 복사**
   - 예: `channel-key-893597d6-e62d-410f-83f9-119f530b4b11`

---

## 🔑 Step 3: Channel Key 환경 변수 설정

### 3.1 .env 파일 업데이트

기존 Eximbay channelKey를 PayPal channelKey로 교체:

```bash
# 기존 (Eximbay)
# PORTONE_CHANNEL_KEY=channel-key-eximbay-xxxxx

# 새로 (PayPal)
PORTONE_CHANNEL_KEY=channel-key-893597d6-e62d-410f-83f9-119f530b4b11
```

**또는 별도로 관리:**
```bash
# Eximbay (사용 안 함)
PORTONE_CHANNEL_KEY_EXIMBAY=channel-key-eximbay-xxxxx

# PayPal (사용 중)
PORTONE_CHANNEL_KEY_PAYPAL=channel-key-893597d6-e62d-410f-83f9-119f530b4b11

# 실제 사용
PORTONE_CHANNEL_KEY=${PORTONE_CHANNEL_KEY_PAYPAL}
```

### 3.2 서버 재시작
```bash
pm2 restart linked_esl_app
```

---

## 🧪 Step 4: 테스트 (Sandbox)

### 4.1 PayPal Sandbox 계정 생성

**Developer Portal 접속:**
https://developer.paypal.com/

**Sandbox 테스트 계정 생성:**
1. Dashboard → Sandbox → Accounts
2. Create Account (Buyer/Seller 모두 생성)

**테스트 계정 정보 예시:**
- **Seller:** sb-seller123@business.example.com (판매자용)
- **Buyer:** sb-buyer456@personal.example.com (구매자용, 가상 카드 포함)

### 4.2 테스트 결제 진행

**테스트 URL:**
- Job Ads: https://eslplus.org/portone/checkout
- Resume Access: https://eslplus.org/portone/checkout-resume  
- Tutor Listing: https://eslplus.org/portone/checkout-tutor

**테스트 절차:**
1. 패키지 선택
2. "Select" 버튼 클릭
3. PayPal 버튼이 렌더링되는지 확인
4. PayPal 버튼 클릭
5. Sandbox 구매자 계정으로 로그인
6. 결제 승인
7. 성공 페이지로 리디렉션 확인

**확인 사항:**
- ✅ PayPal 버튼 정상 표시
- ✅ 팝업/리디렉션 정상 작동
- ✅ 결제 승인 성공
- ✅ 서버 검증 통과
- ✅ 데이터베이스 업데이트 확인

### 4.3 PortOne 콘솔에서 결제 내역 확인

**경로:**
```
PortOne 콘솔 → 결제 내역 → 전체 결제
```

**확인 항목:**
- 결제 ID (paymentId)
- 주문명 (orderName)
- 금액 (totalAmount)
- 상태 (status: paid)
- 고객 정보

---

## 🚀 Step 5: Production 배포

### 5.1 PayPal 계정 Production 전환

**확인 사항:**
- ✅ PayPal Business 계정 인증 완료
- ✅ 은행 계좌 연결 완료
- ✅ 사업자 서류 승인 완료

### 5.2 PortOne 채널을 Production으로 전환

**PortOne 콘솔:**
```
결제대행사 설정 → PayPal 채널 → 환경 설정 → Production
```

**중요:** 
- Sandbox에서 Production으로 전환 시 새로운 Channel Key 발급됨
- `.env` 파일 업데이트 필요
- 서버 재시작 필요

### 5.3 Production 테스트

**실제 카드로 소액 테스트:**
- 최소 금액 패키지로 실제 결제 테스트
- Job ad 1개 ($30) 또는 Tutor 1개월 ($20)
- 결제 후 환불 처리하여 수수료만 부담

---

## 💰 수수료 및 정산

### PayPal 수수료
- **일반 거래:** 약 2.9% + $0.30 USD
- **해외 거래:** 추가 1.5% (환율 수수료)
- **총 예상:** 약 4.4% + $0.30 USD

**예시 계산:**
```
결제 금액: $100
PayPal 수수료: $100 × 4.4% + $0.30 = $4.70
실수령액: $95.30
```

### 정산 주기
- **PayPal 잔액:** 즉시 PayPal 계정에 입금
- **은행 출금:** 수동으로 PayPal → 은행 계좌 이체
- **소요 시간:** 3-5 영업일

### 정산 확인
**PayPal 계정:**
```
PayPal → Activity → Statements
```

**PortOne 콘솔:**
```
정산 내역 → PayPal
```

---

## ⚠️ 주의사항 및 제약사항

### 1. 한국 판매자 제약
❌ **불가능:** 한국 PayPal 계정 → 한국 PayPal 계정  
✅ **가능:** 한국 PayPal 계정 → 해외 PayPal 계정

**해결책:**
- ESL PLUS는 국제 플랫폼이므로 문제없음
- 주요 고객: 일본, 중국, 동남아시아, 중동

### 2. 비동기 결제 처리
- PayPal 결제는 `pending` 상태가 있을 수 있음
- **반드시 웹훅 연동 필요** (향후 구현 권장)
- 현재 코드는 동기 처리만 구현됨

**웹훅 설정 (향후):**
```
PortOne 콘솔 → 웹훅 설정 → Endpoint URL 등록
Endpoint: https://eslplus.org/portone/webhook
```

### 3. 환율 변동
- USD 고정 가격이므로 환율 영향 없음
- PayPal 정산 시 KRW 환율 적용됨
- PayPal 환율은 시중 환율보다 약간 불리함 (약 1-2%)

### 4. 분쟁 및 차지백
- PayPal은 구매자 보호가 강함
- 명확한 서비스 약관 필요
- 디지털 상품이므로 증빙 자료 보관 권장

---

## 🔍 트러블슈팅

### 문제 1: PayPal 버튼이 안 보임
**원인:**
- Channel Key 잘못됨
- SDK 로드 실패
- `portone-ui-container` 클래스 누락

**해결:**
```bash
# 브라우저 콘솔 확인
console.log('PortOne SDK loaded:', typeof PortOne !== 'undefined');

# Channel Key 확인
echo $PORTONE_CHANNEL_KEY
```

### 문제 2: 결제 후 "Payment verification failed"
**원인:**
- 서버 검증 로직 오류
- paymentId 불일치

**해결:**
```bash
# 서버 로그 확인
pm2 logs linked_esl_app --lines 100

# 결제 내역 확인 (PortOne 콘솔)
```

### 문제 3: "Not available for this seller"
**원인:**
- PayPal Business 계정 인증 미완료
- 판매 권한 제한된 국가

**해결:**
- PayPal 계정 설정에서 Business 인증 완료
- 필요 시 PayPal 고객센터 연락 (02-3483-1131)

---

## 📞 지원 연락처

### PayPal 한국 고객센터
- **전화:** 02-3483-1131
- **운영시간:** 평일 09:00-18:00
- **이메일:** https://www.paypal.com/kr/smarthelp/contact-us

### PortOne 고객지원
- **채팅:** https://portone.io/ (우측 하단 채팅 아이콘)
- **이메일:** support@portone.io
- **문서:** https://developers.portone.io/

### 긴급 연락처
- **개발자:** Myungdae Cho
- **이메일:** myungdae.cho@gmail.com

---

## 📚 참고 문서

### PortOne 문서
- PayPal 연동 가이드: https://help.portone.io/content/paypal-international
- PayPal V2 API: https://developers.portone.io/opi/ko/integration/pg/v2/paypal-v2?v=v2
- 채널 설정: https://developers.portone.io/opi/ko/integration/ready/readme#3

### PayPal 문서
- PayPal Developer: https://developer.paypal.com/
- Business Account Setup: https://www.paypal.com/kr/webapps/mpp/account-selection
- Sandbox Testing: https://developer.paypal.com/docs/api-basics/sandbox/

---

## ✅ 체크리스트

### 설정 전 (사전 준비)
- [ ] PayPal Business 계정 생성
- [ ] 사업자등록증 제출 및 인증
- [ ] 은행 계좌 연결
- [ ] PortOne 계정 확인

### 설정 중 (채널 추가)
- [ ] PortOne 콘솔에서 PayPal 채널 추가
- [ ] Channel Key 복사
- [ ] .env 파일에 Channel Key 설정
- [ ] 서버 재시작

### 테스트 (Sandbox)
- [ ] PayPal Sandbox 계정 생성
- [ ] 테스트 결제 (Job Ads)
- [ ] 테스트 결제 (Resume Access)
- [ ] 테스트 결제 (Tutor Listing)
- [ ] PortOne 콘솔에서 결제 내역 확인

### 배포 (Production)
- [ ] PayPal 계정 Production 인증 완료
- [ ] PortOne 채널 Production 전환
- [ ] Production Channel Key 업데이트
- [ ] 서버 재시작
- [ ] 실제 결제 테스트 (소액)
- [ ] 정산 프로세스 확인

### 운영 (Post-Launch)
- [ ] 웹훅 연동 (권장)
- [ ] 결제 모니터링 설정
- [ ] 고객 지원 프로세스 수립
- [ ] 정산 자동화 검토

---

## 🎉 완료 후 다음 단계

### 1. 사용자 공지
- 웹사이트에 "PayPal로 결제 가능" 배너 추가
- 이메일 공지
- SNS 홍보

### 2. 다중 PG 전략
- PayPal: 해외 고객
- 국내 PG: 한국 고객
- 향후 Stripe 추가 검토

### 3. 매출 모니터링
- PayPal 거래량 추적
- 수수료 분석
- ROI 계산

---

**이 가이드로 PayPal 연동을 완료하면, 전세계 고객으로부터 결제를 받을 수 있습니다!** 🚀

궁금한 점이 있으면 언제든 연락주세요.

---

*문서 버전: 1.0*  
*최종 업데이트: 2025년 1월 15일*  
*작성자: Claude AI for ESL PLUS*
