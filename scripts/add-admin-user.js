require('dotenv').config();
const mongoose = require('mongoose');

// User 모델을 동적으로 생성 (role enum에 Admin 추가)
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ["Employer", "Job_Seeker", "Online_Tutor", "Admin"],
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  adsAvailable: {
    type: Number,
    default: 0,
  },
  resumeAccess: {
    startDate: { type: Date },
    durationDays: { type: Number },
  },
  tutorAccess: {
    startDate: { type: Date },
    durationDays: { type: Number },
  },
});

const User = mongoose.model('User', userSchema);

async function addAdminUser() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Check if user already exists
    const existing = await User.findOne({ email: 'dudehdi@gmail.com' });
    if (existing) {
      console.log('User already exists:', existing.email, 'Role:', existing.role);
      
      // Update to Admin role if not already
      if (existing.role !== 'Admin') {
        existing.role = 'Admin';
        await existing.save();
        console.log('Updated user role to Admin');
      }
      
      await mongoose.connection.close();
      return;
    }

    // Create new admin user (password stored in plain text as per current implementation)
    const newAdmin = new User({
      username: 'dudehdi',
      email: 'dudehdi@gmail.com',
      password: 'ldc@linked12',
      role: 'Admin',
      createdAt: new Date(),
      adsAvailable: 0,
    });

    await newAdmin.save();
    console.log('✅ Admin user created successfully!');
    console.log('Email:', newAdmin.email);
    console.log('Role:', newAdmin.role);

    await mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

addAdminUser();
