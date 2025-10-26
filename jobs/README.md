# Account Expiry Management System

계정 만료 관리 자동화 시스템 - 120일 유효기간 정책

## 📋 개요

- **등록 후 90일**: 첫 번째 알림 이메일 발송 (30일 후 만료 예정)
- **등록 후 110일**: 최종 알림 이메일 발송 (10일 후 삭제 예정)
- **등록 후 120일**: 크레딧 0인 계정 자동 삭제

**중요**: 크레딧이 있는 계정은 절대 만료되지 않습니다.

## 🔧 시스템 구성

### 파일 구조

```
jobs/
├── accountExpiryJob.js  # 메인 작업 로직
├── scheduler.js         # Cron 스케줄러 설정
├── testJob.js           # 테스트 스크립트
└── README.md            # 이 문서
```

### 자동 실행 스케줄

- **실행 시간**: 매일 새벽 2시 (UTC)
- **실행 방법**: Node-cron을 통한 자동 실행
- **시작**: app.js 실행 시 자동으로 스케줄러 초기화

## 🧪 테스트 방법

### 전체 작업 테스트

```bash
node jobs/testJob.js all
```

### 개별 기능 테스트

```bash
# 90일 알림만 테스트
node jobs/testJob.js 90

# 110일 알림만 테스트
node jobs/testJob.js 110

# 계정 삭제만 테스트
node jobs/testJob.js delete
```

## 📧 이메일 템플릿

### 90일 알림 (30일 후 만료)
- **제목**: ⚠️ ESL Plus Account - Expiring in 30 Days
- **내용**: 계정 정보, 만료 예정일, 크레딧 상태
- **액션**: 크레딧 구매 안내

### 110일 최종 알림 (10일 후 삭제)
- **제목**: 🚨 ESL Plus Account - Final Notice: Deleting in 10 Days
- **내용**: 긴급 안내, 정확한 삭제일, 방지 방법
- **액션**: 즉시 크레딧 구매 필요

### 120일 삭제 통보
- **제목**: ESL Plus Account Deleted
- **내용**: 삭제 완료 안내, 재등록 가능 안내

### 관리자 리포트
- **제목**: ESL Plus: N Accounts Automatically Deleted
- **내용**: 삭제된 계정 목록, 상세 정보

## 🗄️ 데이터베이스 스키마

### User 모델 추가 필드

```javascript
{
  createdAt: Date,              // 등록일 (기존)
  adsAvailable: Number,         // 크레딧 수 (기존)
  expiryNotifications: {
    day90Sent: Boolean,         // 90일 알림 발송 여부 (신규)
    day110Sent: Boolean         // 110일 알림 발송 여부 (신규)
  }
}
```

## ⚙️ 환경 변수

### 필수 설정 (.env)

```bash
# SMTP 설정 (이메일 발송)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM="ESL Plus <your-email@gmail.com>"

# 관리자 이메일
ADMIN_EMAIL=myungdae.cho@gmail.com

# 개발 모드 테스트 (선택사항)
NODE_ENV=development
RUN_JOBS_ON_START=true  # 앱 시작 시 즉시 작업 실행
```

## 📊 작동 방식

### 1. 스케줄러 초기화 (app.js)

```javascript
const { initScheduler } = require('./jobs/scheduler');
const scheduledJobs = initScheduler();
```

### 2. 매일 새벽 2시 자동 실행

```javascript
cron.schedule('0 2 * * *', async () => {
  await runAccountExpiryJob();
});
```

### 3. 작업 실행 순서

1. **90일 알림 확인**
   - `expiryNotifications.day90Sent === false` 필터
   - 등록 후 90일 이상 경과한 사용자 검색
   - 알림 이메일 발송
   - 플래그 업데이트

2. **110일 최종 알림**
   - `expiryNotifications.day110Sent === false` 필터
   - 등록 후 110일 이상 경과한 사용자 검색
   - 최종 알림 이메일 발송
   - 플래그 업데이트

3. **120일 계정 삭제**
   - `adsAvailable <= 0` 필터
   - 등록 후 120일 이상 경과한 사용자 검색
   - 삭제 통보 이메일 발송
   - 계정 삭제
   - 관리자에게 리포트 발송

## 🛡️ 안전장치

### 삭제되지 않는 계정

1. **관리자 계정** (`role === 'Admin'`)
2. **크레딧이 있는 계정** (`adsAvailable > 0`)
3. **120일 미만 계정**

### 에러 처리

- 각 사용자별 개별 try-catch
- 한 사용자 실패 시 다음 사용자 계속 처리
- 모든 에러는 콘솔에 로그 기록

## 📈 모니터링

### 로그 확인

```bash
# 앱 실행 로그에서 cron 작업 확인
grep "Account Expiry Job" logs/app.log

# 작업 실행 시간 확인
grep "Account Expiry Job Started" logs/app.log
```

### 실행 결과 요약

```
========================================
✅ Account Expiry Job Completed
📊 Summary:
   - 90-day warnings sent: 5
   - 110-day warnings sent: 2
   - Accounts deleted: 1
========================================
```

## 🔧 문제 해결

### Cron이 실행되지 않음

1. app.js에 스케줄러가 초기화되었는지 확인
2. 서버 시간대 확인 (`timezone: 'UTC'`)
3. node-cron 패키지 설치 확인

### 이메일이 발송되지 않음

1. .env 파일의 SMTP 설정 확인
2. Gmail 앱 비밀번호 생성 필요
3. mailer.verify() 로그 확인

### 계정이 삭제되지 않음

1. 사용자의 `adsAvailable` 값 확인 (0이어야 함)
2. `createdAt` 날짜 확인 (120일 이상)
3. 테스트 스크립트로 수동 실행: `node jobs/testJob.js delete`

## 🚀 배포 체크리스트

- [ ] .env 파일에 SMTP 설정 완료
- [ ] ADMIN_EMAIL 설정 완료
- [ ] node-cron 패키지 설치 (`npm install`)
- [ ] 데이터베이스 연결 확인
- [ ] 테스트 실행: `node jobs/testJob.js all`
- [ ] 서버 재시작 후 스케줄러 로그 확인

## 📝 주의사항

1. **백업 필수**: 삭제된 계정은 복구 불가능
2. **테스트 환경**: 프로덕션 적용 전 충분한 테스트 필요
3. **이메일 발송량**: 대량 사용자 시 이메일 발송 제한 고려
4. **시간대**: UTC 기준으로 설정되어 있음 (필요시 변경 가능)

## 📞 지원

문제 발생 시: myungdae.cho@gmail.com
