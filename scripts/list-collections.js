require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();
  
  console.log('📚 All collections:');
  collections.forEach(c => console.log('  -', c.name));
  
  await mongoose.connection.close();
});
