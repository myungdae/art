require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  try {
    console.log('🗑️ Clearing test data...');
    const db = mongoose.connection.db;
    await db.collection('job_vacancies').deleteMany({});
    await db.collection('Job_Vacancies_RDF').deleteMany({});
    console.log('✅ Cleared!\n');
    await mongoose.connection.close();
    
    console.log('🌱 Running full seed...');
    setTimeout(() => {
      require('./seed-sample-data.js');
    }, 1000);
  } catch (error) {
    console.error('❌ Error:', error.message);
    await mongoose.connection.close();
  }
});
