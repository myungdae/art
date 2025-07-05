function createFacetEntryFromCRUD(job) {
  const label = job.title?.trim() || 'No Title';
  const idSuffix = label.replace(/\s+/g, '_');
  const id = `http://esl.eventpool.kr/resource/${idSuffix}`;
  const type = "Job_Vacancies";

  const descriptionValue = job._description || '';  // 사용자 작성 진짜 description

  return {
    "@id": id,
    "@type": type,
    "http://www.w3.org/2000/01/rdf-schema#label": {
      "@value": label
    },
    "http://purl.org/dc/elements/1.1/description": {
      "@value": descriptionValue
    },
    hostCountry: job.country || 'N/A',
    studentType: job.studentType || 'N/A',
    teachingArea: job.teachingArea || 'N/A'
  };
}

module.exports = { createFacetEntryFromCRUD };

