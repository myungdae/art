const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./model/user');

async function findErnie() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Try to find by username
    const ernieByUsername = await User.findOne({ username: 'ernie' });
    const ernieByUsername2 = await User.findOne({ username: /ernie/i });
    
    // Try to find all Admin users
    const adminUsers = await User.find({ role: 'Admin' });
    
    // Try to find all users with "duden" in email
    const dudenUsers = await User.find({ email: /duden/i });
    
    console.log('🔍 Search Results:\n');
    
    if (ernieByUsername) {
      console.log('✅ Found by username "ernie":');
      console.log('  Email:', ernieByUsername.email);
      console.log('  Username:', ernieByUsername.username);
      console.log('  Role:', ernieByUsername.role);
      console.log('  ID:', ernieByUsername._id);
      console.log('');
    } else if (ernieByUsername2) {
      console.log('✅ Found by username pattern (ernie):');
      console.log('  Email:', ernieByUsername2.email);
      console.log('  Username:', ernieByUsername2.username);
      console.log('  Role:', ernieByUsername2.role);
      console.log('  ID:', ernieByUsername2._id);
      console.log('');
    } else {
      console.log('❌ No user found with username "ernie"\n');
    }
    
    if (adminUsers.length > 0) {
      console.log(`✅ Found ${adminUsers.length} Admin user(s):`);
      adminUsers.forEach((admin, idx) => {
        console.log(`  ${idx + 1}. Email: ${admin.email}`);
        console.log(`     Username: ${admin.username}`);
        console.log(`     ID: ${admin._id}`);
        console.log('');
      });
    } else {
      console.log('ℹ️  No Admin users found\n');
    }
    
    if (dudenUsers.length > 0) {
      console.log(`✅ Found ${dudenUsers.length} user(s) with "duden" in email:`);
      dudenUsers.forEach((user, idx) => {
        console.log(`  ${idx + 1}. Email: ${user.email}`);
        console.log(`     Username: ${user.username}`);
        console.log(`     Role: ${user.role}`);
        console.log(`     ID: ${user._id}`);
        console.log('');
      });
    }
    
    // List recent users (last 10)
    console.log('📋 Last 10 registered users:');
    const recentUsers = await User.find().sort({ createdAt: -1 }).limit(10);
    recentUsers.forEach((user, idx) => {
      console.log(`  ${idx + 1}. ${user.email} (${user.username}) - ${user.role}`);
    });
    
    await mongoose.connection.close();
    console.log('\n✅ Done');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

findErnie();
