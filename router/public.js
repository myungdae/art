// router/public.js — Art Platform
"use strict";

const express = require("express");
const router  = express.Router();

// /pricing 페이지 (있으면 렌더, 없으면 next)
router.get("/pricing", (req, res, next) => {
  res.render("pricing", { title: "ART+ Pricing" });
});

module.exports = router;
