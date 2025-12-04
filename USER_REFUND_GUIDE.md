# 사용자 환불 요청 시스템 가이드

## 🎯 개요

사용자가 직접 환불을 요청하고, 조건에 따라 자동 승인되거나 관리자 검토를 거치는 시스템입니다.

---

## ✅ 자동 승인 조건

다음 조건을 **모두** 만족하면 즉시 환불이 자동 승인됩니다:

### **1. 구매 후 7일 이내**
- 결제일로부터 7일(168시간) 이내

### **2. 서비스 미사용**
- **Employer (Job Ads)**: 구매 후 광고를 한 번도 게시하지 않음
- **Job Seeker (Resume Access)**: 이력서 접근 권한을 사용하지 않음
- **Tutor (Tutor Access)**: 튜터 목록 노출을 사용하지 않음

---

## 📋 환불 요청 프로세스

### **사용자 화면 플로우**

```
1. 마이페이지 접속
   ↓
2. "Purchase History" 섹션 확인
   ↓
3. 환불하고 싶은 결제 행의 "Request Refund" 버튼 클릭
   ↓
4. 환불 사유 입력
   ↓
5. 제출
   ↓
6a. [자동 승인] "Refund approved and processed automatically" 
    → 즉시 환불 완료
   
6b. [수동 검토] "Refund request submitted for admin review"
    → 1-2 영업일 내 검토
```

---

## 🎨 UI 구현 필요 사항

### **1. 마이페이지에 구매 내역 표시**

**위치**: `/user/mypage-employer` (Employer용)

**표시 정보**:
- 구매 날짜
- 패키지 설명
- 금액
- 결제 상태 (Paid / Refunded)
- 환불 요청 상태 (Under Review / Auto-Approved / Rejected)
- 액션 버튼 (Request Refund / Under Review)

**예시 레이아웃**:
```
╔════════════════════════════════════════════════════════════╗
║  Purchase History                                          ║
╠══════════╦═══════════════════╦═════════╦══════════╦═══════╣
║ Date     ║ Package           ║ Amount  ║ Status   ║ Action║
╠══════════╬═══════════════════╬═════════╬══════════╬═══════╣
║ 12/04/25 ║ Job Ad - 1 credit ║ ₩1,000  ║ 💚 Paid  ║ [🔄 Request Refund] ║
║ 12/01/25 ║ Job Ad - 4 credits║ ₩3,500  ║ ⏳ Under Review ║ ║
║ 11/28/25 ║ Job Ad - 12 credits║ ₩9,900 ║ ♻️ Refunded ║ ║
╚══════════╩═══════════════════╩═════════╩══════════╩═══════╝
```

---

### **2. 환불 요청 모달**

**트리거**: "Request Refund" 버튼 클릭

**모달 내용**:
```html
╔═══════════════════════════════════════╗
║  Request Refund                       ║
╠═══════════════════════════════════════╣
║                                       ║
║  Package: Job Ad Package - 1 credit   ║
║  Amount: ₩1,000                       ║
║  Purchase Date: 2025-12-04            ║
║                                       ║
║  Refund Reason:                       ║
║  ┌─────────────────────────────────┐ ║
║  │                                 │ ║
║  │ (Enter your reason here)        │ ║
║  │                                 │ ║
║  └─────────────────────────────────┘ ║
║                                       ║
║  Note: If eligible, refund will be   ║
║  processed automatically. Otherwise, ║
║  our team will review within 1-2     ║
║  business days.                      ║
║                                       ║
║  [Cancel]  [Submit Request]          ║
╚═══════════════════════════════════════╝
```

---

### **3. JavaScript 함수**

```javascript
async function requestRefund(paymentId, packageDesc, amount) {
  const reason = prompt(`Refund Request for ${packageDesc} (${amount})\n\nPlease enter your reason:`);
  
  if (!reason || reason.trim() === '') {
    alert('Please provide a reason for the refund');
    return;
  }
  
  if (!confirm(`Confirm refund request?\n\nPackage: ${packageDesc}\nAmount: ${amount}\nReason: ${reason}`)) {
    return;
  }
  
  try {
    const response = await fetch('/user/request-refund', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        paymentId: paymentId,
        reason: reason
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      if (result.autoApproved) {
        alert('✅ ' + result.message + '\n\nYour refund has been processed automatically!');
      } else {
        alert('📨 ' + result.message);
      }
      location.reload();
    } else {
      alert('❌ ' + result.message);
    }
  } catch (error) {
    console.error('Refund request error:', error);
    alert('❌ Failed to submit refund request');
  }
}
```

---

## 🔧 Admin 페이지 수정 필요

### **1. Transactions 페이지에 환불 요청 필터 추가**

**새로운 통계 카드**:
```
┌─────────────────────┐
│  Refund Requests    │
│       3             │
└─────────────────────┘
```

### **2. 결제 목록에 환불 요청 표시**

**Status 컬럼**:
- `PAID` → 초록색
- `PAID + Refund Requested` → 노란색 + "⚠️ Refund Pending"
- `REFUNDED` → 회색

### **3. Actions 컬럼에 Approve/Reject 버튼**

환불 요청이 있는 경우:
```html
<button onclick="reviewRefund('${payment.id}', 'approve')">✅ Approve</button>
<button onclick="reviewRefund('${payment.id}', 'reject')">❌ Reject</button>
```

---

## 📊 데이터베이스 스키마

### **Payment 모델 추가 필드**

```javascript
refundRequest: {
  requestedAt: Date,        // 요청 시각
  reason: String,           // 사용자가 입력한 사유
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'auto_approved'],
    default: 'pending'
  },
  autoApproved: Boolean,    // 자동 승인 여부
  reviewedBy: String,       // 검토자 이메일
  reviewedAt: Date,         // 검토 시각
  reviewNote: String        // Admin 검토 노트
}
```

---

## 🔄 API 엔드포인트

### **1. POST /user/request-refund**

**Request**:
```json
{
  "paymentId": "67507b3c...",
  "reason": "Changed my mind"
}
```

**Response (자동 승인)**:
```json
{
  "success": true,
  "autoApproved": true,
  "message": "Refund approved and processed automatically"
}
```

**Response (수동 검토)**:
```json
{
  "success": true,
  "autoApproved": false,
  "message": "Refund request submitted. Our team will review it within 1-2 business days."
}
```

---

### **2. POST /admin/approve-refund**

**Request**:
```json
{
  "paymentId": "67507b3c...",
  "action": "approve",  // or "reject"
  "reviewNote": "Service not used, approved"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Refund approved and processed"
}
```

---

## 🧪 테스트 시나리오

### **시나리오 1: 자동 승인 (조건 만족)**

1. 사용자가 Job Ad Package 1개 구매 (₩1,000)
2. 광고 게시 하지 않음
3. 3일 후 환불 요청
4. ✅ 즉시 자동 승인
5. 크레딧 1개 차감
6. 상태: `refunded`

---

### **시나리오 2: 수동 검토 (조건 불만족 - 기간 초과)**

1. 사용자가 Job Ad Package 1개 구매
2. 10일 후 환불 요청
3. ⏳ Admin 검토 필요
4. Admin이 승인/거부

---

### **시나리오 3: 수동 검토 (조건 불만족 - 서비스 사용)**

1. 사용자가 Job Ad Package 1개 구매
2. 광고 1개 게시
3. 2일 후 환불 요청
4. ⏳ Admin 검토 필요 (서비스 이미 사용됨)

---

## 📧 이메일 알림 (선택 사항)

### **자동 승인 시**:
- **제목**: "Refund Approved - ESL Plus"
- **내용**: "Your refund request has been automatically approved and processed. Amount: ₩X,XXX"

### **수동 검토 시**:
- **제목**: "Refund Request Received - ESL Plus"
- **내용**: "Your refund request is under review. We'll get back to you within 1-2 business days."

### **Admin 승인 시**:
- **제목**: "Refund Approved - ESL Plus"
- **내용**: "Your refund request has been approved. Amount: ₩X,XXX"

### **Admin 거부 시**:
- **제목**: "Refund Request Update - ESL Plus"
- **내용**: "Your refund request has been reviewed. Reason: [Admin Note]"

---

## 🚀 다음 단계

1. ✅ Backend API 구현 완료
2. ⏳ Frontend UI 구현 필요
   - Employer mypage에 구매 내역 섹션 추가
   - Request Refund 버튼 및 모달
   - JavaScript 함수
3. ⏳ Admin 페이지 수정
   - Refund Requests 카운터
   - Approve/Reject 버튼
   - JavaScript 함수

---

## 💡 참고사항

- 환불은 원래 결제 수단으로만 가능
- PortOne API를 통해 처리
- 크레딧/액세스는 자동 차감
- 환불 내역은 `refundHistory`에 기록
