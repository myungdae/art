# Flutter 회원가입 화면 수정 가이드

## 문제
현재 Flutter 앱의 회원가입 화면에 **"Select your role"** 드롭다운이 없어서 역할 선택을 할 수 없습니다.

## 해결 방법

### 1. 회원가입 화면에 Role 선택 추가

현재 회원가입 화면 코드를 다음과 같이 수정하세요:

```dart
// register_screen.dart 또는 유사한 파일

import 'package:flutter/material.dart';

class RegisterScreen extends StatefulWidget {
  @override
  _RegisterScreenState createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final TextEditingController usernameController = TextEditingController();
  final TextEditingController emailController = TextEditingController();
  final TextEditingController passwordController = TextEditingController();
  final TextEditingController confirmPasswordController = TextEditingController();
  
  // ✅ Role 선택을 위한 변수 추가
  String? selectedRole;
  final List<String> roles = ['Employer', 'Job_Seeker', 'Online_Tutor'];
  final Map<String, String> roleLabels = {
    'Employer': 'Employer',
    'Job_Seeker': 'Job Seeker',
    'Online_Tutor': 'Online Tutor',
  };

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Register'),
        backgroundColor: Color(0xFFFF7A00),
      ),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SizedBox(height: 20),
            Text(
              'Create Account',
              style: TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.bold,
              ),
              textAlign: TextAlign.center,
            ),
            SizedBox(height: 8),
            Text(
              'Join ESL Job Portal today',
              style: TextStyle(
                fontSize: 16,
                color: Colors.grey[600],
              ),
              textAlign: TextAlign.center,
            ),
            SizedBox(height: 40),
            
            // Username 입력
            TextField(
              controller: usernameController,
              decoration: InputDecoration(
                labelText: 'Username',
                prefixIcon: Icon(Icons.person),
                border: OutlineInputBorder(),
              ),
            ),
            SizedBox(height: 16),
            
            // Email 입력
            TextField(
              controller: emailController,
              keyboardType: TextInputType.emailAddress,
              decoration: InputDecoration(
                labelText: 'Email',
                prefixIcon: Icon(Icons.email),
                border: OutlineInputBorder(),
              ),
            ),
            SizedBox(height: 16),
            
            // Password 입력
            TextField(
              controller: passwordController,
              obscureText: true,
              decoration: InputDecoration(
                labelText: 'Password',
                prefixIcon: Icon(Icons.lock),
                border: OutlineInputBorder(),
              ),
            ),
            SizedBox(height: 16),
            
            // Confirm Password 입력
            TextField(
              controller: confirmPasswordController,
              obscureText: true,
              decoration: InputDecoration(
                labelText: 'Confirm Password',
                prefixIcon: Icon(Icons.lock_outline),
                border: OutlineInputBorder(),
              ),
            ),
            SizedBox(height: 16),
            
            // ✅ Role 선택 드롭다운 추가
            DropdownButtonFormField<String>(
              value: selectedRole,
              decoration: InputDecoration(
                labelText: 'Select your role',
                prefixIcon: Icon(Icons.work),
                border: OutlineInputBorder(),
              ),
              hint: Text('-- Please select --'),
              items: roles.map((String role) {
                return DropdownMenuItem<String>(
                  value: role,
                  child: Text(roleLabels[role]!),
                );
              }).toList(),
              onChanged: (String? newValue) {
                setState(() {
                  selectedRole = newValue;
                });
              },
              validator: (value) {
                if (value == null || value.isEmpty) {
                  return 'Please select your role';
                }
                return null;
              },
            ),
            SizedBox(height: 24),
            
            // Register 버튼
            ElevatedButton(
              onPressed: _register,
              style: ElevatedButton.styleFrom(
                backgroundColor: Color(0xFFFF7A00),
                padding: EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              child: Text(
                'Register',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
            SizedBox(height: 16),
            
            // Login 링크
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text('Already have an account?'),
                TextButton(
                  onPressed: () {
                    Navigator.pop(context);
                  },
                  child: Text(
                    'Login',
                    style: TextStyle(
                      color: Color(0xFFFF7A00),
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _register() async {
    // 입력 검증
    if (usernameController.text.isEmpty ||
        emailController.text.isEmpty ||
        passwordController.text.isEmpty ||
        confirmPasswordController.text.isEmpty) {
      _showError('All fields are required');
      return;
    }

    // ✅ Role 선택 검증
    if (selectedRole == null || selectedRole!.isEmpty) {
      _showError('Please select your role');
      return;
    }

    if (passwordController.text != confirmPasswordController.text) {
      _showError('Passwords do not match');
      return;
    }

    // 비밀번호 강도 검증
    if (!_isPasswordStrong(passwordController.text)) {
      _showError('Password must be at least 8 characters and include uppercase, lowercase, number, and special character');
      return;
    }

    try {
      final response = await http.post(
        Uri.parse('https://eslplus.org/api/register'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'username': usernameController.text,
          'email': emailController.text,
          'password': passwordController.text,
          'passwordConfirm': confirmPasswordController.text,
          'role': selectedRole, // ✅ Role 포함
        }),
      );

      if (response.statusCode == 201) {
        final data = jsonDecode(response.body);
        
        // 사용자 정보 저장
        await _saveUserData(data['user']);
        
        // ✅ nextStep 확인하고 결제 화면으로 이동
        if (data['nextStep'] != null && data['nextStep']['needsPayment'] == true) {
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(
              builder: (context) => PaymentPlansScreen(
                userId: data['user']['_id'],
                paymentType: data['nextStep']['paymentType'],
                message: data['nextStep']['message'],
                buttonText: data['nextStep']['buttonText'],
              ),
            ),
          );
        } else {
          // 대시보드로 이동
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(builder: (context) => DashboardScreen()),
          );
        }
      } else {
        final error = jsonDecode(response.body);
        _showError(error['error'] ?? 'Registration failed');
      }
    } catch (e) {
      _showError('Network error: $e');
    }
  }

  bool _isPasswordStrong(String password) {
    if (password.length < 8) return false;
    
    bool hasUppercase = password.contains(RegExp(r'[A-Z]'));
    bool hasLowercase = password.contains(RegExp(r'[a-z]'));
    bool hasNumber = password.contains(RegExp(r'[0-9]'));
    bool hasSpecial = password.contains(RegExp(r'[!@#$%^&*(),.?":{}|<>]'));
    
    int strength = [hasUppercase, hasLowercase, hasNumber, hasSpecial]
        .where((check) => check)
        .length;
    
    return strength >= 3;
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.red,
      ),
    );
  }

  Future<void> _saveUserData(Map<String, dynamic> user) async {
    // SharedPreferences나 Secure Storage에 저장
    // 예: await storage.write(key: 'user_id', value: user['_id']);
    // 예: await storage.write(key: 'user_role', value: user['role']);
  }
}
```

### 2. 결제 플랜 화면 추가

```dart
// payment_plans_screen.dart

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

class PaymentPlansScreen extends StatefulWidget {
  final String userId;
  final String paymentType;
  final String message;
  final String buttonText;

  PaymentPlansScreen({
    required this.userId,
    required this.paymentType,
    required this.message,
    required this.buttonText,
  });

  @override
  _PaymentPlansScreenState createState() => _PaymentPlansScreenState();
}

class _PaymentPlansScreenState extends State<PaymentPlansScreen> {
  List<dynamic> plans = [];
  bool isLoading = true;
  String? selectedPlanId;

  @override
  void initState() {
    super.initState();
    _loadPlans();
  }

  Future<void> _loadPlans() async {
    try {
      final response = await http.get(
        Uri.parse('https://eslplus.org/api/payment/plans'),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        setState(() {
          // paymentType에 따라 해당 플랜만 표시
          if (widget.paymentType == 'employer') {
            plans = data['plans']['employer'];
          } else if (widget.paymentType == 'resume') {
            plans = data['plans']['resume'];
          } else if (widget.paymentType == 'tutor') {
            plans = data['plans']['tutor'];
          }
          isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        isLoading = false;
      });
      _showError('Failed to load plans: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Select Plan'),
        backgroundColor: Color(0xFFFF7A00),
      ),
      body: isLoading
          ? Center(child: CircularProgressIndicator())
          : Padding(
              padding: EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // 안내 메시지
                  Card(
                    color: Colors.orange[50],
                    child: Padding(
                      padding: EdgeInsets.all(16.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Icon(Icons.info, color: Colors.orange),
                              SizedBox(width: 8),
                              Text(
                                'Action Required',
                                style: TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ],
                          ),
                          SizedBox(height: 8),
                          Text(
                            widget.message,
                            style: TextStyle(fontSize: 14),
                          ),
                        ],
                      ),
                    ),
                  ),
                  SizedBox(height: 24),
                  
                  // 플랜 목록
                  Text(
                    'Choose a Plan',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  SizedBox(height: 16),
                  
                  Expanded(
                    child: ListView.builder(
                      itemCount: plans.length,
                      itemBuilder: (context, index) {
                        final plan = plans[index];
                        return Card(
                          margin: EdgeInsets.only(bottom: 12),
                          child: RadioListTile<String>(
                            title: Text(
                              plan['label'],
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            subtitle: Text(
                              '\$${plan['price']}',
                              style: TextStyle(
                                fontSize: 18,
                                color: Color(0xFFFF7A00),
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            value: plan['id'],
                            groupValue: selectedPlanId,
                            onChanged: (String? value) {
                              setState(() {
                                selectedPlanId = value;
                              });
                            },
                          ),
                        );
                      },
                    ),
                  ),
                  
                  // 결제 버튼
                  SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: selectedPlanId != null ? _proceedToPayment : null,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Color(0xFFFF7A00),
                      padding: EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                    child: Text(
                      'Proceed to Payment',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  
                  // Skip 버튼 (나중에 결제)
                  TextButton(
                    onPressed: () {
                      Navigator.pushReplacement(
                        context,
                        MaterialPageRoute(builder: (context) => DashboardScreen()),
                      );
                    },
                    child: Text(
                      'Skip for now',
                      style: TextStyle(color: Colors.grey),
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  Future<void> _proceedToPayment() async {
    if (selectedPlanId == null) return;

    try {
      final response = await http.post(
        Uri.parse('https://eslplus.org/api/payment/checkout'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'userId': widget.userId,
          'type': widget.paymentType,
          'packageId': selectedPlanId,
        }),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        
        // Paddle 결제로 이동
        // WebView나 Paddle SDK를 사용하여 결제 진행
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => PaddlePaymentScreen(
              checkoutData: data['checkout'],
              paddleEnvironment: data['paddleEnvironment'],
            ),
          ),
        );
      } else {
        _showError('Failed to start payment');
      }
    } catch (e) {
      _showError('Network error: $e');
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.red,
      ),
    );
  }
}
```

### 3. 필요한 패키지 추가

`pubspec.yaml`에 다음 패키지를 추가하세요:

```yaml
dependencies:
  flutter:
    sdk: flutter
  http: ^1.1.0
  shared_preferences: ^2.2.2
  flutter_secure_storage: ^9.0.0
  # Paddle SDK (선택사항)
  # paddle_flutter: ^최신버전
```

### 4. 요약

✅ **추가해야 할 것:**
1. `selectedRole` 변수
2. `DropdownButtonFormField<String>` 위젯으로 Role 선택 UI
3. Role 검증 로직
4. API 요청에 role 포함
5. nextStep 응답 처리
6. PaymentPlansScreen 화면

이제 Flutter 앱도 웹과 동일한 플로우로 작동합니다:
**회원가입 → 역할 선택 → 결제 플랜 선택 → 결제 → 기능 사용**
