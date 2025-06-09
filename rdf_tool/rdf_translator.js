// rdf_translator.js

const fs = require('fs');
const readline = require('readline');
const { v4: uuidv4 } = require('uuid');

const baseURI = "http://esl.eventpool.kr/resource/";
const outputDir = "./output";
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function main() {
  console.log("📥 Enter job information to convert into RDF triples.\n");

  const title = await ask("Job Title: ");
  const description = await ask("Job Description: ");
  const hostCountry = await ask("Host Country (select or write new): ");
  const studentType = await ask("Student Type (select or write new): ");

  const id = uuidv4();
  const subject = `${baseURI}Job_Vacancy/${id}`;

  const rdf = {
    "@id": subject,
    "@type": [`${baseURI}Job_Vacancy`],
    [`${baseURI}title`]: { "@value": title },
    [`${baseURI}description`]: { "@value": description },
    [`${baseURI}hostCountry`]: {
      "@id": `${baseURI}Country/${encodeURIComponent(hostCountry)}`
    },
    [`${baseURI}studentType`]: {
      "@id": `${baseURI}StudentType/${encodeURIComponent(studentType)}`
    },
    [`${baseURI}uuid`]: { "@value": id }
  };

  const fileName = `${outputDir}/job_${id}.json`;
  fs.writeFileSync(fileName, JSON.stringify(rdf, null, 2));
  console.log(`✅ RDF JSON saved to: ${fileName}`);
  rl.close();
}

main();

