const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

router.get('/:id', async (req, res) => {
  const id = req.params.id;
  const ttlFilePath = path.join(__dirname, `../public/rdf/${id}.ttl`);

  if (!fs.existsSync(ttlFilePath)) {
    return res.status(404).send('RDF file not found');
  }

  try {
    const ttlContent = fs.readFileSync(ttlFilePath, 'utf-8');

    // ✅ 간단한 key-value 파싱 (임시 방식)
    const lines = ttlContent.split('\n');
    const ttlData = {};
    for (const line of lines) {
      if (line.trim().startsWith('@') || line.trim().startsWith('res:')) continue;
      const match = line.trim().match(/^res:(.+?)\s+"(.+?)"[.;]?$/);
      if (match) {
        const key = match[1];
        const value = match[2];
        ttlData[key] = value;
      }
    }

    res.render('rdf/view', { ttlData });

  } catch (err) {
    console.error('Error reading TTL file:', err);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;
