const express = require('express');
const router = express.Router();
const Job = require('../model/job');
// const countries = require('../data/countries.json');
const auth = require('../middleware/auth');

router.get('/create', auth, (req, res) => {
  res.render('job/create', { countries });
});

router.post('/create', auth, async (req, res) => {
  try {
    const job = new Job({
      employerEmail: req.body.employerEmail,
      cellphone: req.body.cellphone,
      skypeID: req.body.skypeID,
      hostCountry: req.body.hostCountry,
      teachingArea: req.body.teachingArea,
      studentType: req.body.studentType,
      purchaseOption: req.body.purchaseOption,
      resumeDBAccess: req.body.resumeDBAccess === 'on',
      paid: false,
      createdBy: req.session.user.email
    });

    await job.save();
    res.redirect('/job/list');
  } catch (err) {
    console.error('❌ Error saving job:', err);
    res.status(500).send('Server error');
  }
});

module.exports = router;
