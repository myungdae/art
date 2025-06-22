const fs = require('fs');
const $rdf = require('rdflib');

const BASE_URI = 'http://esl.eventpool.kr/resource/';

/**
 * JobVacancy 데이터를 RDF triples로 변환
 * @param {Object} job - JobVacancy 객체
 * @returns {Store} - RDF triples가 담긴 rdflib Store
 */
function translateJobVacancyToRDF(job) {
  const store = $rdf.graph();
  const RDF = $rdf.Namespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#');
  const DC = $rdf.Namespace('http://purl.org/dc/elements/1.1/');
  const ESL = $rdf.Namespace(BASE_URI);

  const subject = ESL(job._id.toString());

  store.add(subject, RDF('type'), ESL('JobVacancy'));

  // 주요 필드 RDF로 추가
  if (job.title) store.add(subject, DC('title'), $rdf.literal(job.title));
  if (job.description) store.add(subject, DC('description'), $rdf.literal(job.description));
  if (job.country) store.add(subject, ESL('country'), $rdf.literal(job.country));
  if (job.studentType) store.add(subject, ESL('studentType'), $rdf.literal(job.studentType));
  if (job.teachingArea) store.add(subject, ESL('teachingArea'), $rdf.literal(job.teachingArea));
  if (job.duration) store.add(subject, ESL('duration'), $rdf.literal(job.duration));
  if (job.pay) store.add(subject, ESL('pay'), $rdf.literal(job.pay));
  if (job.housing) store.add(subject, ESL('housing'), $rdf.literal(job.housing));
  if (job.adPackage) store.add(subject, ESL('adPackage'), $rdf.literal(job.adPackage));
  if (job.addResumeAccess !== undefined) store.add(subject, ESL('addResumeAccess'), $rdf.literal(String(job.addResumeAccess)));

  if (job.companyName) store.add(subject, ESL('companyName'), $rdf.literal(job.companyName));
  if (job.jobLocation) store.add(subject, ESL('jobLocation'), $rdf.literal(job.jobLocation));
  if (job.datePosted) store.add(subject, DC('date'), $rdf.literal(new Date(job.datePosted).toISOString()));

  if (job.email) store.add(subject, ESL('email'), $rdf.literal(job.email));
  if (job.cellphoneNumber) store.add(subject, ESL('cellphoneNumber'), $rdf.literal(job.cellphoneNumber));
  if (job.skypeId) store.add(subject, ESL('skypeId'), $rdf.literal(job.skypeId));
  if (job.wechatId) store.add(subject, ESL('wechatId'), $rdf.literal(job.wechatId));
  if (job.homepage) store.add(subject, ESL('homepage'), $rdf.literal(job.homepage));

  return store;
}

/**
 * RDF Store를 Turtle 형식으로 파일에 저장
 * @param {Store} store - rdflib Store
 * @param {string} filePath - 저장할 파일 경로
 * @returns {Promise<void>}
 */
function saveRDFToFile(store, filePath) {
  return new Promise((resolve, reject) => {
    const contentType = 'text/turtle';
    const baseURI = BASE_URI;

    $rdf.serialize(null, store, baseURI, contentType, (err, str) => {
      if (err) return reject(err);

      fs.writeFile(filePath, str, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  });
}

module.exports = {
  translateJobVacancyToRDF,
  saveRDFToFile
};
