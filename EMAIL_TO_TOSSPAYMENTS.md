# 토스페이먼츠 담당자에게 보낼 이메일

---

## 📧 이메일 템플릿

---

**제목:** [ESL PLUS] Toss Payments 테스트 MID 설정 완료 - 결제 테스트 요청

---

**수신:** [토스페이먼츠 담당자 이메일]  
**참조:** [포트원 담당자 이메일]

---

**본문:**

안녕하세요, ESL PLUS 개발팀입니다.

포트원을 통해 Toss Payments 연동 작업을 진행 중이며, 테스트 MID 설정이 완료되어 테스트 URL을 공유드립니다.

---

### 📋 테스트 MID 정보

- **MID:** iamporttest_3
- **PortOne Store ID:** store-3ba0c64e-b600-4174-b3b0-652fa76be2ff
- **PortOne Channel Key:** channel-key-84d35b65-d8e8-4a22-8ad9-2d186749b80e

---

### 🔗 테스트 URL (총 3개)

저희 서비스는 3가지 결제 유형을 지원하며, 모두 Toss Payments 연동이 완료된 상태입니다.

#### 1. Job Ads 결제 (구인광고 게시)
**URL:** https://eslplus.org/portone/checkout

**패키지:**
- 1 Job Ad: $30 (약 ₩39,000)
- 4 Job Ads: $100 (약 ₩130,000)
- 12 Job Ads: $240 (약 ₩312,000)
- 24 Job Ads: $400 (약 ₩520,000)

#### 2. Resume Access 결제 (이력서 열람 권한)
**URL:** https://eslplus.org/portone/checkout?type=resume

**패키지:**
- 30일: $30 (약 ₩39,000)
- 90일: $70 (약 ₩91,000)
- 365일: $200 (약 ₩260,000)

#### 3. Tutor Listing 결제 (튜터 프로필 등록)
**URL:** https://eslplus.org/portone/checkout?type=tutor

**패키지:**
- 30일: $20 (약 ₩26,000)
- 90일: $50 (약 ₩65,000)
- 365일: $150 (약 ₩195,000)

---

### 🧪 테스트 방법

1. **회원가입**
   - URL: https://eslplus.org/user/register
   - Role 선택: "I want to HIRE teachers" (Employer) 또는 "I'm a TEACHER looking for job" (Tutor)
   - 이메일, 비밀번호 입력 후 가입

2. **로그인**
   - 생성한 계정으로 로그인

3. **결제 페이지 접속**
   - 위의 3개 URL 중 하나 선택

4. **패키지 선택**
   - 원하는 패키지의 "Select" 버튼 클릭

5. **결제 방법 선택**
   - **"Domestic Payment"** (Toss Payments) 선택
   - ※ "International Payment" (PayPal)은 해외 고객용입니다

6. **결제창 확인**
   - Toss Payments 결제창이 정상적으로 호출되는지 확인
   - MID `iamporttest_3`로 호출되는지 확인

---

### 💡 참고사항

**기술 스택:**
- PortOne V2 Browser SDK 사용
- `PortOne.requestPayment()` 메서드로 결제 호출
- 결제 완료 후 서버 검증 (`/portone/verify`) 진행

**결제 금액:**
- 기본 금액은 USD이나, Toss Payments 호출 시 KRW로 자동 변환 (환율 약 1,300원 적용)

**테스트 계정:**
- 테스트 계정이 필요하시면 별도로 생성하여 제공 가능합니다
- 또는 위의 회원가입 URL에서 직접 생성 가능합니다

---

### 📞 연락처

**담당자:** 조명대  
**이메일:** myungdae.cho@gmail.com  
**프로젝트:** ESL PLUS (https://eslplus.org)

테스트 중 문제가 발생하거나 추가 정보가 필요하시면 언제든 연락 주시기 바랍니다.

감사합니다.

---

**ESL PLUS 개발팀**  
Linked Data Center Co., Ltd.

---

## 📎 첨부 파일 (선택)

필요하시면 `TOSSPAYMENTS_TEST_URLS.md` 파일을 첨부하시면 더욱 상세한 정보를 제공할 수 있습니다.

---

*이메일 템플릿 버전: 1.0*  
*작성일: 2025-11-24*
