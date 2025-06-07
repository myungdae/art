const express = require('express');
const router = express.Router();

/* GET home page. */
router.get('/:item', function(req, res, next) {
  let view = req.params.item;
  res.render('intro_'+view);
});
module.exports = router;
