require('dotenv').config();
const mongoose = require('mongoose');
const JobVacancy = require('../model/jobVacancy');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  try {
    const vacancy = await JobVacancy.create({
      title: "TEST English Teacher in Seoul",
      _label: "TEST English Teacher in Seoul",
      description: "<p>This is a test</p>",
      _description: "<p>This is a test</p>",
      country: "South Korea",
      studentType: "Elementary",
      teachingArea: ["Grammar"],
      pay: "2.5 million KRW/month",
      email: "test@eslplus.org"
    });
    
    console.log('✅ Test vacancy created:', vacancy._id);
    
    // Mirror to RDF
    const db = mongoose.connection.db;
    await db.collection('Job_Vacancies_RDF').insertOne({
      _id: vacancy._id,
      '@id': `job_vacancy_${vacancy._id}`,
      title: vacancy.title,
      _label: vacancy._label,
      description: vacancy.description,
      _description: vacancy._description,
      country: vacancy.country,
      studentType: vacancy.studentType,
      teachingArea: vacancy.teachingArea,
      pay: vacancy.pay,
      email: vacancy.email,
      datePosted: vacancy.datePosted
    });
    
    console.log('✅ RDF mirror created');
    
    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await mongoose.connection.close();
  }
});
