require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  try {
    const db = mongoose.connection.db;
    
    console.log('Adding _class field to RDF collections...\n');
    
    // Job Vacancies
    const jv = await db.collection('Job_Vacancies_RDF').updateMany(
      {},
      { $set: { _class: 'Job_Vacancies' } }
    );
    console.log(`✅ Job_Vacancies_RDF: ${jv.modifiedCount} documents updated`);
    
    // Job Seekers
    const js = await db.collection('Job_Seekers_RDF').updateMany(
      {},
      { $set: { _class: 'Job_Seekers' } }
    );
    console.log(`✅ Job_Seekers_RDF: ${js.modifiedCount} documents updated`);
    
    // Online Tutors
    const ot = await db.collection('Online_Tutors_RDF').updateMany(
      {},
      { $set: { _class: 'Online_Tutors' } }
    );
    console.log(`✅ Online_Tutors_RDF: ${ot.modifiedCount} documents updated`);
    
    console.log('\n✨ All _class fields added successfully!');
    
    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await mongoose.connection.close();
  }
});
