// router/application.js
'use strict';

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const Application = require('../model/application');
const JobVacancy = require('../model/jobVacancy');
const User = require('../model/user');

const validateObjectId = require('../middleware/validateObjectId');
const { requireLogin, requireRole } = require('../middleware/auth');

router.param('id', validateObjectId('id'));

/* -------------------- 지원서 제출 폼 (구직자용) -------------------- */
router.get(
  '/job-vacancies/:id/apply',
  requireLogin,
  requireRole('Job_Seeker'),
  async (req, res) => {
    try {
      const { id } = req.params;
      
      // 채용공고 조회
      let jobVacancy = await JobVacancy.findById(id).lean();
      
      // Job_Vacancies_RDF에서도 찾기
      if (!jobVacancy) {
        const db = mongoose.connection.db;
        jobVacancy = await db.collection('Job_Vacancies_RDF').findOne({
          _id: new mongoose.Types.ObjectId(id)
        });
      }
      
      if (!jobVacancy) {
        req.flash?.('error', 'Job vacancy not found');
        return res.redirect('/job-vacancies');
      }
      
      // 이미 지원했는지 확인
      const existingApplication = await Application.findOne({
        applicant: req.session.user._id,
        jobVacancy: id
      });
      
      if (existingApplication) {
        req.flash?.('error', 'You have already applied to this job');
        return res.redirect(`/rdf-resource/Job_Vacancies/${id}`);
      }
      
      res.render('application/apply', {
        jobVacancy,
        values: {},
        errors: {}
      });
      
    } catch (err) {
      console.error('[Application APPLY] error:', err);
      return res.status(500).render('error', {
        message: 'Failed to load application form',
        error: err
      });
    }
  }
);

/* -------------------- 지원서 제출 처리 -------------------- */
router.post(
  '/job-vacancies/:id/apply',
  requireLogin,
  requireRole('Job_Seeker'),
  async (req, res) => {
    try {
      const { id } = req.params;
      
      // 채용공고 조회
      let jobVacancy = await JobVacancy.findById(id).lean();
      
      // Job_Vacancies_RDF에서도 찾기
      if (!jobVacancy) {
        const db = mongoose.connection.db;
        jobVacancy = await db.collection('Job_Vacancies_RDF').findOne({
          _id: new mongoose.Types.ObjectId(id)
        });
      }
      
      if (!jobVacancy) {
        req.flash?.('error', 'Job vacancy not found');
        return res.redirect('/job-vacancies');
      }
      
      // 중복 지원 체크
      const existingApplication = await Application.findOne({
        applicant: req.session.user._id,
        jobVacancy: id
      });
      
      if (existingApplication) {
        req.flash?.('error', 'You have already applied to this job');
        return res.redirect(`/rdf-resource/Job_Vacancies/${id}`);
      }
      
      // 사용자 정보 조회
      const user = await User.findById(req.session.user._id).lean();
      
      // 검증
      const errors = {};
      if (!req.body.coverLetter || req.body.coverLetter.trim() === '') {
        errors.coverLetter = 'Cover letter is required';
      }
      
      if (Object.keys(errors).length > 0) {
        return res.status(422).render('application/apply', {
          jobVacancy,
          values: req.body,
          errors
        });
      }
      
      // 지원서 생성
      const application = new Application({
        applicant: req.session.user._id,
        jobVacancy: id,
        applicantName: user.name || user.email,
        applicantEmail: user.email,
        jobTitle: jobVacancy.title || jobVacancy._label,
        companyName: jobVacancy.companyName || 'N/A',
        coverLetter: req.body.coverLetter,
        resume: req.body.resume || '',
        status: 'pending',
        appliedAt: new Date()
      });
      
      await application.save();
      
      req.flash?.('success', 'Application submitted successfully!');
      return res.redirect('/applications/mine');
      
    } catch (err) {
      console.error('[Application SUBMIT] error:', err);
      
      // 중복 키 에러 처리
      if (err.code === 11000) {
        req.flash?.('error', 'You have already applied to this job');
        return res.redirect(`/rdf-resource/Job_Vacancies/${req.params.id}`);
      }
      
      return res.status(500).render('error', {
        message: 'Failed to submit application',
        error: err
      });
    }
  }
);

/* -------------------- 내 지원 내역 (구직자용) -------------------- */
router.get(
  '/applications/mine',
  requireLogin,
  requireRole('Job_Seeker'),
  async (req, res) => {
    try {
      const applications = await Application.find({
        applicant: req.session.user._id
      })
        .populate('jobVacancy')
        .sort({ appliedAt: -1 })
        .lean();
      
      res.render('application/mine', {
        applications
      });
      
    } catch (err) {
      console.error('[Application MINE] error:', err);
      return res.status(500).render('error', {
        message: 'Failed to load your applications',
        error: err
      });
    }
  }
);

/* -------------------- 받은 지원서 목록 (기업용) -------------------- */
router.get(
  '/applications/received',
  requireLogin,
  requireRole('Employer'),
  async (req, res) => {
    try {
      // 내가 등록한 채용공고 ID 목록
      const myJobVacancies = await JobVacancy.find({
        user: req.session.user._id
      }).select('_id').lean();
      
      const jobVacancyIds = myJobVacancies.map(j => j._id);
      
      // 해당 공고들에 대한 지원서 조회
      const applications = await Application.find({
        jobVacancy: { $in: jobVacancyIds }
      })
        .populate('jobVacancy')
        .populate('applicant', 'name email')
        .sort({ appliedAt: -1 })
        .lean();
      
      res.render('application/received', {
        applications
      });
      
    } catch (err) {
      console.error('[Application RECEIVED] error:', err);
      return res.status(500).render('error', {
        message: 'Failed to load received applications',
        error: err
      });
    }
  }
);

/* -------------------- 지원서 상세 조회 -------------------- */
router.get(
  '/applications/:id',
  requireLogin,
  async (req, res) => {
    try {
      const { id } = req.params;
      
      const application = await Application.findById(id)
        .populate('jobVacancy')
        .populate('applicant', 'name email role')
        .lean();
      
      if (!application) {
        req.flash?.('error', 'Application not found');
        return res.redirect('/');
      }
      
      // 권한 확인: 지원자 본인 또는 공고 작성자
      const isApplicant = application.applicant._id.toString() === req.session.user._id.toString();
      
      let isEmployer = false;
      if (application.jobVacancy && application.jobVacancy.user) {
        isEmployer = application.jobVacancy.user.toString() === req.session.user._id.toString();
      }
      
      const isAdmin = req.session?.isAdmin || false;
      
      if (!isApplicant && !isEmployer && !isAdmin) {
        req.flash?.('error', 'You do not have permission to view this application');
        return res.redirect('/');
      }
      
      res.render('application/detail', {
        application,
        isApplicant,
        isEmployer
      });
      
    } catch (err) {
      console.error('[Application DETAIL] error:', err);
      return res.status(500).render('error', {
        message: 'Failed to load application',
        error: err
      });
    }
  }
);

/* -------------------- 지원서 상태 변경 (기업용) -------------------- */
router.post(
  '/applications/:id/status',
  requireLogin,
  requireRole('Employer'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { status, employerNote } = req.body;
      
      const application = await Application.findById(id).populate('jobVacancy');
      
      if (!application) {
        req.flash?.('error', 'Application not found');
        return res.redirect('/applications/received');
      }
      
      // 권한 확인: 공고 작성자인지
      if (application.jobVacancy.user.toString() !== req.session.user._id.toString()) {
        req.flash?.('error', 'You do not have permission to modify this application');
        return res.redirect('/applications/received');
      }
      
      // 유효한 상태인지 확인
      const validStatuses = ['pending', 'reviewed', 'accepted', 'rejected'];
      if (!validStatuses.includes(status)) {
        req.flash?.('error', 'Invalid status');
        return res.redirect(`/applications/${id}`);
      }
      
      application.status = status;
      if (employerNote) {
        application.employerNote = employerNote;
      }
      
      await application.save();
      
      req.flash?.('success', 'Application status updated');
      return res.redirect(`/applications/${id}`);
      
    } catch (err) {
      console.error('[Application STATUS] error:', err);
      return res.status(500).send('Failed to update application status');
    }
  }
);

/* -------------------- 지원 취소 (구직자용) -------------------- */
router.post(
  '/applications/:id/withdraw',
  requireLogin,
  requireRole('Job_Seeker'),
  async (req, res) => {
    try {
      const { id } = req.params;
      
      const application = await Application.findById(id);
      
      if (!application) {
        req.flash?.('error', 'Application not found');
        return res.redirect('/applications/mine');
      }
      
      // 권한 확인: 지원자 본인인지
      if (application.applicant.toString() !== req.session.user._id.toString()) {
        req.flash?.('error', 'You do not have permission to withdraw this application');
        return res.redirect('/applications/mine');
      }
      
      // 이미 처리된 지원은 취소 불가
      if (application.status === 'accepted' || application.status === 'rejected') {
        req.flash?.('error', 'Cannot withdraw an application that has been processed');
        return res.redirect('/applications/mine');
      }
      
      application.status = 'withdrawn';
      await application.save();
      
      req.flash?.('success', 'Application withdrawn');
      return res.redirect('/applications/mine');
      
    } catch (err) {
      console.error('[Application WITHDRAW] error:', err);
      return res.status(500).send('Failed to withdraw application');
    }
  }
);

module.exports = router;
