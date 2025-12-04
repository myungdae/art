# 🔐 세션 관리 시스템 가이드

## 📋 개요

사용자 세션이 너무 오래 유지되어 보안 문제가 발생하는 것을 방지하기 위해 세션 만료 시스템을 개선했습니다.

---

## 🔧 변경 사항

### 이전 설정 (문제점)
- **세션 TTL**: 30일
- **쿠키 maxAge**: 30일
- **문제**: 몇 주 지나도 자동 로그아웃되지 않음
- **보안 위험**: 공용 컴퓨터나 공유 기기에서 로그인 상태 계속 유지

### 새로운 설정 (개선)
- **세션 TTL**: 7일 (기본값, 환경 변수로 조정 가능)
- **쿠키 maxAge**: 7일
- **활동 기반 갱신**: 사용자가 활동할 때마다 세션 자동 갱신
- **비활성 세션 자동 만료**: 7일간 활동이 없으면 자동 로그아웃
- **환경 변수 제어**: `.env` 파일에서 세션 만료 시간 조정 가능

---

## ⚙️ 세션 설정

### 1. 환경 변수

`.env` 파일에 다음 설정 추가:

```bash
# Session lifetime in days (default: 7)
SESSION_LIFETIME_DAYS=7
```

**설정 예시**:
- `SESSION_LIFETIME_DAYS=1`: 1일 (24시간) - 높은 보안 필요 시
- `SESSION_LIFETIME_DAYS=7`: 7일 (1주일) - **권장 설정**
- `SESSION_LIFETIME_DAYS=14`: 14일 (2주) - 편의성 우선 시
- `SESSION_LIFETIME_DAYS=30`: 30일 (1개월) - 이전 설정 (권장하지 않음)

---

## 🔄 작동 방식

### 1. 로그인 시
- 사용자가 로그인하면 `lastActivity` 타임스탬프 생성
- 세션과 쿠키에 만료 시간 설정

### 2. 활동 중
- 사용자가 페이지를 이동할 때마다 `lastActivity` 업데이트
- `rolling: true` 설정으로 쿠키 만료 시간 자동 갱신
- MongoDB 세션 스토어는 24시간마다 한 번만 업데이트 (`touchAfter: 24 * 3600`)

### 3. 비활성 세션 체크
- 모든 요청마다 세션 활동 시간 체크
- `현재 시간 - lastActivity > SESSION_LIFETIME_MS` 이면 자동 로그아웃
- 로그아웃 후 로그인 페이지로 리다이렉트 (만료 메시지 표시)

### 4. 세션 만료
- 7일간 활동이 없으면 세션 자동 삭제
- 다음 접속 시 로그인 페이지로 리다이렉트
- 메시지: "Session expired. Please login again."

---

## 📊 세션 라이프사이클

```
로그인
  ↓
세션 생성 (lastActivity = 현재 시간)
  ↓
활동 중 (페이지 이동, API 호출 등)
  ↓
lastActivity 업데이트
  ↓
7일간 활동 없음
  ↓
세션 만료 체크
  ↓
자동 로그아웃
  ↓
로그인 페이지로 리다이렉트
```

---

## 🚀 배포 절차

### Step 1: 코드 업데이트

```bash
# 서버 접속
ssh ubuntu@ip-172-31-2-218

# 프로젝트 디렉토리로 이동
cd ~/esl

# 최신 코드 가져오기
git checkout genspark_ai_developer
git pull origin genspark_ai_developer
```

### Step 2: 환경 변수 확인

```bash
# .env 파일 확인
cat ~/esl/.env | grep SESSION

# 다음 값이 있어야 함:
# SESSION_SECRET=64154eea300b041dccd6863f639fac04ba9b5da993c2964e727c0d94833a8ebf
# SESSION_LIFETIME_DAYS=7
```

**없으면 추가**:
```bash
nano ~/esl/.env
# SESSION_LIFETIME_DAYS=7 추가
# Ctrl+O (저장), Ctrl+X (종료)
```

### Step 3: MongoDB 세션 정리 (선택 사항)

기존의 오래된 세션을 삭제하려면:

```bash
# MongoDB 접속
mongo mongodb://myungdae.cho2:ldc%40linked12@43.203.239.160:27017/eventpool?authSource=admin

# 세션 컬렉션 확인
use eventpool
db.sessions.countDocuments()

# 30일 이전 세션 삭제 (선택 사항)
db.sessions.deleteMany({ 
  expires: { 
    $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) 
  } 
})

# 종료
exit
```

### Step 4: 서버 재시작

```bash
# PM2 재시작
pm2 stop linked_esl_app
pm2 delete linked_esl_app
pm2 start ecosystem.config.js

# 로그 확인
pm2 logs linked_esl_app --lines 50 --nostream
```

**기대 로그**:
```
🔐 Session lifetime configured: 7 days
✅ app.js started
✅ 몽고디비 연결 성공
Listening on port 8608
```

---

## 🧪 테스트 방법

### Test 1: 정상 로그인 및 활동

1. **로그인**
   - URL: `https://eslplus.org/user/login`
   - 로그인 성공 확인

2. **활동 확인**
   - 페이지 이동 (마이페이지, 거래 내역 등)
   - 세션 유지 확인

3. **브라우저 종료 후 재접속**
   - 7일 이내: 로그인 상태 유지
   - 7일 이후: 로그인 페이지로 리다이렉트

---

### Test 2: 세션 만료 시뮬레이션 (개발 환경)

**방법 1: 환경 변수 변경**
```bash
# .env 파일에서 세션 시간을 1분으로 설정
SESSION_LIFETIME_DAYS=0.0007  # 약 1분 (1 / 1440)

# 서버 재시작
pm2 restart linked_esl_app --update-env

# 로그인 후 2분 대기
# 페이지 새로고침 → 자동 로그아웃 확인
```

**방법 2: MongoDB 세션 수동 수정**
```javascript
// MongoDB에서 세션의 lastActivity를 8일 전으로 설정
db.sessions.updateOne(
  { "session.user.email": "test@example.com" },
  { $set: { "session.lastActivity": new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) } }
)

// 페이지 새로고침 → 자동 로그아웃 확인
```

---

### Test 3: 관리자 세션 확인

1. **Admin 로그인**
   - URL: `https://eslplus.org/admin/login`

2. **활동 확인**
   - Admin 대시보드 접속
   - 7일 이내 활동 시 세션 유지

3. **세션 만료 확인**
   - 7일간 활동 없으면 `/admin/login`으로 리다이렉트

---

## 📊 세션 통계 모니터링

### MongoDB에서 세션 통계 확인

```javascript
// 전체 세션 수
db.sessions.countDocuments()

// 최근 활동 세션 (7일 이내)
db.sessions.countDocuments({
  "session.lastActivity": {
    $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  }
})

// 만료될 세션 (7일 이상 비활성)
db.sessions.countDocuments({
  "session.lastActivity": {
    $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  }
})

// 사용자별 세션 수
db.sessions.aggregate([
  {
    $group: {
      _id: "$session.user.email",
      count: { $sum: 1 },
      lastActivity: { $max: "$session.lastActivity" }
    }
  },
  { $sort: { count: -1 } }
])
```

---

## 🔒 보안 고려 사항

### 1. HTTPS 사용 (Production)
현재 `.env` 설정:
```bash
NODE_ENV=production
```

이 경우 세션 쿠키에 `secure: true` 플래그 자동 설정 (HTTPS 전용)

### 2. 민감한 작업 재인증
다음 작업 시 비밀번호 재입력 권장:
- 결제 처리
- 개인정보 변경 (이메일, 비밀번호)
- 계정 삭제
- 환불 처리

### 3. 세션 고정 공격 방지
로그인 후 세션 ID 재생성:
```javascript
req.session.regenerate((err) => {
  if (err) return next(err);
  req.session.user = user;
  req.session.save(() => {
    res.redirect('/user/mypage');
  });
});
```

### 4. 동시 세션 제한
한 사용자당 최대 세션 수 제한 (선택 사항):
```javascript
// 로그인 시 기존 세션 삭제
await Session.deleteMany({ 
  "session.user._id": user._id 
});
```

---

## 🛠️ 문제 해결

### 문제 1: 로그인 직후 바로 로그아웃됨

**원인**: `SESSION_LIFETIME_DAYS` 설정이 너무 작음

**해결**:
```bash
# .env 파일 확인
cat ~/esl/.env | grep SESSION_LIFETIME_DAYS

# 7 이상으로 설정
nano ~/esl/.env
# SESSION_LIFETIME_DAYS=7

# 서버 재시작
pm2 restart linked_esl_app --update-env
```

---

### 문제 2: 세션이 여전히 너무 오래 유지됨

**원인**: MongoDB 세션 스토어의 오래된 세션이 남아 있음

**해결**:
```javascript
// MongoDB에서 오래된 세션 삭제
db.sessions.deleteMany({
  expires: { $lt: new Date() }
})
```

---

### 문제 3: "Session expired" 메시지가 계속 표시됨

**원인**: 
1. `lastActivity`가 제대로 업데이트되지 않음
2. 시스템 시간이 동기화되지 않음

**해결**:
```bash
# 1. PM2 로그 확인
pm2 logs linked_esl_app --err

# 2. 서버 시간 확인
date
timedatectl

# 3. MongoDB 세션 확인
mongo
use eventpool
db.sessions.findOne({}, { "session.lastActivity": 1 })
```

---

### 문제 4: 관리자 세션만 만료됨

**원인**: Admin 로그인 코드에 `lastActivity` 누락

**해결**: 이미 수정됨 (router/admin.js 업데이트)

---

## 📝 변경 파일 목록

1. **app.js**
   - 세션 설정 개선 (`rolling: true`, `touchAfter`)
   - 환경 변수 기반 세션 만료 시간 설정
   - 세션 활동 체크 미들웨어 추가

2. **router/user.js**
   - 로그인 시 `lastActivity` 타임스탬프 설정

3. **router/admin.js**
   - Admin 로그인 시 `lastActivity` 타임스탬프 설정

4. **.env**
   - `SESSION_LIFETIME_DAYS=7` 추가

---

## ✅ 배포 체크리스트

### 배포 전
- [x] 코드 변경 완료 (app.js, router/user.js, router/admin.js)
- [x] .env 파일에 `SESSION_LIFETIME_DAYS` 추가
- [x] 세션 관리 가이드 작성

### 배포 중
- [ ] 서버 코드 업데이트 (`git pull`)
- [ ] .env 파일에 `SESSION_LIFETIME_DAYS=7` 추가
- [ ] PM2 재시작
- [ ] 로그 확인 ("Session lifetime configured" 메시지)

### 배포 후
- [ ] 사용자 로그인 테스트 (Employer, Job Seeker, Tutor)
- [ ] Admin 로그인 테스트
- [ ] 세션 유지 테스트 (활동 중)
- [ ] 세션 만료 테스트 (MongoDB 세션 수동 수정)
- [ ] MongoDB 세션 통계 확인

---

## 🎯 권장 설정

| 환경 | SESSION_LIFETIME_DAYS | 설명 |
|------|----------------------|------|
| **개발 (Development)** | 1 | 테스트 용이, 빠른 세션 만료 |
| **스테이징 (Staging)** | 3-7 | 프로덕션과 유사한 환경 |
| **프로덕션 (Production)** | **7** | **권장 설정** - 보안과 편의성 균형 |
| 높은 보안 필요 시 | 1-3 | 금융, 의료 등 민감한 데이터 |
| 편의성 우선 시 | 14 | 사용자 불편 최소화 |

---

## 🔗 관련 문서

- **환불 시스템**: `REFUND_SYSTEM_DEPLOYMENT.md`
- **사용자 가이드**: `USER_REFUND_GUIDE.md`
- **Express Session**: https://github.com/expressjs/session
- **Connect Mongo**: https://github.com/jdesboeufs/connect-mongo

---

**세션 관리 시스템이 개선되었습니다!** 🎉

이제 사용자는 7일간 활동이 없으면 자동으로 로그아웃되어 보안이 강화됩니다.
