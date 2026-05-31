// router/joseon-defense.js — 조선시대 국방 온톨로지 라우터 v2
"use strict";

const express = require("express");
const router  = express.Router();
const path    = require("path");
const fs      = require("fs");

/* ─────────────────────────────────────────────────────────────
   TTL 파서 & 인메모리 온톨로지 데이터베이스
   ───────────────────────────────────────────────────────────── */
function parseTTL(text) {
  const prefixes = {};
  const prefixRe = /@prefix\s+(\w*):\s+<([^>]+)>\s*\./g;
  let m;
  while ((m = prefixRe.exec(text)) !== null) prefixes[m[1]] = m[2];

  function expand(curie) {
    if (!curie) return curie;
    curie = curie.trim();
    if (curie.startsWith("<") && curie.endsWith(">")) return curie.slice(1,-1);
    const colon = curie.indexOf(":");
    if (colon > -1) {
      const pfx = curie.slice(0, colon);
      const local = curie.slice(colon+1);
      if (prefixes[pfx] !== undefined) return prefixes[pfx] + local;
    }
    return curie;
  }
  function shortId(uri) {
    if (!uri) return uri;
    return uri.split(/[#/]/).pop() || uri;
  }

  const cleaned = text.replace(/#[^\n]*/g, "").replace(/\s+/g, " ");
  const triples = [];
  // Split on '.' only when NOT inside a quoted string
  // This handles literals containing periods (e.g., dc:description "text. more text")
  function splitOnDot(str) {
    const parts = [];
    let buf = "";
    let inQuote = false;
    for (let i = 0; i < str.length; i++) {
      const c = str[i];
      if (c === '"' && (i === 0 || str[i-1] !== '\\')) inQuote = !inQuote;
      if (c === '.' && !inQuote) {
        parts.push(buf);
        buf = "";
      } else {
        buf += c;
      }
    }
    if (buf.trim()) parts.push(buf);
    return parts;
  }
  const lines = splitOnDot(cleaned);
  lines.forEach(block => {
    block = block.trim();
    if (!block) return;
    const stmts = block.split(";").map(s=>s.trim()).filter(Boolean);
    if (!stmts.length) return;
    const firstParts = stmts[0].match(/^(\S+)\s+(.+)$/);
    if (!firstParts) return;
    const subject = expand(firstParts[1]);
    const allPO = [firstParts[2].trim(), ...stmts.slice(1)];
    allPO.forEach(po => {
      po = po.trim();
      if (!po) return;
      const poMatch = po.match(/^(\S+)\s+(.+)$/);
      if (!poMatch) return;
      const pred = expand(poMatch[1]);
      let obj = poMatch[2].trim();
      const litLangM = obj.match(/^"(.*)"@(\w+)$/);
      if (litLangM) { obj = litLangM[1]; }
      else {
        const litTypeM = obj.match(/^"(.*?)"\^\^.+$/);
        if (litTypeM) { obj = litTypeM[1]; }
        else if (obj.startsWith('"') && obj.endsWith('"')) { obj = obj.slice(1,-1); }
        else if (obj.startsWith("<") && obj.endsWith(">")) { obj = obj.slice(1,-1); }
        else { obj = expand(obj); }
      }
      triples.push({ s: subject, p: pred, o: obj });
    });
  });

  const RDF_TYPE    = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
  const RDFS_LABEL  = "http://www.w3.org/2000/01/rdf-schema#label";
  const RDFS_SUB    = "http://www.w3.org/2000/01/rdf-schema#subClassOf";
  const SKOS_ALT    = "http://www.w3.org/2004/02/skos/core#altLabel";
  const DC_DESC     = "http://purl.org/dc/elements/1.1/description";
  const OWL_CLASS   = "http://www.w3.org/2002/07/owl#Class";
  const OWL_OBJPROP = "http://www.w3.org/2002/07/owl#ObjectProperty";
  const OWL_DATPROP = "http://www.w3.org/2002/07/owl#DatatypeProperty";
  const RDFS_DOMAIN = "http://www.w3.org/2000/01/rdf-schema#domain";
  const RDFS_RANGE  = "http://www.w3.org/2000/01/rdf-schema#range";
  const OWL_INVERSE = "http://www.w3.org/2002/07/owl#inverseOf";
  const JOS = "http://joseon-defense.eventpool.kr/ontology/";

  const classes   = {};
  const objProps  = {};
  const dataProps = {};
  const instances = {};

  triples.forEach(({ s, p, o }) => {
    if (p === RDF_TYPE) {
      if (o === OWL_CLASS)   { if (!classes[s])   classes[s]   = { uri:s, label:"", subClassOf:null }; }
      else if (o === OWL_OBJPROP) { if (!objProps[s]) objProps[s] = { uri:s, label:"", domain:null, range:null, inverseOf:null }; }
      else if (o === OWL_DATPROP) { if (!dataProps[s]) dataProps[s]= { uri:s, label:"", range:null }; }
      else if (o.startsWith(JOS)) {
        if (!instances[s]) instances[s] = { uri:s, type:o, typeId:shortId(o), label:"", altLabel:"", description:"", props:{}, rels:[] };
        else instances[s].type = o;
        instances[s].typeId = shortId(o);
      }
    }
  });

  triples.forEach(({ s, p, o }) => {
    if (p === RDFS_LABEL) {
      if (classes[s])   classes[s].label   = o;
      if (objProps[s])  objProps[s].label   = o;
      if (dataProps[s]) dataProps[s].label  = o;
      if (instances[s]) instances[s].label  = o;
    }
    if (p === DC_DESC   && instances[s]) instances[s].description = o;
    if (p === SKOS_ALT  && instances[s]) instances[s].altLabel    = o;
    if (p === RDFS_SUB  && classes[s])   classes[s].subClassOf    = o;
    if (p === RDFS_DOMAIN && objProps[s]) objProps[s].domain = o;
    if (p === RDFS_RANGE  && objProps[s]) objProps[s].range  = o;
    if (p === RDFS_RANGE  && dataProps[s]) dataProps[s].range= o;
    if (p === OWL_INVERSE && objProps[s]) objProps[s].inverseOf = o;

    if (instances[s]) {
      const predLocal = shortId(p);
      if (!o.startsWith("http://")) {
        if (!instances[s].props[predLocal]) instances[s].props[predLocal] = [];
        instances[s].props[predLocal].push(o);
      } else if (p !== RDF_TYPE && p !== RDFS_LABEL && p !== SKOS_ALT && p !== DC_DESC) {
        instances[s].rels.push({ pred:p, predLocal, obj:o, objId:shortId(o) });
      }
    }
  });

  return { classes, objProps, dataProps, instances, prefixes, triples };
}

/* ─────────────────────────────────────────────────────────────
   온톨로지 로드 (서버 시작 시 1회, 변경 시 재로드)
   ───────────────────────────────────────────────────────────── */
const TTL_PATH = path.join(__dirname, "..", "data", "joseon-defense.ttl");
const TTL_ALT  = "/home/user/uploaded_files/joseon_defense_static_ontology_v0_1.ttl";
let ONTO = null;
let TTL_MTIME = 0;

function loadOntology() {
  try {
    const stat = fs.statSync(TTL_PATH);
    if (ONTO && stat.mtimeMs === TTL_MTIME) return ONTO;
    const ttlText = fs.readFileSync(TTL_PATH, "utf8");
    ONTO = parseTTL(ttlText);
    TTL_MTIME = stat.mtimeMs;
    console.log(`[JD] 온톨로지 로드: 클래스 ${Object.keys(ONTO.classes).length}, 인스턴스 ${Object.keys(ONTO.instances).length}`);
  } catch(e) {
    if (!ONTO) ONTO = { classes:{}, objProps:{}, dataProps:{}, instances:{}, prefixes:{}, triples:[] };
  }
  return ONTO;
}

function ensureTTLCopied() {
  const dataDir = path.join(__dirname, "..", "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(TTL_PATH) && fs.existsSync(TTL_ALT)) {
    fs.copyFileSync(TTL_ALT, TTL_PATH);
  }
}
ensureTTLCopied();

/* ─────────────────────────────────────────────────────────────
   메타 & 헬퍼
   ───────────────────────────────────────────────────────────── */
const CLASS_META = {
  Person:               { icon:"👤", label:"인물",           tab:true  },
  Commander:            { icon:"👤", label:"지휘관",         tab:true  },
  JeollaByeongsa:       { icon:"🎖️", label:"전라병사",       tab:false },
  King:                 { icon:"👑", label:"국왕",           tab:true  },
  Fortress:             { icon:"🏯", label:"성곽",           tab:true  },
  Battle:               { icon:"⚔️", label:"전투/전쟁",      tab:true  },
  War:                  { icon:"🏳️", label:"전쟁",           tab:false },
  Campaign:             { icon:"🗺️", label:"원정/정벌",      tab:false },
  Invasion:             { icon:"⚡", label:"침입/침략",      tab:false },
  DefenseOperation:     { icon:"🛡️", label:"방어작전",       tab:false },
  MilitaryEvent:        { icon:"📜", label:"군사사건",        tab:true  },
  MilitaryInnovation:   { icon:"⚙️", label:"군사기술개발",   tab:false },
  DisasterRelief:       { icon:"🤝", label:"대민지원",        tab:false },
  WeaponSystem:         { icon:"🗡️", label:"무기체계",        tab:true  },
  Cannon:               { icon:"💥", label:"총통/화포",       tab:false },
  RocketWeapon:         { icon:"🚀", label:"로켓무기",        tab:false },
  Singijeon:            { icon:"🚀", label:"신기전",          tab:false },
  Hwacha:               { icon:"🔥", label:"화차",            tab:false },
  Geobukcha:            { icon:"🐢", label:"거북차",          tab:false },
  MilitaryOrganization: { icon:"🚩", label:"군사조직",        tab:true  },
  CommandPost:          { icon:"🏰", label:"지휘부",          tab:false },
  ProvincialArmyCommand:{ icon:"🏰", label:"병영",            tab:false },
  LargeGarrison:        { icon:"🏰", label:"거진",            tab:false },
  LocalGarrison:        { icon:"🏰", label:"제진",            tab:false },
  Unit:                 { icon:"🚩", label:"부대",             tab:false },
  MilitaryFacility:     { icon:"🔱", label:"군사시설",        tab:false },
  Place:                { icon:"📍", label:"장소",            tab:true  },
  Province:             { icon:"🗺️", label:"도",              tab:false },
  Battlefield:          { icon:"⚔️", label:"전장",            tab:false },
  BorderArea:           { icon:"📍", label:"접경지역",         tab:false },
  Heritage:             { icon:"🏛️", label:"유산",            tab:true  },
  TangibleHeritage:     { icon:"🏛️", label:"유형유산",        tab:false },
  IntangibleHeritage:   { icon:"📿", label:"무형유산",        tab:false },
  EnemyForce:           { icon:"🗺️", label:"외적",            tab:false },
  Wokou:                { icon:"🏴", label:"왜구",             tab:false },
  Jurchen:              { icon:"🗺️", label:"여진",             tab:false },
  LaterJinQing:         { icon:"🗺️", label:"후금/청군",       tab:false },
  JapaneseArmy:         { icon:"⚔️", label:"일본군",          tab:false },
};

// 탭 정의 (순서 고정)
const TABS = [
  { key:"Commander",           icon:"👤", label:"지휘관" },
  { key:"King",                icon:"👑", label:"국왕"   },
  { key:"Fortress",            icon:"🏯", label:"성곽"   },
  { key:"Battle",              icon:"⚔️", label:"전투"   },
  { key:"MilitaryEvent",       icon:"📜", label:"군사사건"},
  { key:"WeaponSystem",        icon:"🗡️", label:"무기"   },
  { key:"MilitaryOrganization",icon:"🚩", label:"군사조직"},
  { key:"Place",               icon:"📍", label:"장소"   },
  { key:"Heritage",            icon:"🏛️", label:"유산"   },
];

const PRED_LABEL = {
  againstEnemy:           "적대세력",
  involvesForce:          "관련 군사조직",
  usesWeapon:             "사용 무기체계",
  usedInMilitaryEvent:    "사용된 군사사건",
  occurredAt:             "발생장소",
  commandedBy:            "지휘를 받다",
  commands:               "지휘하다",
  appointedBy:            "임명자",
  appoints:               "임명",
  hasFacility:            "군사시설",
  hasHeritage:            "유산",
  hasHeadquarters:        "지휘부",
  hasSubordinateCommand:  "예하 지휘부",
  subordinateTo:          "상위 지휘부",
  stationedAt:            "주둔지",
  participatedIn:         "참전",
  build:                  "축성/건립",
  builtBy:                "축성 주도자",
  developedWeapon:        "개발 무기",
  WeaponDevelopedBy:      "개발자",
  modernEquivalent:       "현대 대응개념",
  achievementNote:        "주요업적",
  specNote:               "제원/사양",
  sourceNote:             "출처",
  rankLabel:              "관직/계급",
  periodLabel:            "시기",
  description:            "설명",
};

function getClassMeta(classKey) {
  return CLASS_META[classKey] || { icon:"📌", label:classKey };
}

const JOS_NS  = "http://joseon-defense.eventpool.kr/ontology/";
const RES_NS  = "http://joseon-defense.eventpool.kr/resource/";

/** 클래스 URI의 모든 서브클래스 URI Set 반환 */
function getAllSubclassUris(onto, classKey) {
  const root = JOS_NS + classKey;
  const set  = new Set([root]);
  let changed = true;
  while (changed) {
    changed = false;
    Object.values(onto.classes).forEach(c => {
      if (c.subClassOf && set.has(c.subClassOf) && !set.has(c.uri)) {
        set.add(c.uri); changed = true;
      }
    });
  }
  return set;
}

/** 특정 클래스에 속하는 인스턴스 목록 */
function getInstancesByClass(onto, classKey) {
  const subSet = getAllSubclassUris(onto, classKey);
  return Object.values(onto.instances)
    .filter(inst => subSet.has(inst.type))
    .map(inst => instToVM(inst, onto));
}

/** 인스턴스 → ViewModel */
function instToVM(inst, onto) {
  const resourceId = inst.uri.split(/[#/]/).pop();
  const typeId     = inst.typeId || resourceId;
  const meta       = getClassMeta(typeId);
  const props      = inst.props || {};

  const tags = [];
  (inst.rels || []).forEach(rel => {
    const t = onto.instances[rel.obj];
    if (t && t.label) tags.push(t.label);
  });

  return {
    resourceId,
    uri:          inst.uri,
    label:        inst.label || resourceId,
    classKey:     typeId,
    classLabel:   meta.label,
    classIcon:    meta.icon,
    description:  inst.description || (props.description || [])[0] || null,
    yearStart:    (props.yearStart   || [])[0] || null,
    yearEnd:      (props.yearEnd     || [])[0] || null,
    periodLabel:  (props.periodLabel || [])[0] || null,
    rankLabel:    (props.rankLabel   || [])[0] || null,
    achievementNote: (props.achievementNote || [])[0] || null,
    specNote:     (props.specNote    || [])[0] || null,
    modernEquivalent: (props.modernEquivalent || [])[0] || null,
    sourceNote:   (props.sourceNote  || [])[0] || null,
    altLabel:     inst.altLabel || null,
    tags:         tags.slice(0, 6),
    rels:         inst.rels || [],
  };
}

/* ─────────────────────────────────────────────────────────────
   클래스별 스마트 패싯 필터 생성
   Domain-Range 관계를 활용하여 의미있는 패싯 구성
   ───────────────────────────────────────────────────────────── */

/**
 * 특정 predicate로 연결된 인스턴스들을 집계하여 패싯 옵션 생성
 * @param {Array} items - 현재 클래스의 VM 인스턴스 배열
 * @param {Object} onto - 온톨로지
 * @param {string} predLocal - 프레디케이트 로컬명
 * @param {string} filterLabel - 사이드바 표시 레이블
 * @param {string} filterKey - URL 파라미터 키
 */
function buildRelFacet(items, onto, predLocal, filterLabel, filterKey) {
  const counts = {};
  const labelMap = {};
  items.forEach(item => {
    (item.rels || []).forEach(rel => {
      if (rel.predLocal === predLocal) {
        const tid = rel.objId;
        const t   = onto.instances[rel.obj] || onto.instances[RES_NS + tid];
        const tlabel = (t && t.label) ? t.label : tid;
        counts[tid]   = (counts[tid] || 0) + 1;
        labelMap[tid] = tlabel;
      }
    });
  });
  const options = Object.entries(counts)
    .sort((a,b) => b[1]-a[1])
    .slice(0, 12)
    .map(([id, cnt]) => ({ value: id, label: labelMap[id] || id, count: cnt }));
  if (!options.length) return null;
  return { key: filterKey, label: filterLabel, options };
}

/**
 * 클래스별 맞춤 패싯 필터 생성
 * 사용자 요구사항:
 *   - 인물(지휘관/국왕): Person > Commander/King subClass
 *   - 성곽: hasHeritage(Place range)
 *   - 전투: occurredAt(Place), usesWeapon(WeaponSystem)
 *   - 무기: WeaponDevelopedBy(Person), usedInMilitaryEvent(MilitaryEvent)
 *   - 군사조직: stationedAt(Place), commandedBy(Commander), hasSubordinateCommand
 *   - 장소: hasHeritage(Heritage)
 */
function buildSmartFilters(classKey, items, onto, selectedFilters) {
  const filters = [];

  // ── 헬퍼: relBadge/relDesc 메타 첨부
  function withMeta(facet, relBadge, relDesc, isInverse) {
    if (!facet) return null;
    if (relBadge) facet.relBadge = relBadge;
    if (relDesc)  facet.relDesc  = relDesc;
    if (isInverse) facet.isInverse = true;
    return facet;
  }

  // ── 서브클래스 카운트 빌더 (공통)
  function buildSubclassFacet(label, excludeSelf) {
    const counts = {};
    items.forEach(item => {
      if (excludeSelf && item.classKey === classKey) return;
      const lbl = getClassMeta(item.classKey).label || item.classKey;
      counts[item.classKey] = counts[item.classKey] || { label: lbl, count: 0 };
      counts[item.classKey].count++;
    });
    const opts = Object.entries(counts)
      .map(([k, v]) => ({ value: k, label: v.label, count: v.count }))
      .filter(o => o.count > 0);
    if (opts.length < 2) return null;
    return { key:"subclass", label, options: opts };
  }

  // ── 역관계 집계 빌더 (공통)
  function buildInverseFacet(predLocal, filterLabel, filterKey, maxOpts) {
    const counts = {}; const labels = {};
    items.forEach(item => {
      Object.values(onto.instances).forEach(other => {
        (other.rels || []).forEach(rel => {
          if (rel.predLocal === predLocal && rel.obj === item.uri) {
            const sid = other.uri.split(/[#/]/).pop();
            counts[sid] = (counts[sid] || 0) + 1;
            labels[sid] = other.label || sid;
          }
        });
      });
    });
    const opts = Object.entries(counts)
      .sort((a,b) => b[1]-a[1]).slice(0, maxOpts || 10)
      .map(([id,cnt]) => ({ value:id, label:labels[id]||id, count:cnt }));
    if (!opts.length) return null;
    return { key: filterKey, label: filterLabel, options: opts };
  }

  // ══════════════════════════════════════════════════════════
  // 인물 — Commander / King  (Person > subClassOf)
  // ══════════════════════════════════════════════════════════
  if (classKey === "Commander" || classKey === "King" || classKey === "Person") {
    // Person > Commander / King 서브클래스 칩
    const sub = buildSubclassFacet("인물 구분 (subClassOf Person)");
    if (sub) {
      sub.relBadge = "Person ▸ subClass";
      sub.relDesc  = "Commander · King은 Person의 하위 클래스입니다.";
      filters.push(sub);
    }
    // participatedIn → MilitaryEvent
    const evFacet = withMeta(
      buildRelFacet(items, onto, "participatedIn", "참전 사건", "event"),
      "Person → MilitaryEvent", "participatedIn 관계 (정방향)"
    );
    if (evFacet) filters.push(evFacet);
    // appointedBy → King
    const kingFacet = withMeta(
      buildRelFacet(items, onto, "appointedBy", "임명 국왕", "king"),
      "Commander → King", "appointedBy 관계 (정방향)"
    );
    if (kingFacet) filters.push(kingFacet);
    // commands → MilitaryOrganization
    const cmdFacet = withMeta(
      buildRelFacet(items, onto, "commands", "지휘 조직", "org"),
      "Commander → MilitaryOrg", "commands 관계 (정방향)"
    );
    if (cmdFacet) filters.push(cmdFacet);
  }

  // ══════════════════════════════════════════════════════════
  // 성곽 — Fortress
  // ══════════════════════════════════════════════════════════
  if (classKey === "Fortress") {
    // hasHeritage → Heritage  (range: Heritage)
    const hFacet = withMeta(
      buildRelFacet(items, onto, "hasHeritage", "유산", "heritage"),
      "Fortress → Heritage", "hasHeritage 관계 — range: Heritage"
    );
    if (hFacet) filters.push(hFacet);
    // hasFacility → MilitaryFacility
    const facilityFacet = withMeta(
      buildRelFacet(items, onto, "hasFacility", "군사시설", "facility"),
      "Fortress → MilitaryFacility", "hasFacility 관계 (정방향)"
    );
    if (facilityFacet) filters.push(facilityFacet);
    // builtBy → Person
    const builtFacet = withMeta(
      buildRelFacet(items, onto, "builtBy", "축성 주도자", "builder"),
      "Fortress → Person", "builtBy 관계 — range: Person"
    );
    if (builtFacet) filters.push(builtFacet);
  }

  // ══════════════════════════════════════════════════════════
  // 전투/군사사건 — Battle / MilitaryEvent
  // ══════════════════════════════════════════════════════════
  if (["Battle","War","Campaign","Invasion","DefenseOperation",
       "MilitaryEvent","MilitaryInnovation","DisasterRelief"].includes(classKey)) {
    // occurredAt → Place  (range: Place)
    const placeFacet = withMeta(
      buildRelFacet(items, onto, "occurredAt", "발생 장소", "place"),
      "MilitaryEvent → Place", "occurredAt 관계 — range: Place"
    );
    if (placeFacet) filters.push(placeFacet);
    // usesWeapon → WeaponSystem  (range: WeaponSystem)
    const weaponFacet = withMeta(
      buildRelFacet(items, onto, "usesWeapon", "사용 무기체계", "weapon"),
      "MilitaryEvent → WeaponSystem", "usesWeapon 관계 — range: WeaponSystem"
    );
    if (weaponFacet) filters.push(weaponFacet);
    // againstEnemy → EnemyForce
    const enemyFacet = withMeta(
      buildRelFacet(items, onto, "againstEnemy", "적대세력", "enemy"),
      "MilitaryEvent → EnemyForce", "againstEnemy 관계 (정방향)"
    );
    if (enemyFacet) filters.push(enemyFacet);
    // involvesForce → MilitaryOrganization
    const forceFacet = withMeta(
      buildRelFacet(items, onto, "involvesForce", "관련 군사조직", "force"),
      "MilitaryEvent → MilitaryOrg", "involvesForce 관계 (정방향)"
    );
    if (forceFacet) filters.push(forceFacet);
  }

  // ══════════════════════════════════════════════════════════
  // 무기체계 — WeaponSystem
  // ══════════════════════════════════════════════════════════
  if (classKey === "WeaponSystem" || classKey === "Cannon" || classKey === "RocketWeapon") {
    // 서브클래스 칩
    const sub = buildSubclassFacet("무기 종류 (subClassOf WeaponSystem)", true);
    if (sub) {
      sub.relBadge = "WeaponSystem ▸ subClass";
      filters.push(sub);
    }
    // WeaponDevelopedBy → Person  (range: Person)
    const devFacet = withMeta(
      buildRelFacet(items, onto, "WeaponDevelopedBy", "개발자", "developer"),
      "WeaponSystem → Person", "WeaponDevelopedBy — range: Person"
    );
    if (devFacet) filters.push(devFacet);
    // 역관계: MilitaryEvent.usesWeapon → this
    const evFacet = withMeta(
      buildInverseFacet("usesWeapon", "사용된 군사사건", "event", 8),
      "MilitaryEvent → WeaponSystem", "usesWeapon 역관계 (↩ 사건에서 참조)",
      true, true
    );
    if (evFacet) filters.push(evFacet);
  }

  // ══════════════════════════════════════════════════════════
  // 군사조직 — MilitaryOrganization
  // ══════════════════════════════════════════════════════════
  if (classKey === "MilitaryOrganization" || classKey === "CommandPost" ||
      classKey === "ProvincialArmyCommand" || classKey === "LargeGarrison" || classKey === "LocalGarrison") {
    // 서브클래스 칩
    const sub = buildSubclassFacet("조직 구분 (subClassOf MilitaryOrg)");
    if (sub) {
      sub.relBadge = "MilitaryOrg ▸ subClass";
      filters.push(sub);
    }
    // stationedAt → Place  (range: Place)
    const placeFacet = withMeta(
      buildRelFacet(items, onto, "stationedAt", "주둔 장소", "place"),
      "MilitaryOrg → Place", "stationedAt 관계 — range: Place"
    );
    if (placeFacet) filters.push(placeFacet);
    // subordinateTo → MilitaryOrganization
    const supFacet = withMeta(
      buildRelFacet(items, onto, "subordinateTo", "상위 지휘부", "parent"),
      "MilitaryOrg → MilitaryOrg", "subordinateTo 관계 (정방향)"
    );
    if (supFacet) filters.push(supFacet);
    // 역관계: Commander.commands → this
    const cmdFacet = withMeta(
      buildInverseFacet("commands", "지휘한 인물", "commander", 10),
      "Commander → MilitaryOrg", "commands 역관계 (↩ 지휘관에서 참조)",
      true, true
    );
    if (cmdFacet) filters.push(cmdFacet);
  }

  // ══════════════════════════════════════════════════════════
  // 장소 — Place
  // ══════════════════════════════════════════════════════════
  if (classKey === "Place" || classKey === "Battlefield" || classKey === "Province" || classKey === "BorderArea") {
    // 서브클래스 칩
    const sub = buildSubclassFacet("장소 구분 (subClassOf Place)");
    if (sub) {
      sub.relBadge = "Place ▸ subClass";
      filters.push(sub);
    }
    // hasHeritage → Heritage  (range: Heritage)
    const hFacet = withMeta(
      buildRelFacet(items, onto, "hasHeritage", "관련 유산", "heritage"),
      "Place → Heritage", "hasHeritage 관계 — range: Heritage"
    );
    if (hFacet) filters.push(hFacet);
    // 역관계: MilitaryEvent.occurredAt → this
    const evFacet = withMeta(
      buildInverseFacet("occurredAt", "발생한 군사사건", "event", 10),
      "MilitaryEvent → Place", "occurredAt 역관계 (↩ 사건에서 참조)",
      true, true
    );
    if (evFacet) filters.push(evFacet);
    // 역관계: MilitaryOrg.stationedAt → this
    const orgFacet = withMeta(
      buildInverseFacet("stationedAt", "주둔 군사조직", "org", 10),
      "MilitaryOrg → Place", "stationedAt 역관계 (↩ 조직에서 참조)",
      true, true
    );
    if (orgFacet) filters.push(orgFacet);
  }

  // ══════════════════════════════════════════════════════════
  // 유산 — Heritage
  // ══════════════════════════════════════════════════════════
  if (classKey === "Heritage" || classKey === "TangibleHeritage" || classKey === "IntangibleHeritage") {
    // 역관계: Place/Fortress.hasHeritage → this
    const placeFacet = withMeta(
      buildInverseFacet("hasHeritage", "관련 장소/성곽", "place", 10),
      "Place/Fortress → Heritage", "hasHeritage 역관계 (↩ 장소·성곽에서 참조)",
      true, true
    );
    if (placeFacet) filters.push(placeFacet);
  }

  return filters;
}

/** 필터 파라미터 적용하여 items 필터링 */
function applyFilters(items, classKey, selectedFilters, onto) {
  let result = [...items];

  if (selectedFilters.subclass) {
    result = result.filter(i => i.classKey === selectedFilters.subclass);
  }
  if (selectedFilters.place) {
    result = result.filter(i =>
      (i.rels||[]).some(r => r.predLocal === "occurredAt"  && r.objId === selectedFilters.place) ||
      (i.rels||[]).some(r => r.predLocal === "stationedAt" && r.objId === selectedFilters.place)
    );
  }
  if (selectedFilters.weapon) {
    result = result.filter(i =>
      (i.rels||[]).some(r => r.predLocal === "usesWeapon" && r.objId === selectedFilters.weapon)
    );
  }
  if (selectedFilters.enemy) {
    result = result.filter(i =>
      (i.rels||[]).some(r => r.predLocal === "againstEnemy" && r.objId === selectedFilters.enemy)
    );
  }
  if (selectedFilters.force) {
    result = result.filter(i =>
      (i.rels||[]).some(r => r.predLocal === "involvesForce" && r.objId === selectedFilters.force)
    );
  }
  if (selectedFilters.heritage) {
    result = result.filter(i =>
      (i.rels||[]).some(r => r.predLocal === "hasHeritage" && r.objId === selectedFilters.heritage)
    );
  }
  if (selectedFilters.builder) {
    result = result.filter(i =>
      (i.rels||[]).some(r => r.predLocal === "builtBy" && r.objId === selectedFilters.builder)
    );
  }
  if (selectedFilters.developer) {
    result = result.filter(i =>
      (i.rels||[]).some(r => r.predLocal === "WeaponDevelopedBy" && r.objId === selectedFilters.developer)
    );
  }
  if (selectedFilters.event) {
    // 무기/장소의 경우: 역관계로 필터
    if (classKey === "WeaponSystem" || classKey === "Place") {
      result = result.filter(i => {
        const evInst = onto.instances[RES_NS + selectedFilters.event];
        if (!evInst) return false;
        return (evInst.rels||[]).some(r =>
          (r.predLocal === "usesWeapon" || r.predLocal === "occurredAt") && r.objId === i.resourceId
        );
      });
    } else {
      result = result.filter(i =>
        (i.rels||[]).some(r => r.predLocal === "participatedIn" && r.objId === selectedFilters.event)
      );
    }
  }
  if (selectedFilters.king) {
    result = result.filter(i =>
      (i.rels||[]).some(r => r.predLocal === "appointedBy" && r.objId === selectedFilters.king)
    );
  }
  if (selectedFilters.org) {
    result = result.filter(i =>
      (i.rels||[]).some(r => r.predLocal === "commands" && r.objId === selectedFilters.org)
    );
  }
  if (selectedFilters.parent) {
    result = result.filter(i =>
      (i.rels||[]).some(r => r.predLocal === "subordinateTo" && r.objId === selectedFilters.parent)
    );
  }
  if (selectedFilters.commander) {
    // 역관계
    result = result.filter(i => {
      const cmdInst = onto.instances[RES_NS + selectedFilters.commander];
      if (!cmdInst) return false;
      return (cmdInst.rels||[]).some(r => r.predLocal === "commands" && r.objId === i.uri);
    });
  }
  return result;
}

function buildStats(onto) {
  const get = (...keys) => {
    const set = new Set();
    keys.forEach(k => getInstancesByClass(onto, k).forEach(i => set.add(i.resourceId)));
    return set.size;
  };
  return {
    personCount:    get("Person"),
    commanderCount: get("Commander"),
    kingCount:      get("King"),
    fortressCount:  get("Fortress"),
    battleCount:    get("Battle"),
    warCount:       get("War"),
    eventCount:     get("MilitaryEvent"),
    weaponCount:    get("WeaponSystem"),
    orgCount:       get("MilitaryOrganization"),
    placeCount:     get("Place"),
    heritageCount:  get("Heritage"),
  };
}

/* ─────────────────────────────────────────────────────────────
   라우터
   ───────────────────────────────────────────────────────────── */

// ── GET / (홈)
router.get("/", (req, res) => {
  const onto  = loadOntology();
  const stats = buildStats(onto);
  res.render("joseon-defense/index", {
    pageTitle: "조선시대 국방 온톨로지",
    stats,
    tabs: TABS,
  });
});

// ── GET /facet/:classKey
router.get("/facet/:classKey", (req, res) => {
  const onto     = loadOntology();
  const classKey = req.params.classKey;
  const meta     = getClassMeta(classKey);
  const searchQ  = (req.query.q || "").trim();
  const sortBy   = req.query.sort || "alpha";

  // 선택된 필터 파라미터 수집
  const FILTER_KEYS = ["subclass","place","weapon","enemy","force","heritage","builder",
                       "developer","event","king","org","parent","commander","facility"];
  const selectedFilters = {};
  FILTER_KEYS.forEach(k => { if (req.query[k]) selectedFilters[k] = req.query[k]; });

  // 인스턴스 목록
  let items = getInstancesByClass(onto, classKey);

  // 검색 필터
  if (searchQ) {
    const q = searchQ.toLowerCase();
    items = items.filter(item =>
      (item.label||"").toLowerCase().includes(q) ||
      (item.description||"").toLowerCase().includes(q) ||
      (item.periodLabel||"").toLowerCase().includes(q) ||
      (item.achievementNote||"").toLowerCase().includes(q) ||
      item.tags.some(t => t.toLowerCase().includes(q))
    );
  }

  // 관계 필터 적용 (검색 후)
  const hasRelFilter = Object.keys(selectedFilters).length > 0;
  if (hasRelFilter) {
    items = applyFilters(items, classKey, selectedFilters, onto);
  }

  // 정렬
  if (sortBy === "alpha") items.sort((a,b) => (a.label||"").localeCompare(b.label||"","ko"));
  else if (sortBy === "year") items.sort((a,b) => (parseInt(a.yearStart)||9999) - (parseInt(b.yearStart)||9999));

  // 전체 목록(필터 미적용)으로 패싯 생성
  const allItems = getInstancesByClass(onto, classKey);
  const filters  = buildSmartFilters(classKey, allItems, onto, selectedFilters);

  res.render("joseon-defense/facet", {
    pageTitle:      `${meta.label} — 조선 국방 온톨로지`,
    currentClass:   classKey,
    classLabel:     meta.label,
    classIcon:      meta.icon,
    items,
    totalCount:     items.length,
    allCount:       allItems.length,
    filters,
    selectedFilters,
    searchQuery:    searchQ,
    sortBy,
    tabs:           TABS,
  });
});

// ── GET /resource/:resourceId
router.get("/resource/:resourceId", (req, res) => {
  const onto       = loadOntology();
  const resourceId = req.params.resourceId;
  const uri        = RES_NS + resourceId;
  const inst       = onto.instances[uri];

  if (!inst) {
    return res.status(404).render("error", { message:`리소스 '${resourceId}'를 찾을 수 없습니다.`, error:{} });
  }

  const vm   = instToVM(inst, onto);
  const meta = getClassMeta(vm.classKey);

  const relations = (inst.rels || []).map(rel => {
    const t = onto.instances[rel.obj];
    return {
      predicateLabel: PRED_LABEL[rel.predLocal] || rel.predLocal,
      predicateKey:   rel.predLocal,
      targetId:       rel.objId,
      targetLabel:    t ? (t.label || rel.objId) : rel.objId,
      targetUri:      rel.obj.startsWith(RES_NS),
    };
  });

  const inverseRelations = [];
  Object.values(onto.instances).forEach(other => {
    if (other.uri === uri) return;
    (other.rels || []).forEach(rel => {
      if (rel.obj === uri) {
        inverseRelations.push({
          predicateLabel: PRED_LABEL[rel.predLocal] || rel.predLocal,
          predicateKey:   rel.predLocal,
          sourceId:       other.uri.split(/[#/]/).pop(),
          sourceLabel:    other.label || other.uri.split(/[#/]/).pop(),
          sourceClass:    getClassMeta(other.typeId || "").label,
          sourceUri:      true,
        });
      }
    });
  });

  // 같은 클래스의 연관 인스턴스 (사이드 패널용)
  const relatedItems = getInstancesByClass(onto, vm.classKey)
    .filter(i => i.resourceId !== resourceId)
    .slice(0, 5);

  res.render("joseon-defense/resource", {
    pageTitle:       `${inst.label || resourceId} — 조선 국방 온톨로지`,
    classLabel:      meta.label,
    classIcon:       meta.icon,
    resource:        { ...vm, relations, inverseRelations },
    relations,
    inverseRelations,
    relatedItems,
    tabs:            TABS,
    PRED_LABEL,
  });
});

module.exports = router;
