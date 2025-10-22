require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  try {
    const db = mongoose.connection.db;
    const indexes = await db.collection('jobvacancies').indexes();
    
    console.log('Current indexes on jobvacancies:');
    indexes.forEach(idx => console.log('  -', idx.name, JSON.stringify(idx.key)));
    
    // Drop the problematic index
    try {
      await db.collection('jobvacancies').dropIndex('user_1_title_1');
      console.log('\n✅ Dropped user_1_title_1 index');
    } catch (e) {
      console.log('\n⚠️ Could not drop:', e.message);
    }
    
    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await mongoose.connection.close();
  }
});
