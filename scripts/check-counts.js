require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const db = mongoose.connection.db;
  
  const jv = await db.collection('job_vacancies').countDocuments();
  const jvRdf = await db.collection('Job_Vacancies_RDF').countDocuments();
  const js = await db.collection('job_seekers').countDocuments();
  const jsRdf = await db.collection('Job_Seekers_RDF').countDocuments();
  const ot = await db.collection('online_tutors').countDocuments();
  const otRdf = await db.collection('Online_Tutors_RDF').countDocuments();
  
  console.log('📊 Current data counts:');
  console.log(`   Job Vacancies: ${jv} (Mongoose), ${jvRdf} (RDF)`);
  console.log(`   Job Seekers: ${js} (Mongoose), ${jsRdf} (RDF)`);
  console.log(`   Online Tutors: ${ot} (Mongoose), ${otRdf} (RDF)`);
  
  await mongoose.connection.close();
});
