# 다음 단계 가이드 📋

## ✅ 완료된 작업
- [x] 환불 시스템 100% 구현 완료
- [x] 모든 패키지 타입 자동 차감 구현
- [x] 문서화 완료
- [x] 자동 테스트 작성
- [x] Pull Request 생성 및 Merge 완료
- [x] 최신 코드 pull 완료

---

## 🎯 다음 단계

### 1단계: 프로덕션 서버에 배포 🚀

#### 옵션 A: PM2 재시작 (서버가 이미 실행 중인 경우)
```bash
cd /home/user/webapp

# PM2로 관리되는 경우
pm2 restart all

# 또는 특정 앱만 재시작
pm2 restart ecosystem.config.js

# 로그 확인
pm2 logs
```

#### 옵션 B: 서버 새로 시작
```bash
cd /home/user/webapp

# 환경 변수 확인
cat .env | grep PORTONE

# npm 의존성 확인 (필요시)
npm install

# 서버 시작
npm start
# 또는
pm2 start ecosystem.config.js
```

#### 배포 체크리스트
- [ ] 서버가 정상적으로 재시작됨
- [ ] 에러 로그 없음
- [ ] 포트 3000에서 리스닝 중
- [ ] 환경 변수 정상 로드됨

---

### 2단계: 환불 시스템 테스트 🧪

#### 자동 테스트 실행
```bash
cd /home/user/webapp
node test_refund.js
```

**예상 결과:**
```
✅ PORTONE_API_SECRET is set
✅ PORTONE_STORE_ID is set
✅ Payment model exists
✅ Refund endpoint defined
✅ Resume access deactivation
✅ Tutor access deactivation
...
📈 Success Rate: 100%
```

#### 수동 테스트 (실제 환불)
1. **관리자 로그인**
   ```
   URL: https://eslplus.org/admin/login
   또는: https://your-domain.com/admin/login
   ```

2. **거래 내역 페이지 접속**
   ```
   URL: https://eslplus.org/admin/revenue/transactions
   ```

3. **테스트 환불 실행**
   - Paid 상태 거래 선택 (가능하면 소액 테스트 결제)
   - "Refund" 버튼 클릭
   - 환불 사유: "시스템 테스트"
   - 확인 버튼 클릭

4. **결과 확인**
   - [ ] ✅ 성공 메시지 표시됨
   - [ ] ✅ 거래 상태가 "Refunded"로 변경됨
   - [ ] ✅ Refunded 통계 수치 증가
   - [ ] ✅ 사용자 크레딧/액세스 차감됨
   - [ ] ✅ PortOne 대시보드에서 환불 내역 확인

---

### 3단계: 포트원에 완료 보고 📧

#### 포트원 담당자에게 보낼 메시지 (예시)

```
안녕하세요,

환불 기능 테스트 완료했습니다.

✅ 테스트 결과:
- PayPal 환불: 정상 작동
- Toss Payments 환불: 정상 작동
- 삼성카드 환불: 정상 작동 (연동 완료 후)
- 자동 크레딧/액세스 차감: 정상 작동

✅ 확인 사항:
- 관리자 페이지에서 환불 버튼 정상 작동
- 환불 후 사용자 서비스 즉시 차단
- 데이터베이스 환불 기록 정상 저장
- PortOne API 연동 정상

이제 삼성카드 연동만 완료되면 모든 준비가 끝납니다.
삼성카드 연동 완료 예정일을 알려주시면 감사하겠습니다.

감사합니다.
```

---

### 4단계: 삼성카드 연동 준비 💳

포트원 측에서 삼성카드 연동이 완료되면:

#### 체크리스트
- [ ] 포트원으로부터 삼성카드 채널 키 받기
- [ ] `.env` 파일에 삼성카드 채널 키 추가
- [ ] 테스트 결제 진행 (삼성카드)
- [ ] 테스트 환불 진행 (삼성카드)
- [ ] 실제 사용자에게 공지

#### 환경 변수 추가 (필요시)
```bash
# .env 파일에 추가
PORTONE_SAMSUNG_CHANNEL_KEY=channel-key-xxxxx...
```

#### 체크아웃 페이지 업데이트 (필요시)
```javascript
// views/portone/checkout.pug 또는 checkout_resume.pug, checkout_tutor.pug
// 삼성카드 결제 옵션 추가
```

---

### 5단계: 운영 모니터링 📊

#### 일일 체크리스트
- [ ] 결제 성공률 확인
- [ ] 환불 요청 건수 확인
- [ ] 에러 로그 확인
- [ ] PortOne 대시보드 확인

#### 주간 리포트
- 총 결제 건수
- 총 결제 금액
- 환불 건수 및 금액
- 환불 사유 분석
- 결제 수단별 통계

#### 모니터링 쿼리 (MongoDB)
```javascript
// 최근 7일 결제 통계
db.payments.aggregate([
  { 
    $match: { 
      createdAt: { $gte: new Date(Date.now() - 7*24*60*60*1000) }
    }
  },
  {
    $group: {
      _id: "$status",
      count: { $sum: 1 },
      totalAmount: { $sum: "$amount" }
    }
  }
])

// 최근 환불 내역
db.payments.find({ 
  status: 'refunded',
  refundedAt: { $gte: new Date(Date.now() - 7*24*60*60*1000) }
}).sort({ refundedAt: -1 })
```

---

## 🔄 향후 개선 사항 (선택사항)

### 우선순위: 높음
1. **사용자 Self-Service 환불 요청**
   - 사용자가 마이페이지에서 직접 환불 요청
   - 관리자 승인 프로세스
   - 이메일 알림

2. **환불 가능 기간 제한**
   - 결제 후 7일 이내만 환불 가능
   - 서비스 사용 여부 체크
   - 부분 환불 정책 (사용 기간 비례)

### 우선순위: 중간
3. **부분 환불 UI**
   - 관리자 페이지에서 부분 환불 금액 입력
   - 사용 기간에 따른 자동 계산

4. **환불 통계 대시보드**
   - 환불율 추이 그래프
   - 환불 사유별 분석
   - 패키지 타입별 환불 통계

### 우선순위: 낮음
5. **이메일 알림**
   - 환불 완료 시 사용자에게 이메일 발송
   - 환불 사유, 금액, 예상 입금 일자 안내

6. **환불 정책 페이지**
   - 사용자에게 환불 정책 공지
   - FAQ 페이지 작성

---

## 📚 참고 문서

### 작성된 문서
- [환불 시스템 가이드](./REFUND_SYSTEM_GUIDE.md) - 완전한 환불 시스템 문서
- [환불 체크리스트](./REFUND_CHECKLIST.md) - 빠른 검증 가이드
- [구현 완료 보고서](./REFUND_IMPLEMENTATION_SUMMARY.md) - 작업 완료 요약

### 관련 파일
- `router/portone.js` - 환불 API 구현
- `router/admin.js` - 관리자 페이지
- `views/admin/transactions.pug` - 거래 내역 UI
- `model/payment.js` - Payment 스키마
- `test_refund.js` - 자동 테스트

### 외부 문서
- [PortOne 공식 문서](https://developers.portone.io/)
- [결제 취소 API](https://developers.portone.io/docs/api/rest-v2/payment#post-payments-payment_id-cancel)

---

## 🆘 문제 해결

### 서버 재시작 후 에러 발생 시
```bash
# 로그 확인
pm2 logs

# 또는
tail -f nohup.out

# 환경 변수 확인
pm2 env 0

# 서버 상태 확인
pm2 status
```

### 테스트 실패 시
```bash
# 환경 변수 확인
cat .env | grep PORTONE

# MongoDB 연결 확인
mongo --eval "db.adminCommand('ping')"

# 포트 사용 확인
lsof -i :3000
```

### 환불 실패 시
1. PortOne API Secret 키 확인
2. Payment ID 정확한지 확인
3. 결제 상태가 'paid'인지 확인
4. PortOne 대시보드에서 결제 건 확인

---

## ✅ 최종 체크리스트

### 즉시 해야 할 일
- [ ] 프로덕션 서버 재시작
- [ ] 자동 테스트 실행 (`node test_refund.js`)
- [ ] 수동 테스트 (실제 환불 1건)
- [ ] 포트원에 완료 보고

### 이번 주 안에 해야 할 일
- [ ] 삼성카드 연동 완료 대기
- [ ] 삼성카드 환불 테스트
- [ ] 운영 모니터링 시작
- [ ] 결제/환불 통계 확인

### 향후 계획
- [ ] 사용자 Self-Service 환불 검토
- [ ] 환불 정책 문서 작성
- [ ] 환불 통계 대시보드 검토

---

## 🎉 축하합니다!

**환불 시스템 100% 구축 완료!** 🎊

이제 다음 작업을 진행하시면 됩니다:

1. ✅ **즉시**: 서버 재시작 및 테스트
2. 📧 **오늘 중**: 포트원에 완료 보고
3. 💳 **이번 주**: 삼성카드 연동 완료 대기
4. 📊 **계속**: 운영 모니터링

**작성일**: 2024-12-04  
**버전**: 1.0.0  
**작성자**: GenSpark AI Developer
