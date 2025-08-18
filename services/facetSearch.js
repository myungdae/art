// services/facetSearch.js
const mongoose = require('mongoose');

// facet별 컬렉션/필드 매핑 (실제 스키마에 맞게 나중에 조정 가능)
const MAP = {
  Job_Vacancies: {
    coll: 'job_vacancies',
    fields: { title: ['title','position','name'], desc: ['description','summary'], image: ['image','logo','thumbnail'] }
  },
  Job_Seekers: {
    coll: 'job_seekers',
    fields: { title: ['name','fullName','title'], desc: ['bio','summary','skills'], image: ['photo','avatar','image'] }
  },
  Online_Tutors: {
    coll: 'online_tutors',
    fields: { title: ['name','title'], desc: ['bio','summary','subjects'], image: ['photo','avatar','image'] }
  },
};

const _metaCache = new Map();

async function getCollMeta(name) {
  const key = `meta:${name}`;
  if (_metaCache.has(key)) return _metaCache.get(key);
  const db = mongoose.connection.db;
  const exists = !!(await db.listCollections({ name }).next());
  let hasText = false;
  if (exists) {
    try {
      const info = await db.collection(name).indexInformation({ full: true });
      hasText = Array.isArray(info)
        ? info.some(ix => ix.key && Object.values(ix.key).some(v => v === 'text'))
        : Object.values(info || {}).some(ix => ix.key && Object.values(ix.key).some(v => v === 'text'));
    } catch (_) {}
  }
  const meta = { exists, hasText };
  _metaCache.set(key, meta);
  return meta;
}

function pickFirst(obj, keys = []) {
  for (const k of keys) if (obj && obj[k] != null) return obj[k];
  return '';
}

function normalize(doc, cfg) {
  return {
    _raw: doc,
    title: String(pickFirst(doc, cfg.fields.title) || 'Untitled'),
    desc: String(pickFirst(doc, cfg.fields.desc) || ''),
    image: String(pickFirst(doc, cfg.fields.image) || ''),
    link: doc && (doc._id || doc.id) ? String(doc._id || doc.id) : '',
  };
}

function buildRegexQuery(q, fields) {
  const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const unique = Array.from(new Set([...(fields.title||[]), ...(fields.desc||[])]));
  if (unique.length === 0) return {};
  return { $or: unique.map(f => ({ [f]: re })) };
}

async function searchFacet(facet, q = '', page = 1, limit = 20) {
  const cfg = MAP[facet];
  if (!cfg) return { items: [], total: 0 };

  const db = mongoose.connection.db;
  const { coll } = cfg;
  const meta = await getCollMeta(coll);
  if (!meta.exists) return { items: [], total: 0 };

  const c = db.collection(coll);

  let query = {};
  let projection = {};
  let sort = { updatedAt: -1, createdAt: -1, _id: -1 };

  if (q) {
    if (meta.hasText) {
      query = { $text: { $search: q } };
      projection = { score: { $meta: 'textScore' } };
      sort = { score: { $meta: 'textScore' } };
    } else {
      query = buildRegexQuery(q, cfg.fields);
    }
  }

  let total = 0;
  try { total = await c.countDocuments(query); } catch (_) {}

  const skip = Math.max(0, (Number(page)||1)-1) * Math.max(1, Number(limit)||20);

  let rows = [];
  try {
    rows = await c.find(query, { projection })
      .sort(sort).skip(skip).limit(Math.max(1, Number(limit)||20)).toArray();
  } catch (e) {
    console.error('[facetSearch] query failed', e);
    rows = [];
  }

  const items = rows.map(d => normalize(d, cfg));
  return { items, total, page: Number(page)||1, limit: Number(limit)||20 };
}

module.exports = { searchFacet };
