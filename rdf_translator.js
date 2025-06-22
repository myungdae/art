// rdf_translator.js
const fs = require('fs');
const path = require('path');

function translateJobVacancyToRDF(jobVacancy) {
  return {
    "@context": {
      "@vocab": "http://esl.eventpool.kr/ontology/",
      "id": "@id",
      "type": "@type"
    },
    "@id": `http://esl.eventpool.kr/resource/${jobVacancy._id}`,
    "@type": "JobVacancy",
    "title": jobVacancy.title || "",
    "country": jobVacancy.country || "",
    "studentType": jobVacancy.studentType || "",
    "teachingArea": jobVacancy.teachingArea || "",
    "duration": jobVacancy.duration || "",
    "createdAt": jobVacancy.createdAt
  };
}

function saveRDFToFile(rdfData, _id) {
  const dir = path.join(__dirname, 'public', 'rdf', 'job_vacancies');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const filePath = path.join(dir, `${_id}.jsonld`);
  fs.writeFileSync(filePath, JSON.stringify(rdfData, null, 2), 'utf-8');
}

module.exports = { translateJobVacancyToRDF, saveRDFToFile };
