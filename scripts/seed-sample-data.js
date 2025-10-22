// scripts/seed-sample-data.js
// 진짜처럼 보이는 샘플 데이터 생성 스크립트

require('dotenv').config();
const mongoose = require('mongoose');
const JobVacancy = require('../model/jobVacancy');
const JobSeeker = require('../model/jobSeeker');
const OnlineTutor = require('../model/onlineTutor');

// MongoDB 연결
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// 10개 Job Vacancies (다양한 국가, 학교 타입, 실제처럼)
const jobVacancies = [
  {
    title: "English Teacher for Elementary Students in Seoul",
    _label: "English Teacher for Elementary Students in Seoul",
    description: "<p>We are looking for a passionate English teacher to join our team at Gangnam International School. The ideal candidate will have experience teaching elementary students and be able to create engaging lesson plans.</p><p><strong>Requirements:</strong></p><ul><li>Bachelor's degree in Education or related field</li><li>TEFL/TESOL certification</li><li>2+ years teaching experience</li><li>Native English speaker preferred</li></ul><p><strong>Benefits:</strong></p><ul><li>Competitive salary</li><li>Housing provided</li><li>Health insurance</li><li>Paid vacation</li></ul>",
    _description: "<p>We are looking for a passionate English teacher to join our team at Gangnam International School. The ideal candidate will have experience teaching elementary students and be able to create engaging lesson plans.</p><p><strong>Requirements:</strong></p><ul><li>Bachelor's degree in Education or related field</li><li>TEFL/TESOL certification</li><li>2+ years teaching experience</li><li>Native English speaker preferred</li></ul><p><strong>Benefits:</strong></p><ul><li>Competitive salary</li><li>Housing provided</li><li>Health insurance</li><li>Paid vacation</li></ul>",
    country: "South Korea",
    studentType: "Elementary",
    teachingArea: ["Grammar", "Speaking", "Reading"],
    duration: "1 year contract (renewable)",
    pay: "2.3-2.5 million KRW/month",
    housing: "Provided (studio apartment)",
    email: "hr@gangnamedu.kr",
    companyName: "Gangnam International School",
    jobLocation: "Seoul, Gangnam-gu",
    cellphoneNumber: "+82-10-1234-5678",
    homepage: "https://gangnamedu.kr",
    datePosted: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
  },
  {
    title: "IELTS Instructor - Part Time in Tokyo",
    _label: "IELTS Instructor - Part Time in Tokyo",
    description: "<p>Tokyo Language Academy is seeking an experienced IELTS instructor for part-time teaching positions. Perfect for teachers looking for flexible hours!</p><p><strong>What we offer:</strong></p><ul><li>Flexible scheduling</li><li>Modern facilities</li><li>Professional development opportunities</li><li>Great student-teacher ratio</li></ul><p><strong>Requirements:</strong></p><ul><li>IELTS score of 7.5 or above</li><li>Teaching certification (CELTA/DELTA preferred)</li><li>Experience with IELTS exam preparation</li></ul>",
    _description: "<p>Tokyo Language Academy is seeking an experienced IELTS instructor for part-time teaching positions. Perfect for teachers looking for flexible hours!</p><p><strong>What we offer:</strong></p><ul><li>Flexible scheduling</li><li>Modern facilities</li><li>Professional development opportunities</li><li>Great student-teacher ratio</li></ul><p><strong>Requirements:</strong></p><ul><li>IELTS score of 7.5 or above</li><li>Teaching certification (CELTA/DELTA preferred)</li><li>Experience with IELTS exam preparation</li></ul>",
    country: "Japan",
    studentType: "Adult",
    teachingArea: ["IELTS", "Test Preparation", "Speaking"],
    duration: "6 months minimum",
    pay: "3,000-4,000 JPY/hour",
    housing: "Not provided",
    email: "jobs@tokyolang.jp",
    companyName: "Tokyo Language Academy",
    jobLocation: "Tokyo, Shibuya",
    cellphoneNumber: "+81-90-1234-5678",
    homepage: "https://tokyolanguage.jp",
    datePosted: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
  },
  {
    title: "Kindergarten English Teacher in Shanghai",
    _label: "Kindergarten English Teacher in Shanghai",
    description: "<p>Bright Future Kindergarten is looking for an energetic and creative English teacher to work with our young learners aged 3-6.</p><p><strong>Responsibilities:</strong></p><ul><li>Plan and deliver age-appropriate English lessons</li><li>Create a fun and safe learning environment</li><li>Communicate with parents about student progress</li><li>Participate in school events and activities</li></ul><p><strong>We offer:</strong></p><ul><li>Attractive salary package</li><li>Free accommodation</li><li>Annual flight allowance</li><li>Chinese holidays + summer vacation</li><li>Work visa sponsorship</li></ul>",
    _description: "<p>Bright Future Kindergarten is looking for an energetic and creative English teacher to work with our young learners aged 3-6.</p><p><strong>Responsibilities:</strong></p><ul><li>Plan and deliver age-appropriate English lessons</li><li>Create a fun and safe learning environment</li><li>Communicate with parents about student progress</li><li>Participate in school events and activities</li></ul><p><strong>We offer:</strong></p><ul><li>Attractive salary package</li><li>Free accommodation</li><li>Annual flight allowance</li><li>Chinese holidays + summer vacation</li><li>Work visa sponsorship</li></ul>",
    country: "China",
    studentType: "Kindergarten",
    teachingArea: ["Phonics", "Songs & Games", "Basic Vocabulary"],
    duration: "1 year contract",
    pay: "18,000-22,000 RMB/month",
    housing: "Provided (furnished apartment)",
    email: "recruit@brightfuture-sh.cn",
    companyName: "Bright Future Kindergarten",
    jobLocation: "Shanghai, Pudong",
    cellphoneNumber: "+86-138-1234-5678",
    homepage: "https://brightfuture-shanghai.cn",
    datePosted: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
  },
  {
    title: "University English Professor in Hanoi",
    _label: "University English Professor in Hanoi",
    description: "<p>Vietnam National University seeks a qualified English professor to teach undergraduate courses in English Language and Literature.</p><p><strong>Qualifications:</strong></p><ul><li>Master's degree in English, Education, or related field (PhD preferred)</li><li>5+ years university teaching experience</li><li>Published research in English education</li><li>Excellent presentation and communication skills</li></ul><p><strong>Benefits Package:</strong></p><ul><li>Competitive university salary</li><li>Housing allowance</li><li>Research funding</li><li>International conference support</li></ul>",
    _description: "<p>Vietnam National University seeks a qualified English professor to teach undergraduate courses in English Language and Literature.</p><p><strong>Qualifications:</strong></p><ul><li>Master's degree in English, Education, or related field (PhD preferred)</li><li>5+ years university teaching experience</li><li>Published research in English education</li><li>Excellent presentation and communication skills</li></ul><p><strong>Benefits Package:</strong></p><ul><li>Competitive university salary</li><li>Housing allowance</li><li>Research funding</li><li>International conference support</li></ul>",
    country: "Vietnam",
    studentType: "University",
    teachingArea: ["Academic English", "Literature", "Writing"],
    duration: "2-3 year contract",
    pay: "35-45 million VND/month",
    housing: "Housing allowance provided",
    email: "hr@vnu.edu.vn",
    companyName: "Vietnam National University",
    jobLocation: "Hanoi",
    cellphoneNumber: "+84-91-234-5678",
    homepage: "https://vnu.edu.vn",
    datePosted: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  },
  {
    title: "Business English Instructor in Bangkok",
    _label: "Business English Instructor in Bangkok",
    description: "<p>Corporate Language Solutions is hiring Business English instructors to teach at major companies in Bangkok.</p><p><strong>About the role:</strong></p><ul><li>Teach English to corporate professionals</li><li>Focus on business communication, presentations, and emails</li><li>Classes held at client offices across Bangkok</li><li>Small group and one-on-one instruction</li></ul><p><strong>Requirements:</strong></p><ul><li>Business English teaching experience</li><li>Professional business background preferred</li><li>Flexible schedule (some evening classes)</li><li>Valid work permit or ability to obtain one</li></ul>",
    _description: "<p>Corporate Language Solutions is hiring Business English instructors to teach at major companies in Bangkok.</p><p><strong>About the role:</strong></p><ul><li>Teach English to corporate professionals</li><li>Focus on business communication, presentations, and emails</li><li>Classes held at client offices across Bangkok</li><li>Small group and one-on-one instruction</li></ul><p><strong>Requirements:</strong></p><ul><li>Business English teaching experience</li><li>Professional business background preferred</li><li>Flexible schedule (some evening classes)</li><li>Valid work permit or ability to obtain one</li></ul>",
    country: "Thailand",
    studentType: "Adult",
    teachingArea: ["Business English", "Presentations", "Writing"],
    duration: "Flexible (3+ months preferred)",
    pay: "45,000-65,000 THB/month",
    housing: "Not provided",
    email: "careers@corplang-th.com",
    companyName: "Corporate Language Solutions",
    jobLocation: "Bangkok",
    cellphoneNumber: "+66-89-123-4567",
    homepage: "https://corplang-thailand.com",
    datePosted: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
  },
  {
    title: "Middle School ESL Teacher in Taipei",
    _label: "Middle School ESL Teacher in Taipei",
    description: "<p>Taipei American School is seeking a dedicated ESL teacher for middle school students (grades 6-8).</p><p><strong>Position highlights:</strong></p><ul><li>Work with motivated international students</li><li>State-of-the-art facilities and resources</li><li>Supportive teaching community</li><li>Professional development opportunities</li></ul><p><strong>Requirements:</strong></p><ul><li>Teaching license from home country</li><li>ESL/EFL certification</li><li>3+ years middle school experience</li><li>Bachelor's degree minimum</li></ul>",
    _description: "<p>Taipei American School is seeking a dedicated ESL teacher for middle school students (grades 6-8).</p><p><strong>Position highlights:</strong></p><ul><li>Work with motivated international students</li><li>State-of-the-art facilities and resources</li><li>Supportive teaching community</li><li>Professional development opportunities</li></ul><p><strong>Requirements:</strong></p><ul><li>Teaching license from home country</li><li>ESL/EFL certification</li><li>3+ years middle school experience</li><li>Bachelor's degree minimum</li></ul>",
    country: "Taiwan",
    studentType: "Middle School",
    teachingArea: ["Reading", "Writing", "Grammar"],
    duration: "2 year contract",
    pay: "70,000-90,000 TWD/month",
    housing: "Housing allowance: 15,000 TWD/month",
    email: "employment@tas.edu.tw",
    companyName: "Taipei American School",
    jobLocation: "Taipei City",
    cellphoneNumber: "+886-912-345-678",
    homepage: "https://www.tas.edu.tw",
    datePosted: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)
  },
  {
    title: "TOEFL Test Prep Teacher in Busan",
    _label: "TOEFL Test Prep Teacher in Busan",
    description: "<p>Global English Academy in Busan is looking for an experienced TOEFL instructor to prepare students for university applications.</p><p><strong>Job Details:</strong></p><ul><li>Teach TOEFL iBT preparation courses</li><li>Focus on all four sections: Reading, Listening, Speaking, Writing</li><li>Monitor student progress and provide feedback</li><li>Small class sizes (8-12 students)</li></ul><p><strong>What we provide:</strong></p><ul><li>Curriculum and teaching materials</li><li>Regular training sessions</li><li>Performance bonuses</li><li>Visa sponsorship</li></ul>",
    _description: "<p>Global English Academy in Busan is looking for an experienced TOEFL instructor to prepare students for university applications.</p><p><strong>Job Details:</strong></p><ul><li>Teach TOEFL iBT preparation courses</li><li>Focus on all four sections: Reading, Listening, Speaking, Writing</li><li>Monitor student progress and provide feedback</li><li>Small class sizes (8-12 students)</li></ul><p><strong>What we provide:</strong></p><ul><li>Curriculum and teaching materials</li><li>Regular training sessions</li><li>Performance bonuses</li><li>Visa sponsorship</li></ul>",
    country: "South Korea",
    studentType: "High School",
    teachingArea: ["TOEFL", "Test Preparation", "Academic English"],
    duration: "1 year (renewable)",
    pay: "2.4-2.7 million KRW/month",
    housing: "Housing or 400,000 KRW/month allowance",
    email: "jobs@globaledu-busan.kr",
    companyName: "Global English Academy",
    jobLocation: "Busan, Haeundae",
    cellphoneNumber: "+82-10-9876-5432",
    homepage: "https://globalenglish-busan.kr",
    datePosted: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
  },
  {
    title: "Online English Teacher for Korean Students",
    _label: "Online English Teacher for Korean Students",
    description: "<p>Teach English online from anywhere! We're looking for teachers to conduct one-on-one and small group lessons for Korean students of all ages.</p><p><strong>Flexible Work:</strong></p><ul><li>Work from home</li><li>Choose your own hours</li><li>25-minute lesson format</li><li>All materials provided</li></ul><p><strong>Requirements:</strong></p><ul><li>Native English speaker</li><li>Bachelor's degree</li><li>Stable internet connection (minimum 10 Mbps)</li><li>Teaching certification preferred but not required</li></ul>",
    _description: "<p>Teach English online from anywhere! We're looking for teachers to conduct one-on-one and small group lessons for Korean students of all ages.</p><p><strong>Flexible Work:</strong></p><ul><li>Work from home</li><li>Choose your own hours</li><li>25-minute lesson format</li><li>All materials provided</li></ul><p><strong>Requirements:</strong></p><ul><li>Native English speaker</li><li>Bachelor's degree</li><li>Stable internet connection (minimum 10 Mbps)</li><li>Teaching certification preferred but not required</li></ul>",
    country: "Remote",
    studentType: "All Ages",
    teachingArea: ["Speaking", "Conversation", "Grammar"],
    duration: "Ongoing (minimum 3 months commitment)",
    pay: "18-25 USD/hour",
    housing: "N/A (Remote position)",
    email: "recruiting@teachkorean.online",
    companyName: "TeachKorean Online",
    jobLocation: "Remote (worldwide)",
    cellphoneNumber: "+82-2-1234-5678",
    homepage: "https://teachkorean.online",
    datePosted: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
  },
  {
    title: "Conversation English Teacher in Osaka",
    _label: "Conversation English Teacher in Osaka",
    description: "<p>Join our friendly team at Osaka English Café! We focus on conversational English in a relaxed, café-style environment.</p><p><strong>What makes us special:</strong></p><ul><li>Small group conversations (3-5 students)</li><li>Casual, comfortable teaching environment</li><li>No textbooks - focus on real-life communication</li><li>Great location in central Osaka</li></ul><p><strong>Ideal candidate:</strong></p><ul><li>Outgoing and personable</li><li>Experience with conversation classes</li><li>Interest in Japanese culture</li><li>Long-term commitment</li></ul>",
    _description: "<p>Join our friendly team at Osaka English Café! We focus on conversational English in a relaxed, café-style environment.</p><p><strong>What makes us special:</strong></p><ul><li>Small group conversations (3-5 students)</li><li>Casual, comfortable teaching environment</li><li>No textbooks - focus on real-life communication</li><li>Great location in central Osaka</li></ul><p><strong>Ideal candidate:</strong></p><ul><li>Outgoing and personable</li><li>Experience with conversation classes</li><li>Interest in Japanese culture</li><li>Long-term commitment</li></ul>",
    country: "Japan",
    studentType: "Adult",
    teachingArea: ["Conversation", "Speaking", "Pronunciation"],
    duration: "1 year minimum",
    pay: "250,000-300,000 JPY/month",
    housing: "Housing support available",
    email: "hello@osakaenglishcafe.jp",
    companyName: "Osaka English Café",
    jobLocation: "Osaka, Umeda",
    cellphoneNumber: "+81-80-9876-5432",
    homepage: "https://osakaenglishcafe.jp",
    datePosted: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
  },
  {
    title: "High School English Teacher in Singapore",
    _label: "High School English Teacher in Singapore",
    description: "<p>Singapore International Academy seeks an experienced high school English teacher for literature and language arts courses.</p><p><strong>Position Overview:</strong></p><ul><li>Teach English Literature and Language to grades 9-12</li><li>Prepare students for Cambridge IGCSE/A-Level exams</li><li>Mentor and support student development</li><li>Collaborate with international teaching staff</li></ul><p><strong>Excellent Benefits:</strong></p><ul><li>Tax-friendly salary</li><li>Housing allowance</li><li>Annual flight home</li><li>Health insurance</li><li>Professional development budget</li></ul>",
    _description: "<p>Singapore International Academy seeks an experienced high school English teacher for literature and language arts courses.</p><p><strong>Position Overview:</strong></p><ul><li>Teach English Literature and Language to grades 9-12</li><li>Prepare students for Cambridge IGCSE/A-Level exams</li><li>Mentor and support student development</li><li>Collaborate with international teaching staff</li></ul><p><strong>Excellent Benefits:</strong></p><ul><li>Tax-friendly salary</li><li>Housing allowance</li><li>Annual flight home</li><li>Health insurance</li><li>Professional development budget</li></ul>",
    country: "Singapore",
    studentType: "High School",
    teachingArea: ["Literature", "Writing", "Critical Thinking"],
    duration: "2 year contract",
    pay: "5,500-7,500 SGD/month",
    housing: "1,500 SGD/month allowance",
    email: "recruitment@sia.edu.sg",
    companyName: "Singapore International Academy",
    jobLocation: "Singapore",
    cellphoneNumber: "+65-9123-4567",
    homepage: "https://sia.edu.sg",
    datePosted: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000)
  }
];

// 5개 Job Seekers
const jobSeekers = [
  {
    fullName: "Sarah Johnson",
    email: "sarah.johnson.demo@eslplus.org",
    title: "Experienced Elementary ESL Teacher seeking position in Asia",
    description: "<p>Passionate and dedicated ESL teacher with 5 years of experience teaching elementary students. TEFL certified with a Bachelor's degree in Education.</p><p><strong>Teaching Experience:</strong></p><ul><li>3 years at Seoul International School (2020-2023)</li><li>2 years at Bangkok Language Academy (2018-2020)</li></ul><p><strong>Specializations:</strong></p><ul><li>Phonics and early literacy</li><li>Classroom management</li><li>Differentiated instruction</li><li>Parent communication</li></ul><p>Available for immediate start. Willing to relocate to South Korea, Japan, or Taiwan.</p>",
    nationality: "United States",
    preferredWorkLocation: "South Korea, Japan, Taiwan",
    major: "Elementary Education",
    languageSpoken: ["English", "Basic Korean"],
    dateAvailable: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  },
  {
    fullName: "Michael Chen",
    email: "michael.chen.demo@eslplus.org",
    title: "IELTS/TOEFL Specialist with 8 years experience",
    description: "<p>Expert test preparation instructor specializing in IELTS and TOEFL. Track record of helping students achieve their target scores.</p><p><strong>Qualifications:</strong></p><ul><li>CELTA and DELTA certified</li><li>IELTS 8.5 overall (9.0 in Speaking and Writing)</li><li>Master's degree in Applied Linguistics</li></ul><p><strong>Career Highlights:</strong></p><ul><li>95% of students achieved target IELTS scores</li><li>Developed proprietary test-taking strategies</li><li>Trained junior teachers in test prep methodologies</li></ul><p>Looking for senior teaching position or academic coordinator role.</p>",
    nationality: "Canada",
    preferredWorkLocation: "Singapore, Hong Kong, South Korea",
    major: "Applied Linguistics",
    languageSpoken: ["English", "Mandarin Chinese"],
    dateAvailable: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
  },
  {
    fullName: "Emily Thompson",
    email: "emily.thompson.demo@eslplus.org",
    title: "Young Learners Specialist - Kindergarten & Elementary",
    description: "<p>Energetic and creative teacher with a passion for teaching young learners. Experienced in play-based learning and phonics instruction.</p><p><strong>Teaching Philosophy:</strong></p><ul><li>Child-centered, student-led approach</li><li>Incorporating songs, games, and hands-on activities</li><li>Building confidence through positive reinforcement</li></ul><p><strong>Experience:</strong></p><ul><li>4 years teaching kindergarten in China</li><li>2 years as private tutor for ages 4-8</li></ul><p>Available immediately. Prefer positions in China or Southeast Asia.</p>",
    nationality: "United Kingdom",
    preferredWorkLocation: "China, Vietnam, Thailand",
    major: "Early Childhood Education",
    languageSpoken: ["English", "Basic Mandarin"],
    dateAvailable: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
  },
  {
    fullName: "James Mitchell",
    email: "james.mitchell.demo@eslplus.org",
    title: "Business English Instructor & Corporate Trainer",
    description: "<p>Professional Business English trainer with corporate background. Specialized in communication skills for business professionals.</p><p><strong>Corporate Experience:</strong></p><ul><li>10 years in international business (Marketing & Sales)</li><li>5 years teaching Business English</li><li>Clients include Samsung, LG, and Hyundai</li></ul><p><strong>Training Specialties:</strong></p><ul><li>Business presentations and negotiations</li><li>Email and report writing</li><li>Cross-cultural communication</li><li>Meeting facilitation</li></ul><p>Open to corporate training positions or business English programs.</p>",
    nationality: "Australia",
    preferredWorkLocation: "South Korea, Japan, Singapore",
    major: "Business Administration & TESOL",
    languageSpoken: ["English", "Japanese (Conversational)"],
    dateAvailable: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000)
  },
  {
    fullName: "Rachel Martinez",
    email: "rachel.martinez.demo@eslplus.org",
    title: "University Level EAP Instructor & Academic Writing Coach",
    description: "<p>Academic English instructor with expertise in preparing students for university study. PhD candidate in Education.</p><p><strong>Academic Credentials:</strong></p><ul><li>Master's in TESOL from Columbia University</li><li>PhD candidate in Educational Linguistics</li><li>Published research in academic writing pedagogy</li></ul><p><strong>Teaching Focus:</strong></p><ul><li>Academic writing and research skills</li><li>Critical thinking and analysis</li><li>University preparation (IELTS, TOEFL)</li><li>English for Academic Purposes (EAP)</li></ul><p>Seeking university position with opportunities for research and professional development.</p>",
    nationality: "United States",
    preferredWorkLocation: "Japan, South Korea, Taiwan, Hong Kong",
    major: "TESOL & Educational Linguistics",
    languageSpoken: ["English", "Spanish"],
    dateAvailable: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
  }
];

// 5개 Online Tutors
const onlineTutors = [
  {
    fullName: "David Park",
    email: "david.park.demo@eslplus.org",
    title: "Conversation & Pronunciation Expert - Native Speaker",
    description: "<p>Friendly and patient online tutor specializing in conversational English and pronunciation improvement. Perfect for students wanting to sound more natural!</p><p><strong>My Approach:</strong></p><ul><li>Focus on practical, everyday English</li><li>Accent reduction and pronunciation drills</li><li>Building confidence in speaking</li><li>Customized lessons based on your goals</li></ul><p><strong>Experience:</strong></p><ul><li>5 years online teaching experience</li><li>Taught 500+ students from 20+ countries</li><li>TEFL certified with linguistics background</li></ul><p><strong>Availability:</strong> Flexible hours, 7 days a week</p><p><strong>Rates:</strong> $25-35/hour depending on package</p>",
    expertise: "Conversation, Pronunciation, American Accent",
    tutoringExperience: "5 years online, 1000+ hours taught",
    gender: "Male",
    skypeId: "david.park.esl"
  },
  {
    fullName: "Lisa Anderson",
    email: "lisa.anderson.demo@eslplus.org",
    title: "Business English Coach for Professionals",
    description: "<p>Experienced business English coach helping professionals advance their careers through improved English communication skills.</p><p><strong>Specializations:</strong></p><ul><li>Job interview preparation</li><li>Business presentations and public speaking</li><li>Email and business writing</li><li>Negotiation and meeting skills</li></ul><p><strong>Background:</strong></p><ul><li>MBA from London Business School</li><li>10 years in international business</li><li>CELTA certified</li><li>Corporate trainer for Fortune 500 companies</li></ul><p><strong>Rates:</strong> $40-60/hour</p><p><strong>Free 30-minute consultation available!</strong></p>",
    expertise: "Business English, Professional Communication, Career Development",
    tutoringExperience: "7 years coaching professionals, 800+ hours",
    gender: "Female",
    skypeId: "lisa.anderson.business"
  },
  {
    fullName: "Tom Wilson",
    email: "tom.wilson.demo@eslplus.org",
    title: "IELTS & TOEFL Expert - High Score Guarantee",
    description: "<p>Get the scores you need! Specialized IELTS and TOEFL instructor with proven track record of student success.</p><p><strong>Success Rate:</strong></p><ul><li>98% of students achieved their target scores</li><li>Average score improvement: 1.5 bands (IELTS)</li><li>Taught 300+ students to success</li></ul><p><strong>What I Offer:</strong></p><ul><li>Personalized study plans</li><li>All four skills (Reading, Writing, Listening, Speaking)</li><li>Practice tests with detailed feedback</li><li>Test-taking strategies and tips</li></ul><p><strong>Qualifications:</strong> IELTS 9.0, DELTA certified, MA in Applied Linguistics</p><p><strong>Rates:</strong> $35-45/hour, Package discounts available</p>",
    expertise: "IELTS, TOEFL, Test Preparation, Academic English",
    tutoringExperience: "6 years test prep specialist, 1200+ hours",
    gender: "Male",
    skypeId: "tom.wilson.ielts"
  },
  {
    fullName: "Jennifer Lee",
    email: "jennifer.lee.demo@eslplus.org",
    title: "Kids English Teacher - Fun & Interactive Lessons!",
    description: "<p>Make learning English fun for your child! Engaging online lessons for kids aged 5-12 using games, songs, and stories.</p><p><strong>Why Kids Love My Classes:</strong></p><ul><li>Interactive games and activities</li><li>Colorful visual materials</li><li>Positive encouragement and rewards</li><li>Age-appropriate lessons</li></ul><p><strong>Experience:</strong></p><ul><li>8 years teaching young learners</li><li>Specialized in phonics and reading</li><li>Former kindergarten teacher in Seoul</li><li>TESOL certified + Early Childhood Education degree</li></ul><p><strong>Rates:</strong> $20-30/hour</p><p><strong>Trial lesson: $15 (25 minutes)</strong></p>",
    expertise: "Young Learners, Phonics, Reading, Kids English",
    tutoringExperience: "8 years teaching children, 2000+ hours",
    gender: "Female",
    skypeId: "jennifer.lee.kids"
  },
  {
    fullName: "Robert Taylor",
    email: "robert.taylor.demo@eslplus.org",
    title: "Grammar & Writing Specialist - Academic & General",
    description: "<p>Master English grammar and writing with personalized tutoring. Perfect for students, professionals, and anyone wanting to write better English.</p><p><strong>My Expertise:</strong></p><ul><li>English grammar (all levels)</li><li>Academic writing and essays</li><li>Business writing</li><li>Proofreading and editing</li></ul><p><strong>Credentials:</strong></p><ul><li>MA in English Literature</li><li>Published author and editor</li><li>12 years teaching experience</li><li>CELTA and Trinity DipTESOL</li></ul><p><strong>Student Testimonials:</strong></p><p><em>\"Robert helped me improve my IELTS Writing from 6.0 to 7.5 in just 8 weeks!\" - Kim, South Korea</em></p><p><strong>Rates:</strong> $30-40/hour, Essay correction service available</p>",
    expertise: "Grammar, Academic Writing, Essay Correction, Proofreading",
    tutoringExperience: "12 years teaching, 3000+ hours online",
    gender: "Male",
    skypeId: "robert.taylor.writing"
  }
];

async function seedData() {
  try {
    console.log('🌱 Starting seed process...');

    // Job Vacancies 삽입
    console.log('\n📝 Creating Job Vacancies...');
    for (const vacancy of jobVacancies) {
      const newVacancy = await JobVacancy.create(vacancy);
      console.log(`✅ Created: ${newVacancy.title}`);
      
      // RDF 컬렉션에도 미러링
      const db = mongoose.connection.db;
      await db.collection('Job_Vacancies_RDF').insertOne({
        _id: newVacancy._id,
        '@id': `job_vacancy_${newVacancy._id}`,
        ...vacancy,
        datePosted: vacancy.datePosted || new Date()
      });
    }

    // Job Seekers 삽입
    console.log('\n👔 Creating Job Seekers...');
    for (const seeker of jobSeekers) {
      const newSeeker = await JobSeeker.create(seeker);
      console.log(`✅ Created: ${newSeeker.fullName}`);
      
      // RDF 컬렉션에도 미러링
      const db = mongoose.connection.db;
      await db.collection('Job_Seekers_RDF').insertOne({
        _id: newSeeker._id,
        '@id': `job_seeker_${newSeeker._id}`,
        ...seeker,
        _label: seeker.title,
        _description: seeker.description
      });
    }

    // Online Tutors 삽입
    console.log('\n🎓 Creating Online Tutors...');
    for (const tutor of onlineTutors) {
      const newTutor = await OnlineTutor.create(tutor);
      console.log(`✅ Created: ${newTutor.fullName}`);
      
      // RDF 컬렉션에도 미러링
      const db = mongoose.connection.db;
      await db.collection('Online_Tutors_RDF').insertOne({
        _id: newTutor._id,
        '@id': `online_tutor_${newTutor._id}`,
        ...tutor,
        _label: tutor.title,
        _description: tutor.description
      });
    }

    console.log('\n✨ Seed completed successfully!');
    console.log('📊 Summary:');
    console.log(`   - ${jobVacancies.length} Job Vacancies created`);
    console.log(`   - ${jobSeekers.length} Job Seekers created`);
    console.log(`   - ${onlineTutors.length} Online Tutors created`);
    
  } catch (error) {
    console.error('❌ Seed error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

// 실행
seedData();
