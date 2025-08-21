// middleware/validateObjectId.js
const mongoose = require('mongoose');

module.exports = function validateObjectId(paramKey = 'id') {
  return (req, res, next, value) => {
    if (!mongoose.isValidObjectId(value)) {
      console.warn(
        '[INVALID OBJECTID]',
        req.method,
        req.originalUrl,
        `${paramKey}=`, value,
        '| referer=', req.get('referer') || '-',
        '| ip=', req.ip,
        '| ua=', req.get('user-agent') || '-'
      );
      return res.status(404).send('Invalid ID');
    }
    next();
  };
};
