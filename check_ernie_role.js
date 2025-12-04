const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./model/user');

async function checkAndUpdateErnieRole() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
    
    const ernie = await User.findOne({ email: 'dudenll@gmail.com' });
    
    if (!ernie) {
      console.log('❌ User "ernie" (dudenll@gmail.com) not found');
      await mongoose.connection.close();
      return;
    }
    
    console.log('\n📋 Current ernie user info:');
    console.log('  Email:', ernie.email);
    console.log('  Username:', ernie.username);
    console.log('  Role:', ernie.role);
    console.log('  Created:', ernie.createdAt);
    
    // If you want to change role from Admin to Employer:
    // Uncomment the lines below and run again
    /*
    if (ernie.role === 'Admin') {
      ernie.role = 'Employer';  // or 'Job_Seeker' or 'Online_Tutor'
      await ernie.save();
      console.log('\n✅ Updated ernie role from Admin to Employer');
    }
    */
    
    await mongoose.connection.close();
    console.log('\n✅ Done');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkAndUpdateErnieRole();
