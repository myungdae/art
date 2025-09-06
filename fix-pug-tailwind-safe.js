// fix-pug-tailwind-safe.js
// Safer Pug shorthand -> class="..." converter
// - Skips inside `script.` / `style.` blocks
// - Only rewrites shorthand that Pug chokes on: responsive (md:...), fractional (-0.5), bracketed ([...])

const fs = require('fs');
const path = require('path');

const DRY = process.argv.includes('--dry');
const ROOT = path.resolve('views');

const RESP_RE = /(^|\.)(sm|md|lg|xl|2xl):/;     // .md:hidden, .md:col-span-3 ...
const FRAC_RE = /-\d+(?:\.\d+)\b/;               // -0.5, -1.5 ...
const BRKT_RE = /\[[^\]]+\]/;                    // w-[42px], grid-cols-[auto,1fr] ...
const BADCLASS_RE = new RegExp(
  [RESP_RE.source, FRAC_RE.source, BRKT_RE.source].join('|')
);

function walk(dir) {
  const ents = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of ents) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.isFile() && p.endsWith('.pug')) fixFile(p);
  }
}

function fixFile(file) {
  const src = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const lines = src.split('\n');
  let out = [];
  let changed = false;

  // track raw blocks (script. / style.)
  let rawBlock = null; // {indent: number, type: 'script'|'style'}

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const indent = (line.match(/^\s*/) || [''])[0];
    const trimmed = line.trim();

    // exit raw block when dedented
    if (rawBlock && indent.length <= rawBlock.indent) rawBlock = null;

    // enter raw block?
    if (!rawBlock) {
      if (/^script\.\s*$/.test(trimmed)) rawBlock = { indent: indent.length, type: 'script' };
      else if (/^style\.\s*$/.test(trimmed)) rawBlock = { indent: indent.length, type: 'style' };
    }

    // if inside raw block -> do nothing
    if (rawBlock) { out.push(line); continue; }

    // candidate: first token (tag/ or .class…) before space/( / = end
    const afterIndent = line.slice(indent.length);
    const headEnd = (() => {
      for (let j = 0; j < afterIndent.length; j++) {
        const ch = afterIndent[j];
        if (ch === ' ' || ch === '\t' || ch === '(' || ch === '=' ) return j;
      }
      return afterIndent.length;
    })();
    const head = afterIndent.slice(0, headEnd); // e.g. "p.text-sm.mt-0.5" or ".md:hidden.bg-white"
    const tail = afterIndent.slice(headEnd);    // the rest: attrs, =, text, etc.

    // head must actually have shorthand classes
    if (!head.includes('.')) { out.push(line); continue; }

    // Do we have problematic class tokens?
    if (!BADCLASS_RE.test(head)) { out.push(line); continue; }

    // Break head into tag + classes
    let tag = 'div';
    let clsPart = head;
    if (head[0] !== '.') {
      // has explicit tag (and maybe id), we keep only tag; reject if id (#) present to avoid breaking it
      const m = head.match(/^([a-z][\w-]*)(.*)$/i);
      if (!m) { out.push(line); continue; }
      tag = m[1];
      clsPart = m[2];
      if (/#/.test(clsPart)) { out.push(line); continue; } // skip when id shorthand exists
    }

    // collect classes from .class segments (ignore empty)
    const classes = (clsPart.match(/\.[^\.\s\(\)=]+/g) || [])
      .map(s => s.slice(1))
      .filter(Boolean);

    if (!classes.length) { out.push(line); continue; }

    // Rebuild: indent + tag + (class="...") + tail
    const newHead = `${indent}${tag}(class="${classes.join(' ')}")`;
    const newline = newHead + tail;
    if (newline !== line) changed = true;
    out.push(newline);
  }

  if (changed) {
    if (DRY) {
      // show a minimal diff header like your current script
      console.log(`[DRY] ${file}`);
      // print only first and last changed lines for brevity
      // (optional: could print per-line diffs)
    } else {
      fs.writeFileSync(file, out.join('\n'), 'utf8');
      console.log(`[WRITE] ${file}`);
    }
  }
}

if (!fs.existsSync(ROOT)) {
  console.error(`Not found: ${ROOT}`);
  process.exit(1);
}

walk(ROOT);
if (DRY) console.log('DRY-RUN only; no files were written.');
