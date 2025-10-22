require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const db = mongoose.connection.db;
  
  const count1 = await db.collection('job_vacancies').countDocuments();
  const count2 = await db.collection('jobvacancies').countDocuments();
  
  console.log('job_vacancies:', count1);
  console.log('jobvacancies:', count2);
  
  await mongoose.connection.close();
});
