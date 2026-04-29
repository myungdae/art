// router/index.js — Art Platform (GET / 는 homeRouter 에서 처리)
"use strict";

const express     = require("express");
const createError = require("http-errors");
const router      = express.Router();
const fs          = require("fs");

// /:id/:sub? — pages 디렉토리 내 pug 렌더 (필요 시)
router.get("/:id/:sub?", (req, res, next) => {
  if (req.params.id === "pages") {
    const sub = req.params.sub;
    if (
      !sub ||
      sub.indexOf("/") > -1 ||
      sub.indexOf("\\") > -1 ||
      !fs.existsSync("./pages/" + sub + ".pug")
    ) {
      return next(createError(404));
    }
    return res.render(sub);
  }
  next();
});

module.exports = router;
