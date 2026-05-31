// router/joseon_defense.js — 조선시대 국방 온톨로지 라우터
"use strict";

const express = require("express");
const router  = express.Router();
const path    = require("path");
const fs      = require("fs");

/* ─────────────────────────────────────────────────────────────
   TTL 파서 & 인메모리 온톨로지 데이터베이스
   ───────────────────────────────────────────────────────────── */

/**
 * 간단한 Turtle 파서
 * — prefix 처리, rdf:type, rdfs:label, rdfs:subClassOf,
 *   owl:Class, owl:ObjectProperty, owl:DatatypeProperty,
 *   모든 데이터·객체 프로퍼티 트리플 추출
 */
function parseTTL(text) {
  // 프리픽스 맵
  const prefixes = {};
  const prefixRe = /@prefix\s+(\w*):\s+<([^>]+)>\s*\./g;
  let m;
  while ((m = prefixRe.exec(text)) !== null) {
    prefixes[m[1]] = m[2];
  }

  function expand(curie) {
    if (!curie) return curie;
    curie = curie.trim();
    if (curie.startsWith("<") && curie.endsWith(">")) {
      return curie.slice(1, -1);
    }
    const colon = curie.indexOf(":");
    if (colon > -1) {
      const pfx  = curie.slice(0, colon);
      const local = curie.slice(colon + 1);
      if (prefixes[pfx] !== undefined) return prefixes[pfx] + local;
    }
    return curie;
  }

  function shortId(uri) {
    if (!uri) return uri;
    const last = uri.split(/[#/]/).pop();
    return last || uri;
  }

  // 주석 제거, 멀티라인 문자열 단순화
  const cleaned = text
    .replace(/#[^\n]*/g, "")
    .replace(/\s+/g, " ");

  // 트리플 수집 (블록 파서: subject { p o ; p o . } 패턴)
  // 간단 방식: 세미콜론/점 단위로 분해
  const triples = [];

  // 블록 단위 파싱: "subject p1 o1 ; p2 o2 ."
  const blockRe = /(\S+)\s+((?:(?!\s+\S+\s+\S+\s*[.;])[\s\S])+?)\s*\./g;

  // 더 단순한 방식: 줄 단위 + 세미콜론 처리
  const lines = cleaned.split(".");
  lines.forEach(block => {
    block = block.trim();
    if (!block) return;

    const stmts = block.split(";").map(s => s.trim()).filter(Boolean);
    if (!stmts.length) return;

    // 첫 statement에서 subject 추출
    const firstParts = stmts[0].match(/^(\S+)\s+(.+)$/);
    if (!firstParts) return;
    const subject = expand(firstParts[1]);
    const firstPO = firstParts[2].trim();

    const allPO = [firstPO, ...stmts.slice(1)];
    allPO.forEach(po => {
      po = po.trim();
      if (!po) return;
      const poMatch = po.match(/^(\S+)\s+(.+)$/);
      if (!poMatch) return;
      const pred   = expand(poMatch[1]);
      const objRaw = poMatch[2].trim();

      // 객체 파싱 (리터럴 or URI)
      let obj = objRaw;
      // 언어 태그 리터럴: "..."@ko
      const litLangM = obj.match(/^"(.*)"@(\w+)$/);
      if (litLangM) { obj = litLangM[1]; }
      // 타입 리터럴: "..."^^xsd:...
      const litTypeM = obj.match(/^"(.*?)"\^\^.+$/);
      if (litTypeM) { obj = litTypeM[1]; }
      // 일반 문자열 리터럴
      if (obj.startsWith('"') && obj.endsWith('"')) { obj = obj.slice(1, -1); }
      // URI
      if (obj.startsWith("<") && obj.endsWith(">")) { obj = obj.slice(1, -1); }
      else { obj = expand(obj); }

      triples.push({ s: subject, p: pred, o: obj });
    });
  });

  // 클래스 목록 수집
  const RDF_TYPE    = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
  const RDFS_LABEL  = "http://www.w3.org/2000/01/rdf-schema#label";
  const RDFS_SUB    = "http://www.w3.org/2000/01/rdf-schema#subClassOf";
  const SKOS_ALT    = "http://www.w3.org/2004/02/skos/core#altLabel";
  const OWL_CLASS   = "http://www.w3.org/2002/07/owl#Class";
  const OWL_OBJPROP = "http://www.w3.org/2002/07/owl#ObjectProperty";
  const OWL_DATPROP = "http://www.w3.org/2002/07/owl#DatatypeProperty";
  const RDFS_DOMAIN = "http://www.w3.org/2000/01/rdf-schema#domain";
  const RDFS_RANGE  = "http://www.w3.org/2000/01/rdf-schema#range";
  const OWL_INVERSE = "http://www.w3.org/2002/07/owl#inverseOf";

  const JOS = "http://joseon-defense.eventpool.kr/ontology/";
  const RES = "http://joseon-defense.eventpool.kr/resource/";

  const classes     = {};  // uri → { label, subClassOf }
  const objProps    = {};  // uri → { label, domain, range, inverseOf }
  const dataProps   = {};  // uri → { label, range }
  const instances   = {};  // uri → { type, label, props[], rels[] }

  // 1차 패스: 타입 수집
  triples.forEach(({ s, p, o }) => {
    if (p === RDF_TYPE) {
      if (o === OWL_CLASS) {
        if (!classes[s]) classes[s] = { uri: s, label: "", subClassOf: null };
      } else if (o === OWL_OBJPROP) {
        if (!objProps[s]) objProps[s] = { uri: s, label: "", domain: null, range: null, inverseOf: null };
      } else if (o === OWL_DATPROP) {
        if (!dataProps[s]) dataProps[s] = { uri: s, label: "", range: null };
      } else if (o.startsWith(JOS) || classes[o]) {
        // instance
        if (!instances[s]) instances[s] = { uri: s, type: o, typeId: shortId(o), label: "", altLabel: "", props: {}, rels: [] };
        else instances[s].type = o;
      }
    }
  });

  // 2차 패스: 속성 채우기
  triples.forEach(({ s, p, o }) => {
    if (p === RDFS_LABEL) {
      if (classes[s])   classes[s].label   = o;
      if (objProps[s])  objProps[s].label   = o;
      if (dataProps[s]) dataProps[s].label  = o;
      if (instances[s]) instances[s].label  = o;
    }
    if (p === SKOS_ALT && instances[s]) instances[s].altLabel = o;
    if (p === RDFS_SUB  && classes[s])  classes[s].subClassOf  = o;
    if (p === RDFS_DOMAIN && objProps[s]) objProps[s].domain = o;
    if (p === RDFS_RANGE  && objProps[s]) objProps[s].range  = o;
    if (p === RDFS_RANGE  && dataProps[s]) dataProps[s].range = o;
    if (p === OWL_INVERSE && objProps[s]) objProps[s].inverseOf = o;

    // 인스턴스 관계/속성
    if (instances[s]) {
      const predLocal = shortId(p);
      // 데이터 속성
      if (!o.startsWith("http://")) {
        if (!instances[s].props[predLocal]) instances[s].props[predLocal] = [];
        instances[s].props[predLocal].push(o);
      } else if (p !== RDF_TYPE && p !== RDFS_LABEL && p !== SKOS_ALT) {
        // 관계
        instances[s].rels.push({ pred: p, predLocal, obj: o, objId: shortId(o) });
      }
    }
  });

  return { classes, objProps, dataProps, instances, prefixes, triples };
}

/* ─────────────────────────────────────────────────────────────
   온톨로지 로드 (서버 시작 시 1회)
   ───────────────────────────────────────────────────────────── */
const TTL_PATH = path.join(__dirname, "..", "data", "joseon-defense.ttl");
// 업로드 경로에서도 찾기
const TTL_ALT  = "/home/user/uploaded_files/joseon_defense_static_ontology_v0_1.ttl";

let ONTO = null;

function loadOntology() {
  if (ONTO) return ONTO;
  let ttlText = null;
  if (fs.existsSync(TTL_PATH)) {
    ttlText = fs.readFileSync(TTL_PATH, "utf8");
  } else if (fs.existsSync(TTL_ALT)) {
    ttlText = fs.readFileSync(TTL_ALT, "utf8");
  }
  if (!ttlText) {
    console.warn("[JoseonDefense] TTL 파일을 찾을 수 없습니다. 빈 온톨로지로 진행합니다.");
    ONTO = { classes: {}, objProps: {}, dataProps: {}, instances: {}, prefixes: {}, triples: [] };
    return ONTO;
  }
  ONTO = parseTTL(ttlText);
  console.log(`[JoseonDefense] 온톨로지 로드 완료: 클래스 ${Object.keys(ONTO.classes).length}개, 인스턴스 ${Object.keys(ONTO.instances).length}개`);
  return ONTO;
}

/* ─────────────────────────────────────────────────────────────
   헬퍼
   ───────────────────────────────────────────────────────────── */

const CLASS_META = {
  Commander:           { icon: "👤", label: "지휘관",        labelEn: "Commander" },
  JeollaByeongsa:      { icon: "👤", label: "전라병사",       labelEn: "JeollaByeongsa" },
  King:                { icon: "👑", label: "군 통수권자/국왕", labelEn: "King" },
  Fortress:            { icon: "🏯", label: "성곽",           labelEn: "Fortress" },
  Battle:              { icon: "⚔️",  label: "전투",          labelEn: "Battle" },
  War:                 { icon: "🏳️",  label: "전쟁",          labelEn: "War" },
  DefenseOperation:    { icon: "🛡️",  label: "방어작전",      labelEn: "DefenseOperation" },
  Campaign:            { icon: "🗺️",  label: "원정/정벌",     labelEn: "Campaign" },
  Invasion:            { icon: "⚡",  label: "침입/침략",     labelEn: "Invasion" },
  MilitaryEvent:       { icon: "📜", label: "군사사건",       labelEn: "MilitaryEvent" },
  MilitaryInnovation:  { icon: "⚙️",  label: "군사기술개발",  labelEn: "MilitaryInnovation" },
  DisasterRelief:      { icon: "🤝", label: "대민지원",       labelEn: "DisasterRelief" },
  WeaponSystem:        { icon: "🗡️",  label: "무기체계",      labelEn: "WeaponSystem" },
  Cannon:              { icon: "💥", label: "총통/화포",       labelEn: "Cannon" },
  RocketWeapon:        { icon: "🚀", label: "로켓무기",       labelEn: "RocketWeapon" },
  Singijeon:           { icon: "🚀", label: "신기전",         labelEn: "Singijeon" },
  Hwacha:              { icon: "🔥", label: "화차",           labelEn: "Hwacha" },
  Geobukcha:           { icon: "🐢", label: "거북차",         labelEn: "Geobukcha" },
  MilitaryOrganization:{ icon: "🚩", label: "군사조직",       labelEn: "MilitaryOrganization" },
  CommandPost:         { icon: "🏰", label: "지휘부",         labelEn: "CommandPost" },
  ProvincialArmyCommand:{ icon:"🏰", label: "병영",           labelEn: "ProvincialArmyCommand" },
  LargeGarrison:       { icon: "🏰", label: "거진",           labelEn: "LargeGarrison" },
  LocalGarrison:       { icon: "🏰", label: "제진",           labelEn: "LocalGarrison" },
  Unit:                { icon: "🚩", label: "부대",           labelEn: "Unit" },
  MilitaryFacility:    { icon: "🔱", label: "군사시설",       labelEn: "MilitaryFacility" },
  Barbican:            { icon: "🔱", label: "옹성",           labelEn: "Barbican" },
  Moat:                { icon: "💧", label: "해자",           labelEn: "Moat" },
  TrapObstacle:        { icon: "⚠️",  label: "함정장애물",    labelEn: "TrapObstacle" },
  EnemyForce:          { icon: "🗺️",  label: "외적/적대세력", labelEn: "EnemyForce" },
  JapaneseArmy:        { icon: "⚔️",  label: "일본군",        labelEn: "JapaneseArmy" },
  Wokou:               { icon: "🏴", label: "왜구",           labelEn: "Wokou" },
  Jurchen:             { icon: "🗺️",  label: "여진",          labelEn: "Jurchen" },
  LaterJinQing:        { icon: "🗺️",  label: "후금/청군",     labelEn: "LaterJinQing" },
  Heritage:            { icon: "🏛️",  label: "유산",          labelEn: "Heritage" },
  TangibleHeritage:    { icon: "🏛️",  label: "유형유산",      labelEn: "TangibleHeritage" },
  IntangibleHeritage:  { icon: "📿", label: "무형유산",       labelEn: "IntangibleHeritage" },
  CommemorationFacility:{ icon:"🕯️", label: "추모/선양시설",  labelEn: "CommemorationFacility" },
  Place:               { icon: "📍", label: "장소",           labelEn: "Place" },
  Province:            { icon: "📍", label: "도",             labelEn: "Province" },
  Battlefield:         { icon: "⚔️",  label: "전장",          labelEn: "Battlefield" },
  BorderArea:          { icon: "📍", label: "접경/방어지역",   labelEn: "BorderArea" },
  Person:              { icon: "👤", label: "인물",           labelEn: "Person" },
  Civilian:            { icon: "👥", label: "백성",           labelEn: "Civilian" },
  UnnamedSoldier:      { icon: "🪖", label: "무명용사",       labelEn: "UnnamedSoldier" },
};

const PRED_LABEL = {
  "againstEnemy":          "적대세력",
  "involvesForce":         "관련 군사조직",
  "usesWeapon":            "사용 무기체계",
  "usedInMilitaryEvent":   "사용된 군사사건",
  "occurredAt":            "발생장소",
  "commandedBy":           "지휘를 받다",
  "commands":              "지휘하다",
  "appointedBy":           "임명자",
  "appoints":              "임명",
  "hasFacility":           "군사시설",
  "hasHeritage":           "유산",
  "hasHeadquarters":       "지휘부",
  "hasSubordinateCommand": "예하 지휘부",
  "subordinateTo":         "상위 지휘부",
  "stationedAt":           "주둔지",
  "participatedIn":        "참전",
  "build":                 "축성/건립",
  "builtBy":               "축성 주도자",
  "developedWeapon":       "개발 무기",
  "WeaponDevelopedBy":     "개발자",
  "involvesForce":         "관련 부대",
  "modernEquivalent":      "현대 대응개념",
};

function getClassMeta(classKey) {
  return CLASS_META[classKey] || { icon: "📌", label: classKey, labelEn: classKey };
}

function instToVM(inst, onto) {
  const resourceId = inst.uri.split(/[#/]/).pop();
  const typeId     = inst.typeId || resourceId;
  const meta       = getClassMeta(typeId);
  const props      = inst.props || {};

  // tags 추출 (관계 목적어 레이블)
  const tags = [];
  (inst.rels || []).forEach(rel => {
    const targetInst = onto.instances[rel.obj];
    if (targetInst && targetInst.label) tags.push(targetInst.label);
  });

  return {
    resourceId,
    uri:          inst.uri,
    label:        inst.label || resourceId,
    classKey:     typeId,
    classLabel:   meta.label,
    classIcon:    meta.icon,
    yearStart:    (props.yearStart || [])[0] || null,
    yearEnd:      (props.yearEnd   || [])[0] || null,
    periodLabel:  (props.periodLabel || [])[0] || null,
    rankLabel:    (props.rankLabel || [])[0] || null,
    modernEquivalent: (props.modernEquivalent || [])[0] || null,
    sourceNote:   (props.sourceNote || [])[0] || null,
    altLabel:     inst.altLabel || null,
    tags:         tags.slice(0, 5),
    description:  null,
  };
}

/**
 * 특정 클래스(및 서브클래스)에 속하는 인스턴스 목록 반환
 */
function getInstancesByClass(onto, classKey) {
  const JOS = "http://joseon-defense.eventpool.kr/ontology/";
  const classUri = JOS + classKey;

  // 해당 클래스의 모든 서브클래스 URI 수집
  const subClasses = new Set([classUri]);
  let changed = true;
  while (changed) {
    changed = false;
    Object.values(onto.classes).forEach(c => {
      if (c.subClassOf && subClasses.has(c.subClassOf) && !subClasses.has(c.uri)) {
        subClasses.add(c.uri);
        changed = true;
      }
    });
  }

  const results = [];
  Object.values(onto.instances).forEach(inst => {
    if (subClasses.has(inst.type)) {
      results.push(instToVM(inst, onto));
    }
  });
  return results;
}

function buildStats(onto) {
  const get = (keys) => {
    let count = 0;
    keys.forEach(k => count += getInstancesByClass(onto, k).length);
    return count;
  };
  return {
    commanderCount: get(["Commander", "JeollaByeongsa"]),
    fortressCount:  get(["Fortress"]),
    battleCount:    get(["Battle", "War", "DefenseOperation", "Campaign", "Invasion", "MilitaryEvent", "MilitaryInnovation"]),
    weaponCount:    get(["WeaponSystem"]),
    orgCount:       get(["MilitaryOrganization"]),
    heritageCount:  get(["Heritage"]),
  };
}

/* ─────────────────────────────────────────────────────────────
   라우터
   ───────────────────────────────────────────────────────────── */

// TTL 파일을 data/ 디렉토리로 복사 (없으면)
function ensureTTLCopied() {
  const dataDir = path.join(__dirname, "..", "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(TTL_PATH) && fs.existsSync(TTL_ALT)) {
    fs.copyFileSync(TTL_ALT, TTL_PATH);
    console.log("[JoseonDefense] TTL 파일을 data/ 에 복사했습니다.");
  }
}
ensureTTLCopied();

// ── GET /joseon_defense ─────────────────────────────────────
router.get("/", (req, res) => {
  const onto = loadOntology();
  const stats = buildStats(onto);
  res.render("joseon-defense/index", {
    pageTitle: "조선시대 국방 온톨로지",
    stats,
  });
});

// ── GET /joseon-defense/facet/:classKey ─────────────────────
router.get("/facet/:classKey", (req, res) => {
  const onto      = loadOntology();
  const classKey  = req.params.classKey;
  const meta      = getClassMeta(classKey);
  const searchQ   = (req.query.q || "").trim();
  const sortBy    = req.query.sort || "latest";

  // 인스턴스 목록 가져오기
  let items = getInstancesByClass(onto, classKey);

  // 검색 필터
  if (searchQ) {
    const q = searchQ.toLowerCase();
    items = items.filter(item =>
      (item.label || "").toLowerCase().includes(q) ||
      (item.periodLabel || "").toLowerCase().includes(q) ||
      item.tags.some(t => t.toLowerCase().includes(q))
    );
  }

  // 정렬
  if (sortBy === "alpha") {
    items.sort((a, b) => (a.label || "").localeCompare(b.label || "", "ko"));
  }

  // 관련 필터 그룹 (태그 기반)
  const tagCounts = {};
  items.forEach(item => {
    item.tags.forEach(t => {
      if (t) tagCounts[t] = (tagCounts[t] || 0) + 1;
    });
  });
  const filters = [];
  if (Object.keys(tagCounts).length > 0) {
    filters.push({
      key: "tag",
      label: "관련 개체",
      options: Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([v, c]) => ({ value: v, label: v, count: c })),
    });
  }

  res.render("joseon-defense/facet", {
    pageTitle:    `${meta.label} — 조선 국방 온톨로지`,
    currentClass: classKey,
    classLabel:   meta.label,
    classIcon:    meta.icon,
    items,
    totalCount:   items.length,
    filters,
    selectedFilters: {},
    searchQuery:  searchQ,
    sortBy,
  });
});

// ── GET /joseon-defense/resource/:resourceId ────────────────
router.get("/resource/:resourceId", (req, res) => {
  const onto       = loadOntology();
  const resourceId = req.params.resourceId;
  const RES_BASE   = "http://joseon-defense.eventpool.kr/resource/";
  const uri        = RES_BASE + resourceId;

  const inst = onto.instances[uri];
  if (!inst) {
    return res.status(404).render("error", {
      message: `리소스 '${resourceId}'를 찾을 수 없습니다.`,
      error: {},
    });
  }

  const vm   = instToVM(inst, onto);
  const meta = getClassMeta(vm.classKey);

  // 관계 상세 (label 포함)
  const relations = (inst.rels || []).map(rel => {
    const targetInst = onto.instances[rel.obj];
    return {
      predicateLabel: PRED_LABEL[rel.predLocal] || rel.predLocal,
      targetId:       rel.objId,
      targetLabel:    targetInst ? (targetInst.label || rel.objId) : rel.objId,
      targetUri:      rel.obj.startsWith("http://joseon-defense.eventpool.kr/resource/"),
    };
  });

  // 역관계: 다른 인스턴스가 이 리소스를 참조하는 경우
  const inverseRelations = [];
  Object.values(onto.instances).forEach(other => {
    if (other.uri === uri) return;
    (other.rels || []).forEach(rel => {
      if (rel.obj === uri) {
        const srcId = other.uri.split(/[#/]/).pop();
        inverseRelations.push({
          predicateLabel: PRED_LABEL[rel.predLocal] || rel.predLocal,
          sourceId:       srcId,
          sourceLabel:    other.label || srcId,
          sourceUri:      true,
        });
      }
    });
  });

  res.render("joseon-defense/resource", {
    pageTitle:         `${inst.label || resourceId} — 조선 국방 온톨로지`,
    classLabel:        meta.label,
    classIcon:         meta.icon,
    resource:          { ...vm, relations, inverseRelations },
    relations,
    inverseRelations,
  });
});

module.exports = router;
