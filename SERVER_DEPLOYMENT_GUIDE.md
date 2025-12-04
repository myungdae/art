# 서버 배포 가이드 🚀

## 현재 상황

- ✅ 코드가 GitHub에 merge 완료
- ✅ PM2 서버 재시작 완료 (`linked_esl_app`)
- ⏳ 실제 서버에서 최신 코드 pull 필요

---

## 🎯 실제 서버에서 해야 할 작업

### 1단계: SSH로 서버 접속
```bash
# 이미 접속되어 있다면 이 단계는 건너뛰기
ssh ubuntu@your-server-ip
```

### 2단계: 프로젝트 디렉토리로 이동
```bash
cd ~/esl
# 또는
cd /home/ubuntu/esl
```

### 3단계: 최신 코드 가져오기
```bash
# 현재 브랜치 확인
git branch

# main 브랜치로 전환 (필요시)
git checkout main

# 최신 코드 pull
git pull origin main
```

**예상 출력:**
```
Updating xxxxx..9474c9e
Fast-forward
 REFUND_CHECKLIST.md    | 417 +++++++++++++++++++++++++++
 REFUND_SYSTEM_GUIDE.md | 763 +++++++++++++++++++++++++++++++++++++++++++++++++
 router/portone.js      |  32 ++-
 test_refund.js         | 422 +++++++++++++++++++++++++++
 4 files changed, 1627 insertions(+), 7 deletions(-)
```

### 4단계: 새로 생성된 파일 확인
```bash
ls -lh test_refund.js REFUND*.md
```

**예상 출력:**
```
-rw-r--r-- 1 ubuntu ubuntu 13K Dec  4 04:49 REFUND_CHECKLIST.md
-rw-r--r-- 1 ubuntu ubuntu 23K Dec  4 04:49 REFUND_SYSTEM_GUIDE.md
-rw-r--r-- 1 ubuntu ubuntu 12K Dec  4 04:49 test_refund.js
```

### 5단계: 환경 변수 확인
```bash
cat .env | grep PORTONE
```

**필수 환경 변수:**
```
PORTONE_API_SECRET=live_xxxxx...
PORTONE_STORE_ID=store-xxxxx...
PORTONE_PAYPAL_CHANNEL_KEY=channel-key-xxxxx...
PORTONE_TOSSPAYMENTS_CHANNEL_KEY=channel-key-xxxxx...
```

### 6단계: PM2 서버 재시작 (환경 변수 업데이트)
```bash
pm2 restart linked_esl_app --update-env
```

### 7단계: 로그 확인
```bash
pm2 logs linked_esl_app --lines 50
```

**정상 실행 확인:**
```
✅ Listening on port 8608
✅ 몽고디비 연결 성공
```

---

## 🧪 테스트 실행

### 자동 테스트 실행
```bash
cd ~/esl
node test_refund.js
```

**예상 결과:**
```
🧪 REFUND SYSTEM TEST SUITE
============================================================

🔐 Logging in as admin...
✅ Admin login successful

⚙️ Test 7: Environment Variables Check
✅ PORTONE_API_SECRET is set
✅ PORTONE_STORE_ID is set
✅ ADMIN_EMAIL is set
✅ ADMIN_PASSWORD is set

... (25+ tests)

============================================================
📊 TEST SUMMARY
============================================================

Total Tests: 25+
✅ Passed: 25+
❌ Failed: 0
📈 Success Rate: 100%
```

### 수동 테스트 (웹 브라우저)

1. **관리자 로그인**
   ```
   URL: https://eslplus.org/admin/login
   ```

2. **거래 내역 페이지**
   ```
   URL: https://eslplus.org/admin/revenue/transactions
   ```

3. **환불 테스트**
   - Paid 상태 거래에서 "Refund" 버튼 클릭
   - 환불 사유 입력: "시스템 테스트"
   - 확인 버튼 클릭
   - ✅ 성공 메시지 확인
   - ✅ 상태 "Refunded"로 변경 확인

---

## ⚠️ 문제 해결

### 문제 1: git pull 실패
```bash
# 로컬 변경사항이 있는 경우
git stash
git pull origin main
git stash pop
```

### 문제 2: 환경 변수가 없음
```bash
# .env 파일 존재 확인
ls -la .env

# .env 파일이 없으면 생성
cp .env.example .env
nano .env
# 필요한 환경 변수 입력
```

### 문제 3: 테스트 실패
```bash
# 환경 변수 다시 확인
cat .env | grep -E "PORTONE|ADMIN"

# 서버 로그 확인
pm2 logs linked_esl_app

# MongoDB 연결 확인
pm2 logs linked_esl_app | grep "몽고디비"
```

### 문제 4: 포트 충돌
```bash
# 포트 8608 사용 중인 프로세스 확인
lsof -i :8608

# PM2 상태 확인
pm2 status
```

---

## 📋 빠른 체크리스트

실제 서버(ubuntu@...)에서:

- [ ] `cd ~/esl`
- [ ] `git pull origin main`
- [ ] `ls -la test_refund.js REFUND*.md` (파일 확인)
- [ ] `cat .env | grep PORTONE` (환경 변수 확인)
- [ ] `pm2 restart linked_esl_app --update-env`
- [ ] `pm2 logs linked_esl_app` (로그 확인)
- [ ] `node test_refund.js` (자동 테스트)
- [ ] 웹에서 수동 테스트

---

## 🎯 간단 요약

**실제 서버에서 실행할 명령어 (순서대로):**

```bash
# 1. 프로젝트 디렉토리로 이동
cd ~/esl

# 2. 최신 코드 가져오기
git pull origin main

# 3. 파일 확인
ls -lh test_refund.js REFUND*.md

# 4. 서버 재시작 (환경 변수 업데이트)
pm2 restart linked_esl_app --update-env

# 5. 로그 확인 (정상 실행 확인)
pm2 logs linked_esl_app --lines 20

# 6. 자동 테스트 실행
node test_refund.js

# 7. 웹 브라우저에서 수동 테스트
# https://eslplus.org/admin/revenue/transactions
```

---

## ✅ 다음 단계

테스트가 모두 통과하면:

1. **포트원에 완료 보고**
   ```
   환불 기능 테스트 완료!
   - PayPal 환불 ✅
   - Toss Payments 환불 ✅
   - 자동 크레딧/액세스 차감 ✅
   
   삼성카드 연동 완료 예정일 알려주세요.
   ```

2. **삼성카드 연동 대기**
   - 포트원에서 삼성카드 채널 키 받기
   - .env 파일에 추가
   - 테스트 진행

---

## 📞 추가 문의

문제가 발생하면 다음 정보를 확인:
- `pm2 logs linked_esl_app`
- `cat .env | grep PORTONE`
- `git log --oneline -5`
- `git status`

**작성일**: 2024-12-04  
**서버**: ubuntu@ip-172-31-2-218 (eslplus.org)  
**포트**: 8608
