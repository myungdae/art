require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const db = mongoose.connection.db;
  
  const sample = await db.collection('Job_Vacancies_RDF').findOne({});
  console.log('Sample Job Vacancy RDF:');
  console.log(JSON.stringify(sample, null, 2));
  
  await mongoose.connection.close();
});
