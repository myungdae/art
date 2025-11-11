# PayPal 빠른 시작 가이드

## ✅ 완료된 작업

1. **코드 연동 완료** ✅
   - 3개 결제 페이지 모두 PayPal 연동 완료
   - Job Ads 결제
   - Resume Access 결제
   - Tutor Listing 결제

2. **배포 완료** ✅
   - Git 커밋: `c9a2390`
   - GitHub 푸시 완료
   - 서버 재시작 완료

---

## 🚀 다음 단계 (당신이 해야 할 일)

### Step 1: PayPal Business 계정 생성 (20분)
https://www.paypal.com/kr/webapps/mpp/account-selection

**선택:** 비즈니스 계정  
**입력:**
- 회사명: Linked Data Center Co., Ltd.
- 이메일: myungdae.cho@gmail.com
- 사업자등록번호
- 은행 계좌

**서류 제출:**
- 사업자등록증 사본
- 신분증

**승인:** 1-3일 소요

---

### Step 2: PortOne 콘솔에서 PayPal 채널 추가 (5분)
https://admin.portone.io/

**경로:**  
```
결제 연동 → 결제대행사 설정 → 채널 추가 → PayPal 선택
```

**설정:**
- 채널 이름: "PayPal International"
- 연동 방식: **"PortOne을 통한 가입"** ⭐ (별도 계약 불필요!)
- 환경: Sandbox (테스트용)

**중요:** Channel Key 복사하기!

---

### Step 3: Channel Key 설정 (2분)

`.env` 파일 수정:
```bash
# PayPal Channel Key (PortOne 콘솔에서 복사)
PORTONE_CHANNEL_KEY=channel-key-여기에-붙여넣기
```

서버 재시작:
```bash
pm2 restart linked_esl_app
```

---

### Step 4: 테스트 (10분)

**테스트 URL:**
- https://eslplus.org/portone/checkout
- https://eslplus.org/portone/checkout-resume
- https://eslplus.org/portone/checkout-tutor

**확인:**
1. 패키지 선택
2. PayPal 버튼이 보이는지 확인 ✅
3. 버튼 클릭
4. PayPal 로그인 (Sandbox 계정)
5. 결제 승인
6. 성공 페이지로 이동 확인 ✅

---

### Step 5: Production 전환 (나중에)

테스트 성공 후:

1. **PayPal 계정 인증 완료 대기** (1-3일)
2. **PortOne에서 Production으로 전환**
3. **새 Channel Key로 업데이트**
4. **실제 결제 테스트**

---

## 📋 체크리스트

- [ ] PayPal Business 계정 생성
- [ ] 사업자등록증 제출
- [ ] PortOne에서 PayPal 채널 추가
- [ ] Channel Key 복사
- [ ] .env 파일에 Channel Key 입력
- [ ] 서버 재시작
- [ ] 테스트 결제 (Sandbox)
- [ ] Production 전환
- [ ] 실제 결제 테스트

---

## 💡 핵심 포인트

### PayPal의 장점
✅ **별도 계약 불필요** - PortOne 통해 즉시 가입  
✅ **빠른 승인** - 1-2일  
✅ **글로벌 신뢰도** - 전세계 사용자  
✅ **낮은 차지백** - 구매자 보호  

### 제약사항
❌ **한국인 → 한국인 결제 불가**  
✅ **한국인 → 해외인 결제 가능** (ESL PLUS는 OK!)

### 수수료
- 해외 거래: **약 4.4% + $0.30 USD**
- 예: $100 결제 → $95.30 수령

---

## 📞 도움이 필요하면

### PayPal 고객센터
- 전화: 02-3483-1131

### PortOne 지원
- 채팅: https://portone.io/ (우측 하단)
- 이메일: support@portone.io

### 상세 가이드
- `PAYPAL_SETUP_GUIDE.md` 파일 참고

---

## 🎯 예상 일정

| 단계 | 소요 시간 |
|-----|----------|
| PayPal 계정 생성 | 20분 |
| 서류 제출 | 10분 |
| PayPal 승인 대기 | **1-3일** ⏰ |
| PortOne 채널 추가 | 5분 |
| 설정 및 재시작 | 2분 |
| 테스트 | 10분 |
| **총 준비 시간** | **약 1-3일** |

---

## 🚀 지금 시작하세요!

1. **지금:** PayPal 계정 생성 시작
2. **오늘 안에:** 서류 제출
3. **1-3일 후:** 승인 확인 및 PortOne 설정
4. **바로:** 테스트 및 운영 시작!

---

**Eximbay가 안 되어서 다행입니다!** 

PayPal이 실제로 더 좋은 선택입니다:
- ✅ 더 빠른 승인
- ✅ 더 높은 신뢰도
- ✅ 더 쉬운 설정
- ✅ 글로벌 표준

**궁금한 점이 있으면 언제든 연락주세요!** 📧

---

*문서 버전: 1.0*  
*최종 업데이트: 2025년 1월 15일*
