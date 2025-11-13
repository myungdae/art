const express = require("express");
const router = express.Router();

const commonLocals = {
  siteName: "ESL PLUS",
  companyName: "Linked Data Center Co., Ltd.",
  supportEmail: "myungdae.cho@gmail.com",
  supportPhone: "+82-10-9744-5425",
  dpoName: "Myungdae Cho",
  lastUpdated: "2025-08-24",
};

router.get("/terms", (req, res) => res.render("policy/terms", commonLocals));
router.get("/privacy", (req, res) =>
  res.render("policy/privacy", commonLocals)
);
router.get("/refund", (req, res) => res.render("policy/refund", commonLocals));

module.exports = router;
