# Mobile API Documentation

이 문서는 Flutter 모바일 앱을 위한 REST API 엔드포인트를 설명합니다.

Base URL: `https://eslplus.org/api` (production) 또는 `http://localhost:8608/api` (development)

## 🔐 Authentication APIs

### 1. 회원가입 (Register)

**Endpoint:** `POST /api/register`

**Request Body:**
```json
{
  "username": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "passwordConfirm": "SecurePass123!",
  "role": "Employer"  // 또는 "Job_Seeker", "Online_Tutor"
}
```

**Response (Success - 201):**
```json
{
  "success": true,
  "message": "Registration successful",
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "username": "John Doe",
    "email": "john@example.com",
    "role": "Employer",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "adsAvailable": 0,
    "resumeAccess": null,
    "tutorAccess": null
  },
  "nextStep": {
    "action": "view_dashboard",
    "message": "Registration successful! You need to purchase ad credits to post job vacancies.",
    "needsPayment": true,
    "paymentType": "employer",
    "buttonText": "Buy Ad Credits"
  }
}
```

**Response (Error - 400/409/500):**
```json
{
  "success": false,
  "error": "Error message here"
}
```

**Password Requirements:**
- 최소 8자 이상
- 다음 중 최소 3가지 포함:
  - 대문자
  - 소문자
  - 숫자
  - 특수문자 (!@#$%^&*(),.?":{}|<>)

---

### 2. 로그인 (Login)

**Endpoint:** `POST /api/login`

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

**Response (Success - 200):**

#### With Credits/Access:
```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "username": "John Doe",
    "email": "john@example.com",
    "role": "Employer",
    "adsAvailable": 5,
    "resumeAccess": null,
    "tutorAccess": null,
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "nextStep": {
    "action": "post_job",
    "needsPayment": false,
    "paymentType": "employer",
    "canUseFeatures": true,
    "message": "You have 5 ad credits. You can post job vacancies.",
    "buttonText": "Post New Job"
  }
}
```

#### Without Credits/Access:
```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "username": "John Doe",
    "email": "john@example.com",
    "role": "Employer",
    "adsAvailable": 0,
    "resumeAccess": null,
    "tutorAccess": null,
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "nextStep": {
    "action": "buy_credits",
    "needsPayment": true,
    "paymentType": "employer",
    "canUseFeatures": false,
    "message": "You need to purchase ad credits to post job vacancies.",
    "buttonText": "Buy Ad Credits"
  }
}
```

**Response (Error - 401/500):**
```json
{
  "success": false,
  "error": "Email or password incorrect"
}
```

---

### 3. 마이페이지 정보 조회

**Endpoint:** `GET /api/mypage/:userId`

**Parameters:**
- `userId`: User ID (MongoDB ObjectId)

**Response (Success - 200):**

#### Employer 역할:
```json
{
  "success": true,
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "username": "John Doe",
    "email": "john@example.com",
    "role": "Employer",
    "adsAvailable": 5
  },
  "employer": {
    "activeJobs": 3,
    "credits": 5,
    "canPost": true,
    "totalSlots": 8,
    "remainingSlots": 5
  }
}
```

#### Job_Seeker 역할:
```json
{
  "success": true,
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "username": "Jane Smith",
    "email": "jane@example.com",
    "role": "Job_Seeker",
    "resumeAccess": {
      "startDate": "2024-01-01T00:00:00.000Z",
      "durationDays": 30
    }
  },
  "jobSeeker": {
    "remainingDays": 25,
    "hasActiveResumeAccess": true,
    "expiryDate": "2024-01-31T00:00:00.000Z",
    "hasResume": true,
    "resume": { /* resume data */ }
  }
}
```

#### Online_Tutor 역할:
```json
{
  "success": true,
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "username": "Bob Teacher",
    "email": "bob@example.com",
    "role": "Online_Tutor",
    "tutorAccess": {
      "startDate": "2024-01-01T00:00:00.000Z",
      "durationDays": 90
    }
  },
  "tutor": {
    "remainingDays": 85,
    "hasActiveTutorAccess": true,
    "expiryDate": "2024-04-01T00:00:00.000Z",
    "hasTutorProfile": true,
    "profile": { /* tutor profile data */ }
  }
}
```

---

## 💳 Payment APIs

### 4. 결제 플랜 조회

**Endpoint:** `GET /api/payment/plans`

**Response (Success - 200):**
```json
{
  "success": true,
  "plans": {
    "employer": [
      {
        "id": "1",
        "label": "1 Ad",
        "price": 30,
        "discount": 0,
        "adCount": "1"
      },
      {
        "id": "4",
        "label": "4 Ads",
        "price": 100,
        "discount": 20,
        "adCount": "4"
      },
      {
        "id": "12",
        "label": "12 Ads",
        "price": 250,
        "discount": 110,
        "adCount": "12"
      },
      {
        "id": "24",
        "label": "24 Ads",
        "price": 450,
        "discount": 270,
        "adCount": "24"
      }
    ],
    "resume": [
      {
        "id": "30",
        "label": "30 Days Resume Access",
        "price": 20,
        "days": "30"
      },
      {
        "id": "90",
        "label": "90 Days Resume Access",
        "price": 50,
        "days": "90"
      },
      {
        "id": "365",
        "label": "365 Days Resume Access",
        "price": 120,
        "days": "365"
      }
    ],
    "tutor": [
      {
        "id": "30",
        "label": "30 Days Tutor Access",
        "price": 25,
        "days": "30"
      },
      {
        "id": "90",
        "label": "90 Days Tutor Access",
        "price": 60,
        "days": "90"
      },
      {
        "id": "365",
        "label": "365 Days Tutor Access",
        "price": 150,
        "days": "365"
      }
    ]
  }
}
```

---

### 5. 결제 체크아웃 시작

**Endpoint:** `POST /api/payment/checkout`

**Request Body:**
```json
{
  "userId": "507f1f77bcf86cd799439011",
  "type": "employer",  // 또는 "resume", "tutor"
  "packageId": "4"     // 플랜 ID
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "checkout": {
    "userId": "507f1f77bcf86cd799439011",
    "type": "employer",
    "packageId": "4",
    "price": 100,
    "label": "4 Ads",
    "adCount": "4"
  },
  "paddleEnvironment": "sandbox"  // 또는 "production"
}
```

**Notes:**
- 모바일 앱에서는 이 정보를 받아 Paddle SDK를 통해 결제를 진행해야 합니다.
- Paddle 결제 완료 후 웹훅이 서버로 전송되어 자동으로 사용자 계정이 업데이트됩니다.

---

## 📋 List APIs

### 6. 목록 조회 (Job Vacancies, Job Seekers, Online Tutors)

**Endpoint:** `GET /api/:klass`

**Parameters:**
- `klass`: `Job_Vacancies`, `Job_Seekers`, 또는 `Online_Tutors`

**Query Parameters:**
- `q`: 검색어 (optional)
- `limit`: 페이지당 항목 수 (default: 50, max: 500)
- `page`: 페이지 번호 (default: 1)
- `sort`: 정렬 방식 (`recent`, `oldest`, `alpha-asc`, `alpha-desc`)
- 필터 파라미터 (각 클래스별로 다름)

**Example:** `GET /api/Job_Vacancies?q=teacher&limit=20&page=1&sort=recent&country=South Korea`

**Response (Success - 200):**
```json
{
  "items": [
    {
      "_id": "...",
      "title": "...",
      "_label": "...",
      "_description": "...",
      "datePosted": "...",
      "country": "...",
      "studentType": "..."
    }
  ],
  "total": 150,
  "page": 1,
  "limit": 20,
  "totalPages": 8,
  "facets": {
    "country": {
      "label": "Country",
      "options": [
        { "value": "South Korea", "count": 45 },
        { "value": "Japan", "count": 30 }
      ]
    },
    "studentType": {
      "label": "Student Type",
      "options": [...]
    }
  },
  "query": "teacher",
  "selected": {
    "country": ["South Korea"]
  }
}
```

---

## 🔄 회원가입 → 결제 플로우

웹과 동일한 순서로 진행:

1. **회원가입** (`POST /api/register`)
   - username, email, password, role 입력
   - 계정 생성 성공

2. **로그인** (`POST /api/login`)
   - 자동 로그인 또는 수동 로그인

3. **마이페이지 조회** (`GET /api/mypage/:userId`)
   - 역할별 대시보드 정보 표시
   - Employer: 광고 크레딧 확인
   - Job_Seeker: 이력서 접근 상태 확인
   - Online_Tutor: 튜터 가시성 상태 확인

4. **결제 플랜 조회** (`GET /api/payment/plans`)
   - 역할에 맞는 결제 플랜 표시

5. **결제 시작** (`POST /api/payment/checkout`)
   - Paddle 결제 데이터 받기
   - 모바일 앱에서 Paddle SDK로 결제 진행

6. **결제 완료**
   - Paddle 웹훅이 자동으로 서버에 전송
   - 서버가 사용자 계정 업데이트 (크레딧 추가 또는 접근 권한 활성화)

7. **마이페이지 재조회**
   - 업데이트된 정보 확인
   - Employer: 공고 등록 가능
   - Job_Seeker: 이력서 입력 가능
   - Online_Tutor: 튜터 프로필 입력 가능

---

## 🛠️ Error Handling

모든 API는 다음과 같은 에러 응답 형식을 따릅니다:

```json
{
  "success": false,
  "error": "Error message in English"
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `201` - Created (회원가입 성공)
- `400` - Bad Request (잘못된 입력)
- `401` - Unauthorized (로그인 실패)
- `404` - Not Found (리소스 없음)
- `409` - Conflict (이메일 중복)
- `500` - Internal Server Error (서버 오류)

---

## 📱 Flutter Integration Notes

1. **HTTP Client**: `http` 또는 `dio` 패키지 사용 권장
2. **State Management**: Provider, Riverpod, Bloc 등으로 사용자 상태 관리
3. **Secure Storage**: 사용자 정보를 `flutter_secure_storage`에 저장
4. **Paddle Integration**: `paddle_flutter` 패키지 사용
5. **Error Handling**: 모든 API 호출에 try-catch 블록 사용

---

## 🔒 Security Notes

- 비밀번호는 평문으로 저장됩니다 (프로덕션에서는 bcrypt 해싱 필요)
- HTTPS 사용 필수 (프로덕션)
- 사용자 ID를 로컬에 안전하게 저장
- API 호출 시 적절한 타임아웃 설정

---

## 📞 Support

문제가 발생하면 개발팀에 문의하세요.
