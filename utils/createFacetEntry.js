const sanitizeHtml = require('sanitize-html');

function createFacetEntryFromCRUD(job) {
  const label = job.title?.trim() || 'No Title';
  const idSuffix = label.replace(/\s+/g, '_');
  const id = `http://esl.eventpool.kr/resource/${idSuffix}`;
  const type = "Job_Vacancies";

  return {
    "@id": id,
    "@type": type,
    "http://www.w3.org/2000/01/rdf-schema#label": {
      "@value": label
    },
    "http://purl.org/dc/elements/1.1/description": {
      "@value": sanitizeHtml(job._description || '', {
        allowedTags: ['p', 'strong', 'em', 'ul', 'li', 'ol', 'br'],
        allowedAttributes: {}
      })
    },
    hostCountry: job.country || 'N/A',
    studentType: job.studentType || 'N/A',
    teachingArea: job.teachingArea || 'N/A',
    duration: job.duration || 'N/A',
    pay: job.pay || 'N/A',
    housing: job.housing || 'N/A',
    email: job.email || 'N/A',
    companyName: job.companyName || 'N/A',
    jobLocation: job.jobLocation || 'N/A',
    cellphoneNumber: job.cellphoneNumber || 'N/A',
    skypeId: job.skypeId || 'N/A',
    wechatId: job.wechatId || 'N/A',
    homepage: job.homepage || 'N/A',
    adPackage: job.adPackage || 'N/A',
    addResumeAccess: job.addResumeAccess ? 'Yes' : 'No'
  };
}

module.exports = { createFacetEntryFromCRUD };
