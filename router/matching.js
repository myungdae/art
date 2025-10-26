"use strict";

const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

/* ---------- Helper Functions ---------- */

function toArray(v) {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

/**
 * Calculate matching score between Job Vacancy and Job Seeker
 * @param {Object} jobVacancy - Job vacancy document
 * @param {Object} jobSeeker - Job seeker document
 * @returns {Object} - { score, matches, mismatches }
 */
function calculateMatchScore(jobVacancy, jobSeeker) {
  let score = 0;
  const matches = [];
  const mismatches = [];

  // 1. Location Match (30 points)
  const jobLocation = (jobVacancy.jobLocation || jobVacancy.location || "").toLowerCase();
  const preferredLocations = toArray(jobSeeker.preferredWorkLocation || jobSeeker.Preferred_Work_Location)
    .map(loc => (loc || "").toLowerCase());
  
  if (jobLocation && preferredLocations.some(loc => loc.includes(jobLocation) || jobLocation.includes(loc))) {
    score += 30;
    matches.push({ field: "Location", value: jobLocation });
  } else if (jobLocation && preferredLocations.length > 0) {
    mismatches.push({ field: "Location", wanted: jobLocation, have: preferredLocations.join(", ") });
  }

  // 2. Teaching Area Match (30 points)
  const jobAreas = toArray(jobVacancy.teachingArea).map(a => (a || "").toLowerCase());
  const seekerAreas = toArray(jobSeeker.teachingArea).map(a => (a || "").toLowerCase());
  
  if (jobAreas.length > 0 && seekerAreas.length > 0) {
    const areaMatches = jobAreas.filter(ja => seekerAreas.some(sa => sa === ja || sa.includes(ja) || ja.includes(sa)));
    if (areaMatches.length > 0) {
      const areaScore = Math.min((areaMatches.length / jobAreas.length) * 30, 30);
      score += areaScore;
      matches.push({ field: "Teaching Areas", value: areaMatches.join(", ") });
    } else {
      mismatches.push({ field: "Teaching Areas", wanted: jobAreas.join(", "), have: seekerAreas.join(", ") });
    }
  }

  // 3. Student Type Match (20 points)
  const jobStudentType = (jobVacancy.studentType || "").toLowerCase();
  const seekerStudentType = (jobSeeker.studentType || "").toLowerCase();
  
  if (jobStudentType && seekerStudentType && jobStudentType === seekerStudentType) {
    score += 20;
    matches.push({ field: "Student Type", value: jobStudentType });
  } else if (jobStudentType && seekerStudentType) {
    mismatches.push({ field: "Student Type", wanted: jobStudentType, have: seekerStudentType });
  }

  // 4. Language Match (10 points)
  const jobLangs = toArray(jobVacancy.languages || jobVacancy.language).map(l => (l || "").toLowerCase());
  const seekerLangs = toArray(jobSeeker.languages || jobSeeker.language).map(l => (l || "").toLowerCase());
  
  if (jobLangs.length > 0 && seekerLangs.length > 0) {
    const langMatches = jobLangs.filter(jl => seekerLangs.some(sl => sl === jl || sl.includes(jl) || jl.includes(sl)));
    if (langMatches.length > 0) {
      const langScore = Math.min((langMatches.length / jobLangs.length) * 10, 10);
      score += langScore;
      matches.push({ field: "Languages", value: langMatches.join(", ") });
    }
  }

  // 5. Nationality/Country Preference (10 points bonus)
  const jobCountry = (jobVacancy.country || "").toLowerCase();
  const seekerNationality = (jobSeeker.nationality || jobSeeker.Nationality || "").toLowerCase();
  
  // Some employers prefer native English speakers
  if (seekerNationality && ["united states", "united kingdom", "canada", "australia", "new zealand", "ireland"].includes(seekerNationality)) {
    score += 5;
    matches.push({ field: "Native English Speaker", value: seekerNationality });
  }

  return {
    score: Math.round(score),
    matches,
    mismatches,
    percentage: Math.min(Math.round(score), 100)
  };
}

/* ---------- Routes ---------- */

/**
 * Find matching Job Seekers for a Job Vacancy
 * GET /matching/candidates/:jobVacancyId
 */
router.get("/candidates/:jobVacancyId", async (req, res, next) => {
  try {
    const jobVacancyId = req.params.jobVacancyId;
    
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(jobVacancyId)) {
      return res.status(400).send("Invalid Job Vacancy ID");
    }

    const db = mongoose.connection.db;
    const _id = new mongoose.Types.ObjectId(jobVacancyId);

    // Get Job Vacancy
    let jobVacancy = await db.collection("Job_Vacancies_RDF").findOne({ _id });
    if (!jobVacancy) {
      jobVacancy = await db.collection("Job_Vacancies").findOne({ _id });
    }
    if (!jobVacancy) {
      return res.status(404).send("Job Vacancy not found");
    }

    // Get all Job Seekers
    let jobSeekers = await db.collection("Job_Seekers_RDF").find({}).toArray();
    if (jobSeekers.length === 0) {
      jobSeekers = await db.collection("Job_Seekers").find({}).toArray();
    }

    // Calculate match scores
    const matchResults = jobSeekers.map(seeker => {
      const matchData = calculateMatchScore(jobVacancy, seeker);
      return {
        seeker,
        ...matchData,
        id: seeker._id.toString(),
        title: seeker._label || seeker.title || "Untitled",
        email: seeker.email || "",
        nationality: seeker.nationality || seeker.Nationality || "",
        major: seeker.major || seeker.Major || "",
        languages: toArray(seeker.languageSpoken || seeker.languages || seeker.language).join(", ")
      };
    });

    // Sort by score (descending)
    matchResults.sort((a, b) => b.score - a.score);

    // Filter: only show matches with score >= 20
    const relevantMatches = matchResults.filter(m => m.score >= 20);

    // Render results page
    res.render("matching/candidates", {
      jobVacancy: {
        id: jobVacancy._id.toString(),
        title: jobVacancy._label || jobVacancy.title || "Untitled",
        location: jobVacancy.jobLocation || jobVacancy.location || "",
        teachingAreas: toArray(jobVacancy.teachingArea).join(", "),
        studentType: jobVacancy.studentType || ""
      },
      matches: relevantMatches,
      totalCandidates: jobSeekers.length,
      relevantCandidates: relevantMatches.length
    });

  } catch (err) {
    console.error("GET /matching/candidates/:jobVacancyId error:", err);
    return next(err);
  }
});

/**
 * Find matching Job Vacancies for a Job Seeker
 * GET /matching/jobs/:jobSeekerId
 */
router.get("/jobs/:jobSeekerId", async (req, res, next) => {
  try {
    const jobSeekerId = req.params.jobSeekerId;
    
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(jobSeekerId)) {
      return res.status(400).send("Invalid Job Seeker ID");
    }

    const db = mongoose.connection.db;
    const _id = new mongoose.Types.ObjectId(jobSeekerId);

    // Get Job Seeker
    let jobSeeker = await db.collection("Job_Seekers_RDF").findOne({ _id });
    if (!jobSeeker) {
      jobSeeker = await db.collection("Job_Seekers").findOne({ _id });
    }
    if (!jobSeeker) {
      return res.status(404).send("Job Seeker not found");
    }

    // Get all Job Vacancies
    let jobVacancies = await db.collection("Job_Vacancies_RDF").find({}).toArray();
    if (jobVacancies.length === 0) {
      jobVacancies = await db.collection("Job_Vacancies").find({}).toArray();
    }

    // Calculate match scores
    const matchResults = jobVacancies.map(vacancy => {
      const matchData = calculateMatchScore(vacancy, jobSeeker);
      return {
        vacancy,
        ...matchData,
        id: vacancy._id.toString(),
        title: vacancy._label || vacancy.title || "Untitled",
        location: vacancy.jobLocation || vacancy.location || "",
        companyName: vacancy.companyName || vacancy.schoolName || "",
        teachingAreas: toArray(vacancy.teachingArea).join(", "),
        studentType: vacancy.studentType || "",
        datePosted: vacancy.datePosted || vacancy.updatedAt || vacancy.createdAt
      };
    });

    // Sort by score (descending)
    matchResults.sort((a, b) => b.score - a.score);

    // Filter: only show matches with score >= 20
    const relevantMatches = matchResults.filter(m => m.score >= 20);

    // Render results page
    res.render("matching/jobs", {
      jobSeeker: {
        id: jobSeeker._id.toString(),
        title: jobSeeker._label || jobSeeker.title || "Untitled",
        nationality: jobSeeker.nationality || jobSeeker.Nationality || "",
        preferredLocations: toArray(jobSeeker.preferredWorkLocation || jobSeeker.Preferred_Work_Location).join(", "),
        major: jobSeeker.major || jobSeeker.Major || "",
        languages: toArray(jobSeeker.languageSpoken || jobSeeker.languages || jobSeeker.language).join(", ")
      },
      matches: relevantMatches,
      totalJobs: jobVacancies.length,
      relevantJobs: relevantMatches.length
    });

  } catch (err) {
    console.error("GET /matching/jobs/:jobSeekerId error:", err);
    return next(err);
  }
});

module.exports = router;
