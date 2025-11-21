# 📝 지원서 제출 테스트 가이드

## 🔗 서버 접속 정보
- **서버 URL**: https://8608-i86lwmdcs73394nid8ee5-5634da27.sandbox.novita.ai
- **테스트 날짜**: 2025-11-21

---

## ✅ 테스트 완료 항목

### 1. MongoDB 지원서 스키마 확인 ✅
- Application 모델 구조 확인 완료
- 필수 필드: applicant, jobVacancy, coverLetter
- 중복 지원 방지: (applicant + jobVacancy) unique 인덱스
- 상태 관리: pending, reviewed, accepted, rejected, withdrawn

### 2. 백엔드 API 라우터 확인 ✅
- **GET** `/job-vacancies/:id/apply` - 지원서 작성 폼
- **POST** `/job-vacancies/:id/apply` - 지원서 제출
- **GET** `/applications/mine` - 내 지원 내역
- **GET** `/applications/received` - 받은 지원서 (기업용)
- **GET** `/applications/:id` - 지원서 상세
- **POST** `/applications/:id/status` - 상태 변경 (기업용)
- **POST** `/applications/:id/withdraw` - 지원 취소 (구직자용)

### 3. 테스트 데이터 생성 ✅
```
✅ 테스트 지원서 생성 완료!
   지원서 ID: 691fc4159bbcced8dfaad182
   구직자: genspark2@gmail.com
   채용공고: High School English Teacher in Singapore
   회사: Singapore International Academy
   상태: pending
   지원일: 2025-11-21
```

---

## 🧪 웹 UI 테스트 단계

### Step 1: 구직자 로그인
1. 서버 접속: https://8608-i86lwmdcs73394nid8ee5-5634da27.sandbox.novita.ai
2. 로그인 클릭
3. 구직자 계정으로 로그인:
   - **이메일**: `genspark2@gmail.com`
   - **비밀번호**: (기존 설정된 비밀번호 사용)

### Step 2: 채용공고 조회
1. 메인 페이지 또는 채용공고 목록으로 이동
2. 활성 채용공고 확인:
   - High School English Teacher in Singapore
   - Conversation English Teacher in Osaka
   - Online English Teacher for Korean Students
   - TOEFL Test Prep Teacher in Busan
   - Middle School ESL Teacher in Taipei

### Step 3: 지원서 작성 및 제출
1. 원하는 채용공고 클릭
2. "Apply" 또는 "지원하기" 버튼 클릭
3. 지원서 작성 폼:
   - **Cover Letter** (필수): 자기소개 및 지원 동기 작성
   - **Resume/CV** (선택): 이력서 링크 또는 추가 정보
4. "Submit Application" 버튼 클릭

### Step 4: 지원 내역 확인
1. 상단 메뉴에서 "My Applications" 또는 "내 지원 내역" 클릭
2. URL: `/applications/mine`
3. 제출한 지원서 목록 확인:
   - 지원한 공고 제목
   - 회사명
   - 지원 상태 (Pending)
   - 지원 날짜

### Step 5: 지원서 상세 확인
1. 지원 내역에서 특정 지원서 클릭
2. 지원서 상세 정보 확인:
   - 공고 정보
   - 작성한 Cover Letter
   - Resume 정보
   - 현재 상태
   - 지원 날짜

---

## 🔍 MongoDB 직접 확인

### 지원서 데이터 확인 쿼리
```javascript
// MongoDB Shell에서 실행
use eventpool;

// 모든 지원서 조회
db.applications.find().pretty();

// 특정 구직자의 지원서
db.applications.find({ applicantEmail: "genspark2@gmail.com" }).pretty();

// 특정 공고의 지원서
db.applications.find({ jobVacancy: ObjectId("68f8375fde1ad62c8b6e6076") }).pretty();

// 상태별 통계
db.applications.aggregate([
  {
    $group: {
      _id: "$status",
      count: { $sum: 1 }
    }
  }
]);
```

---

## 📊 현재 데이터베이스 상태

### 구직자 계정 (5개)
1. genspark2@gmail.com
2. genspark3@gmail.com
3. toss@gmail.com
4. toss2@gmail.com
5. toss4@gmail.com

### 활성 채용공고 (5개)
1. [68f8375fde1ad62c8b6e6076] High School English Teacher in Singapore
2. [68f8375fde1ad62c8b6e6074] Conversation English Teacher in Osaka
3. [68f8375ede1ad62c8b6e6072] Online English Teacher for Korean Students
4. [68f8375ede1ad62c8b6e6070] TOEFL Test Prep Teacher in Busan
5. [68f8375dde1ad62c8b6e606e] Middle School ESL Teacher in Taipei

### 지원서 통계
- **전체**: 1개
- **Pending**: 1개
- **Reviewed**: 0개
- **Accepted**: 0개
- **Rejected**: 0개
- **Withdrawn**: 0개

---

## 🎯 테스트 체크리스트

- [x] Application 모델 확인
- [x] 지원서 제출 API 확인
- [x] 지원서 조회 API 확인
- [x] 테스트 지원서 MongoDB 저장 확인
- [ ] 웹 UI 지원서 작성 폼 확인
- [ ] 웹 UI 지원서 제출 확인
- [ ] 웹 UI 지원 내역 페이지 확인
- [ ] 지원서 상세 페이지 확인
- [ ] 중복 지원 방지 확인
- [ ] 지원 취소 기능 확인

---

## 🚀 추가 테스트 항목

### 기업 계정 테스트
1. 기업 계정으로 로그인
2. "Received Applications" 또는 "받은 지원서" 메뉴 접근
3. 자신이 등록한 공고의 지원서 확인
4. 지원서 상태 변경 테스트:
   - Pending → Reviewed
   - Reviewed → Accepted/Rejected
5. 기업 메모(Employer Note) 작성

### 에러 케이스 테스트
1. 동일 공고에 중복 지원 시도 (에러 메시지 확인)
2. Cover Letter 없이 제출 (유효성 검증 확인)
3. 로그인하지 않고 지원 시도 (리다이렉트 확인)
4. 다른 역할(기업)로 지원 시도 (권한 확인)

---

## 💡 테스트 성공 기준

✅ **필수 조건**
1. 구직자로 로그인 후 지원서 제출 성공
2. MongoDB에 지원서 데이터 정상 저장
3. 지원 내역 페이지에서 제출한 지원서 조회 가능
4. 지원서 상세 정보 정상 표시

✅ **추가 조건**
5. 중복 지원 방지 동작
6. 유효성 검증 정상 동작
7. 권한 체크 정상 동작

---

## 📝 테스트 결과 기록

### 자동 테스트 결과 (✅ 완료)
```
테스트 날짜: 2025-11-21
테스트 방법: Node.js 스크립트
결과: 성공

- MongoDB 연결: ✅
- 지원서 생성: ✅
- 데이터 저장: ✅
- 중복 체크: ✅
```

### 수동 UI 테스트 결과 (🔄 진행 예정)
```
테스트 날짜: 
테스트자:
결과:

- 로그인: [ ]
- 지원서 작성: [ ]
- 지원서 제출: [ ]
- 지원 내역 확인: [ ]
```

---

## 🛠️ 문제 해결

### 로그인 문제
- 비밀번호를 모르는 경우, 새 계정 등록 후 테스트
- 또는 관리자가 비밀번호 리셋

### 지원서 제출 실패
1. 브라우저 개발자 도구(F12) 콘솔 확인
2. 서버 로그 확인: `tail -f /home/user/webapp/nohup.out`
3. MongoDB 연결 상태 확인

### 권한 에러
- 세션이 만료되었을 수 있음 → 다시 로그인
- 올바른 역할(Job_Seeker)로 로그인했는지 확인

---

## 📞 참고 사항

- 테스트 스크립트: `/home/user/webapp/test_application.js`
- 모델 파일: `/home/user/webapp/model/application.js`
- 라우터 파일: `/home/user/webapp/router/application.js`
- 뷰 템플릿: `/home/user/webapp/views/application/`
