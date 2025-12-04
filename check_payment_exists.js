const mongoose = require('mongoose');
const path = require('path');

// Load .env from the correct path
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Debug: Check if MONGODB_URI is loaded
console.log('🔍 Checking environment variables...');
console.log('MONGODB_URI exists:', !!process.env.MONGODB_URI);
console.log('MONGODB_URI length:', process.env.MONGODB_URI?.length || 0);

if (!process.env.MONGODB_URI) {
  console.error('❌ MONGODB_URI is not defined in .env file');
  console.log('\n📝 Please check your .env file contains:');
  console.log('MONGODB_URI=mongodb://...');
  process.exit(1);
}

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => {
  console.log('✅ Connected to MongoDB');
  checkPaymentExists();
});

async function checkPaymentExists() {
  try {
    const Payment = require('./models/Payment');
    
    const paymentId = 'employer_1_68f83c28_1764827821146';
    
    console.log(`\n🔍 Checking if payment ${paymentId} exists...`);
    
    const existingPayment = await Payment.findOne({ paymentId });
    
    if (existingPayment) {
      console.log('\n✅ Payment ALREADY EXISTS in database:');
      console.log('Payment ID:', existingPayment.paymentId);
      console.log('Amount:', `₩${existingPayment.amount.toLocaleString()}`);
      console.log('User ID:', existingPayment.userId);
      console.log('User Email:', existingPayment.userEmail);
      console.log('User Role:', existingPayment.userRole);
      console.log('Package Type:', existingPayment.packageType);
      console.log('Status:', existingPayment.status);
      console.log('Paid At:', existingPayment.paidAt);
      console.log('Order ID:', existingPayment.orderId || 'null');
      
      console.log('\n⚠️  This payment was already recovered!');
      console.log('👉 Check ernie\'s MyPage to verify it shows up in Purchase History');
      
      // Check user's credits
      const User = require('./models/User');
      const user = await User.findById(existingPayment.userId);
      
      if (user) {
        console.log('\n📊 User "ernie" current status:');
        console.log('Available Ads:', user.adsAvailable || 0);
        console.log('Resume Access:', user.resumeAccess?.startDate ? 'Active' : 'None');
        console.log('Tutor Access:', user.tutorAccess?.startDate ? 'Active' : 'None');
      }
      
    } else {
      console.log('\n❌ Payment NOT found in database');
      console.log('This payment needs to be recovered.');
      
      // Check all payments for the user
      const User = require('./models/User');
      const user = await User.findOne({ email: 'dudehdi@gmail.com' });
      
      if (user) {
        const userPayments = await Payment.find({ userId: user._id });
        console.log(`\n📋 User "ernie" has ${userPayments.length} payment(s) in total:`);
        userPayments.forEach(p => {
          console.log(`  - ${p.paymentId}: ₩${p.amount.toLocaleString()} (${p.status}) - ${p.paidAt}`);
        });
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}
