const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./model/user');

async function checkAndUpdateErnieRole() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
    
    const ernie = await User.findOne({ email: 'dudehdi@gmail.com' });
    
    if (!ernie) {
      console.log('❌ User "ernie" (dudehdi@gmail.com) not found');
      await mongoose.connection.close();
      return;
    }
    
    console.log('\n📋 Current ernie user info:');
    console.log('  Email:', ernie.email);
    console.log('  Username:', ernie.username);
    console.log('  Role:', ernie.role);
    console.log('  Created:', ernie.createdAt);
    
    // Automatically change role from Admin to Employer
    if (ernie.role === 'Admin') {
      ernie.role = 'Employer';  // Changed to Employer
      await ernie.save();
      console.log('\n✅ Updated ernie role from Admin to Employer');
      console.log('   Please logout and login again to see the change');
    } else {
      console.log('\n✅ Role is already:', ernie.role);
    }
    
    await mongoose.connection.close();
    console.log('\n✅ Done');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkAndUpdateErnieRole();
