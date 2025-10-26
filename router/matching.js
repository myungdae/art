"use strict";

const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const mailer = require("../utils/mailer");

/* ---------- Helper Functions ---------- */

function toArray(v) {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

/**
 * Calculate matching score between Job Vacancy and Job Seeker
 * IMPROVED: Works with actual RDF data structure
 * @param {Object} jobVacancy - Job vacancy document
 * @param {Object} jobSeeker - Job seeker document
 * @returns {Object} - { score, matches, mismatches }
 */
function calculateMatchScore(jobVacancy, jobSeeker) {
  let score = 0;
  const matches = [];
  const mismatches = [];

  // 1. Location Match (40 points - INCREASED from 30)
  const jobLocation = (jobVacancy.jobLocation || jobVacancy.location || "").toLowerCase();
  const preferredLocations = toArray(jobSeeker.preferredWorkLocation || jobSeeker.Preferred_Work_Location)
    .map(loc => (loc || "").toLowerCase());
  
  if (jobLocation && preferredLocations.length > 0) {
    // Parse preferred locations (comma-separated)
    const allSeekerLocs = [];
    preferredLocations.forEach(loc => {
      loc.split(',').forEach(l => allSeekerLocs.push(l.trim()));
    });
    
    // Check if any preferred location matches
    const locationMatch = allSeekerLocs.some(sl => {
      // Direct match
      if (sl.includes(jobLocation) || jobLocation.includes(sl)) return true;
      
      // Country-level match (Seoul is in South Korea)
      if (sl.includes('south korea') || sl.includes('korea')) {
        if (jobLocation.includes('seoul') || jobLocation.includes('busan') || 
            jobLocation.includes('incheon') || jobLocation.includes('korea')) {
          return true;
        }
      }
      if (sl.includes('japan')) {
        if (jobLocation.includes('tokyo') || jobLocation.includes('osaka') || 
            jobLocation.includes('kyoto') || jobLocation.includes('japan')) {
          return true;
        }
      }
      if (sl.includes('china')) {
        if (jobLocation.includes('beijing') || jobLocation.includes('shanghai') || 
            jobLocation.includes('guangzhou') || jobLocation.includes('china')) {
          return true;
        }
      }
      if (sl.includes('taiwan')) {
        if (jobLocation.includes('taipei') || jobLocation.includes('kaohsiung') || 
            jobLocation.includes('taiwan')) {
          return true;
        }
      }
      
      return false;
    });
    
    if (locationMatch) {
      score += 40;
      matches.push({ field: "Location", value: jobLocation });
    } else {
      mismatches.push({ field: "Location", wanted: jobLocation, have: preferredLocations.join(", ") });
    }
  }

  // 2. Teaching Area Match (25 points - OPTIONAL, reduced from 30)
  const jobAreas = toArray(jobVacancy.teachingArea).map(a => (a || "").toLowerCase());
  const seekerAreas = toArray(jobSeeker.teachingArea).map(a => (a || "").toLowerCase());
  
  if (jobAreas.length > 0) {
    if (seekerAreas.length > 0) {
      const areaMatches = jobAreas.filter(ja => seekerAreas.some(sa => sa === ja || sa.includes(ja) || ja.includes(sa)));
      if (areaMatches.length > 0) {
        const areaScore = Math.min((areaMatches.length / jobAreas.length) * 25, 25);
        score += areaScore;
        matches.push({ field: "Teaching Areas", value: areaMatches.join(", ") });
      } else {
        mismatches.push({ field: "Teaching Areas", wanted: jobAreas.join(", "), have: seekerAreas.join(", ") });
      }
    }
    // If seeker has no teaching area specified, give partial credit (10 points)
    else {
      score += 10;
      matches.push({ field: "Teaching Areas", value: "Open to all areas" });
    }
  }

  // 3. Student Type Match (15 points - OPTIONAL, reduced from 20)
  const jobStudentType = (jobVacancy.studentType || "").toLowerCase();
  const seekerStudentType = (jobSeeker.studentType || "").toLowerCase();
  
  if (jobStudentType) {
    if (seekerStudentType && jobStudentType === seekerStudentType) {
      score += 15;
      matches.push({ field: "Student Type", value: jobStudentType });
    } else if (seekerStudentType) {
      mismatches.push({ field: "Student Type", wanted: jobStudentType, have: seekerStudentType });
    }
    // If seeker has no student type preference, give partial credit (8 points)
    else {
      score += 8;
      matches.push({ field: "Student Type", value: "Open to all levels" });
    }
  }

  // 4. Language Match (15 points - INCREASED from 10)
  const jobLangs = toArray(jobVacancy.languages || jobVacancy.language).map(l => (l || "").toLowerCase());
  const seekerLangs = toArray(jobSeeker.languageSpoken || jobSeeker.languages || jobSeeker.language).map(l => (l || "").toLowerCase());
  
  if (seekerLangs.length > 0) {
    // Check for English proficiency
    const hasEnglish = seekerLangs.some(l => l.includes('english'));
    if (hasEnglish) {
      score += 15;
      matches.push({ field: "Languages", value: "English" });
    }
    // If job requires specific languages
    else if (jobLangs.length > 0) {
      const langMatches = jobLangs.filter(jl => seekerLangs.some(sl => sl === jl || sl.includes(jl) || jl.includes(sl)));
      if (langMatches.length > 0) {
        const langScore = Math.min((langMatches.length / jobLangs.length) * 15, 15);
        score += langScore;
        matches.push({ field: "Languages", value: langMatches.join(", ") });
      }
    }
  }

  // 5. Native English Speaker Bonus (5 points)
  const seekerNationality = (jobSeeker.nationality || jobSeeker.Nationality || "").toLowerCase();
  
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

/**
 * Send email notifications for high-quality matches
 * @param {Object} source - Job Vacancy or Job Seeker
 * @param {Array} matches - Array of match results
 * @param {string} type - 'candidate' or 'job'
 */
async function sendMatchNotifications(source, matches, type) {
  try {
    const baseUrl = process.env.Server_Url || 'http://localhost:8608';
    
    if (type === 'candidate') {
      // Notify job seekers about matching vacancy
      for (const match of matches) {
        if (!match.email) continue;
        
        const jobVacancyUrl = `${baseUrl}/rdf-resource/Job_Vacancy/${source._id}`;
        const subject = `🎯 High-Quality Job Match Found: ${source._label || source.title}`;
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #10b981;">🎯 Great News! We Found a Perfect Job Match for You!</h2>
            <p>Dear ${match.title || 'Job Seeker'},</p>
            <p>Our AI matching system has found a <strong>high-quality job opportunity</strong> that matches your profile with a <strong>${match.percentage}% compatibility score</strong>!</p>
            
            <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #065f46;">Job Opportunity</h3>
              <p><strong>Position:</strong> ${source._label || source.title}</p>
              <p><strong>Location:</strong> ${source.jobLocation || source.location || 'Not specified'}</p>
              <p><strong>Company:</strong> ${source.companyName || source.schoolName || 'Not specified'}</p>
              <p><strong>Student Type:</strong> ${source.studentType || 'Not specified'}</p>
            </div>
            
            <div style="background: #fff; border: 1px solid #d1fae5; padding: 15px; margin: 20px 0;">
              <h3 style="color: #10b981; margin-top: 0;">✅ Matching Qualifications</h3>
              <ul style="padding-left: 20px;">
                ${match.matches.map(m => `<li><strong>${m.field}:</strong> ${m.value}</li>`).join('')}
              </ul>
            </div>
            
            <p style="text-align: center; margin: 30px 0;">
              <a href="${jobVacancyUrl}" style="background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">View Job Details</a>
            </p>
            
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 15px;">
              This is an automated notification from ESL Plus AI Matching System. This job was matched based on your profile preferences and qualifications.
            </p>
          </div>
        `;
        
        await mailer.send({ to: match.email, subject, html });
        console.log(`✅ Match notification sent to ${match.email} (${match.percentage}% match)`);
      }
    } else if (type === 'job') {
      // Notify employers about matching candidates
      const employerEmail = source.contactEmail || source.email;
      if (!employerEmail) return;
      
      const jobSeekerUrl = `${baseUrl}/rdf-resource/Job_Seeker/${source._id}`;
      const subject = `🎯 ${matches.length} High-Quality Candidate${matches.length > 1 ? 's' : ''} Found for ${source._label || source.title}`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #10b981;">🎯 Excellent News! We Found Perfect Candidates for Your Position!</h2>
          <p>Dear Employer,</p>
          <p>Our AI matching system has found <strong>${matches.length} highly qualified candidate${matches.length > 1 ? 's' : ''}</strong> for your job posting:</p>
          
          <div style="background: #f9fafb; border: 1px solid #e5e7eb; padding: 15px; margin: 20px 0;">
            <p><strong>Position:</strong> ${source._label || source.title}</p>
            <p><strong>Location:</strong> ${source.jobLocation || source.location}</p>
          </div>
          
          <h3 style="color: #065f46;">Top Matched Candidates</h3>
          ${matches.slice(0, 3).map(match => `
            <div style="background: #fff; border: 1px solid #d1fae5; padding: 15px; margin: 15px 0;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <h4 style="margin: 0; color: #065f46;">${match.title || 'Candidate'}</h4>
                <span style="background: #10b981; color: white; padding: 5px 12px; border-radius: 20px; font-weight: bold;">${match.percentage}%</span>
              </div>
              <p><strong>Nationality:</strong> ${match.nationality || 'Not specified'}</p>
              <p><strong>Languages:</strong> ${match.languages || 'Not specified'}</p>
              <div style="margin-top: 10px;">
                <strong style="color: #10b981;">✅ Matching Points:</strong>
                <ul style="margin: 5px 0; padding-left: 20px;">
                  ${match.matches.slice(0, 3).map(m => `<li>${m.field}: ${m.value}</li>`).join('')}
                </ul>
              </div>
            </div>
          `).join('')}
          
          <p style="text-align: center; margin: 30px 0;">
            <a href="${baseUrl}/matching/candidates/${source._id}" style="background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">View All Matched Candidates</a>
          </p>
          
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 15px;">
            This is an automated notification from ESL Plus AI Matching System. These candidates were matched based on your job requirements.
          </p>
        </div>
      `;
      
      await mailer.send({ to: employerEmail, subject, html });
      console.log(`✅ Match notification sent to employer ${employerEmail} (${matches.length} candidates)`);
    }
  } catch (err) {
    console.error('Error sending match notifications:', err.message);
    throw err;
  }
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

    // Filter: only show matches with score >= 30 (improved threshold)
    const relevantMatches = matchResults.filter(m => m.score >= 30);
    
    // Send email notifications for high-quality matches (score >= 70)
    const highQualityMatches = relevantMatches.filter(m => m.score >= 70);
    if (highQualityMatches.length > 0) {
      // Send emails asynchronously (don't wait)
      sendMatchNotifications(jobVacancy, highQualityMatches, 'candidate').catch(err => {
        console.error('Email notification error:', err.message);
      });
    }

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

    // Filter: only show matches with score >= 30 (improved threshold)
    const relevantMatches = matchResults.filter(m => m.score >= 30);
    
    // Send email notifications for high-quality matches (score >= 70)
    const highQualityMatches = relevantMatches.filter(m => m.score >= 70);
    if (highQualityMatches.length > 0) {
      // Send emails asynchronously (don't wait)
      sendMatchNotifications(jobSeeker, highQualityMatches, 'job').catch(err => {
        console.error('Email notification error:', err.message);
      });
    }

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
