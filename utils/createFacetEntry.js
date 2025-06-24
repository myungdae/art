// utils/createFacetEntry.js

function createFacetEntryFromCRUD(job) {
  const label = job.title?.trim() || 'No Title';
  const idSuffix = label.replace(/\s+/g, '_');
  const id = `http://esl.eventpool.kr/resource/${idSuffix}`;
  // const type = `http://esl.eventpool.kr/resource/Job_Vacancy`;
  const type = "Job_Vacancies";
  const descriptionParts = [job.country, job.studentType, job.teachingArea]
    .filter(Boolean)
    .join(', ');

  return {
    "@id": id,
    "@type": type,
    "http://www.w3.org/2000/01/rdf-schema#label": {
      "@value": label
    },
    "http://purl.org/dc/elements/1.1/description": {
      "@value": descriptionParts
    }
  };
}

module.exports = { createFacetEntryFromCRUD };
