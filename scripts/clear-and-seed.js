require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function clearAndSeed() {
  try {
    console.log('🗑️  Clearing existing data...');
    const db = mongoose.connection.db;
    
    await db.collection('job_vacancies').deleteMany({});
    await db.collection('Job_Vacancies_RDF').deleteMany({});
    await db.collection('job_seekers').deleteMany({});
    await db.collection('Job_Seekers_RDF').deleteMany({});
    await db.collection('online_tutors').deleteMany({});
    await db.collection('Online_Tutors_RDF').deleteMany({});
    
    console.log('✅ All data cleared!');
    await mongoose.connection.close();
    
    // Run seed script
    console.log('\n🌱 Running seed script...\n');
    require('./seed-sample-data.js');
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.connection.close();
  }
}

clearAndSeed();
