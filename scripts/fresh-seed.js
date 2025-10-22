require('dotenv').config();
const mongoose = require('mongoose');
const JobVacancy = require('../model/jobVacancy');
const JobSeeker = require('../model/jobSeeker');
const OnlineTutor = require('../model/onlineTutor');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  try {
    console.log('🗑️  Step 1: Clearing ALL existing data...');
    const db = mongoose.connection.db;
    
    await db.collection('job_vacancies').deleteMany({});
    await db.collection('Job_Vacancies_RDF').deleteMany({});
    await db.collection('job_seekers').deleteMany({});
    await db.collection('Job_Seekers_RDF').deleteMany({});
    await db.collection('online_tutors').deleteMany({});
    await db.collection('Online_Tutors_RDF').deleteMany({});
    
    console.log('✅ All data cleared!\n');
    console.log('🌱 Step 2: Running seed script...');
    
    // Close this connection
    await mongoose.connection.close();
    
    // Run seed
    const { exec } = require('child_process');
    exec('node scripts/seed-sample-data.js', (error, stdout, stderr) => {
      if (error) console.error(error);
      console.log(stdout);
      if (stderr && !stderr.includes('DeprecationWarning')) console.error(stderr);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.connection.close();
  }
});
