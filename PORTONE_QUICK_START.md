# 🚀 PortOne (Eximbay) 빠른 시작 가이드

## ✅ 완료된 작업

### 1. 코드 구현 완료
- ✅ `.env` 파일에 PortOne 설정 추가
- ✅ `/router/portone.js` - 결제 라우터 생성
- ✅ `/views/portone/*.pug` - 3개 결제 페이지 템플릿
- ✅ `app.js` - PortOne 라우터 통합
- ✅ GitHub 푸시 완료

### 2. 지원 결제 타입
1. **Employer Ads** - 채용 공고 광고
2. **Resume Access** - 이력서 열람 권한
3. **Tutor Listing** - 튜터 프로필 노출

## 🎯 다음 단계 (필수)

### Step 1: PortOne 가입 및 채널 설정
1. [PortOne 관리자 콘솔](https://admin.portone.io) 접속하여 회원가입
2. 새 채널 생성:
   - **연동 모드**: 테스트 연동 ✅
   - **결제대행사**: 엑심베이 ✅
   - **결제모듈**: 결제창 일반결제 ✅
   - **채널 이름**: ESL Eximbay (또는 원하는 이름)
   - **PG상점아이디**: `1849705C64` (테스트용) ✅

### Step 2: API 키 복사
PortOne 콘솔에서 다음 정보 복사:
- **Channel Key** (채널 키)
- **API Secret** (API 시크릿)
- **Webhook Secret** (웹훅 시크릿)

### Step 3: .env 파일 업데이트
`.env` 파일에서 다음 값을 실제 키로 교체:

```bash
# 현재 (업데이트 필요)
PORTONE_CHANNEL_KEY=your_portone_channel_key_here       # ← 여기 수정
PORTONE_STORE_ID=1849705C64                             # ← 테스트는 그대로
PORTONE_API_SECRET=your_portone_api_secret_here         # ← 여기 수정
PORTONE_WEBHOOK_SECRET=your_portone_webhook_secret_here # ← 여기 수정
PORTONE_TEST_MODE=true                                  # ← 테스트는 그대로

# 업데이트 후
PORTONE_CHANNEL_KEY=channel_key_xxxxxxxxxxxxx          # PortOne에서 복사
PORTONE_STORE_ID=1849705C64                            # 테스트용 유지
PORTONE_API_SECRET=api_secret_xxxxxxxxxxxxx            # PortOne에서 복사
PORTONE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx             # PortOne에서 복사
PORTONE_TEST_MODE=true                                 # 테스트용 유지
```

### Step 4: Webhook 설정
PortOne 콘솔에서 Webhook URL 설정:
```
https://esl.eventpool.kr/portone/webhook
```

### Step 5: 서버 재시작
```bash
cd /home/user/esl
pm2 restart esl
# 또는
pm2 restart all
```

## 🧪 테스트 방법

### 테스트 URL
로그인 후 다음 URL 접속:

1. **Employer Ads 결제**
   ```
   https://esl.eventpool.kr/portone/checkout
   ```

2. **Resume Access 결제 (30일)**
   ```
   https://esl.eventpool.kr/portone/checkout?type=resume&accessPeriod=30
   ```

3. **Tutor Listing 결제 (30일)**
   ```
   https://esl.eventpool.kr/portone/checkout?type=tutor&accessPeriod=30
   ```

### Eximbay 테스트 카드
테스트 결제 시 Eximbay가 제공하는 테스트 카드 정보 사용
(PortOne 문서 참고: https://developers.portone.io/opi/ko/integration/pg/v1/eximbay)

## 📊 결제 흐름 확인

### 1. 결제 완료 확인
- 결제 성공 시 자동으로 해당 페이지로 리다이렉트:
  - Employer → `/job-vacancies/new_paid_user`
  - Resume → `/user/mypage-jobseeker`
  - Tutor → `/user/mypage-tutor`

### 2. 데이터베이스 확인
결제 완료 후 User 모델 확인:
```javascript
// Employer: adsAvailable 증가
// Resume: resumeAccess 활성화
// Tutor: tutorAccess 활성화
```

### 3. Webhook 로그 확인
서버 로그에서 Webhook 수신 확인:
```bash
pm2 logs esl --lines 50
# 또는
tail -f /home/user/esl/nohup.out
```

## 🔍 트러블슈팅

### 문제 1: 결제창이 뜨지 않음
**원인**: PortOne SDK 로딩 실패 또는 키 오류  
**해결**: 
- 브라우저 콘솔에서 에러 확인
- `.env` 파일의 키가 올바른지 확인
- 서버 재시작

### 문제 2: 결제는 성공했지만 데이터 업데이트 안 됨
**원인**: Webhook 미수신  
**해결**:
- Webhook URL이 올바른지 확인
- PortOne 콘솔에서 Webhook 로그 확인
- 서버 로그에서 `🔔 PortOne Webhook Event` 확인

### 문제 3: 서버측 검증 실패
**원인**: API Secret 오류  
**해결**:
- `.env` 파일의 `PORTONE_API_SECRET` 확인
- PortOne 콘솔에서 API Secret 재발급

## 📚 상세 문서
더 자세한 내용은 `PORTONE_EXIMBAY_SETUP.md` 참고

## 🎉 체크리스트

테스트 전 확인사항:
- [ ] PortOne 회원가입 완료
- [ ] Eximbay 채널 생성 완료 (테스트 모드)
- [ ] Channel Key 복사 및 `.env` 업데이트
- [ ] API Secret 복사 및 `.env` 업데이트
- [ ] Webhook Secret 복사 및 `.env` 업데이트
- [ ] Webhook URL 설정 (`https://esl.eventpool.kr/portone/webhook`)
- [ ] 서버 재시작
- [ ] 로그인 후 결제 페이지 접속 테스트
- [ ] 테스트 카드로 결제 진행
- [ ] 결제 완료 후 데이터 업데이트 확인

## 🚀 프로덕션 전환 (나중에)

실제 운영 전환 시:
1. Eximbay와 계약 체결
2. 실 운영용 MID 및 Secret Key 발급
3. `.env` 파일에서 `PORTONE_TEST_MODE=false` 로 변경
4. 실제 PG상점아이디로 업데이트
5. 실제 카드로 테스트

---

**작성일**: 2025-11-03  
**GitHub**: https://github.com/myungdae/esl  
**Commit**: Add PortOne (Eximbay) payment integration
