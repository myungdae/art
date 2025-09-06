#!/usr/bin/env node
/* One-shot fixer for Pug shorthand classes that break with Tailwind variant/decimal/bracket classes.
 * - ".grid.md:grid-cols-3.gap-4"      -> div(class="grid md:grid-cols-3 gap-4")
 * - "p.text-sm.mt-0.5= expr"          -> p(class="text-sm mt-0.5")= expr
 * - 속성(...)이 이미 있는 줄은 SKIP (경고 출력)
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const TARGET_DIR = path.join(ROOT, 'views');
const DRY = process.argv.includes('--dry');

const files = [];
(function walk(dir){
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules') continue;
    const fp = path.join(dir, name);
    const st = fs.statSync(fp);
    if (st.isDirectory()) walk(fp);
    else if (st.isFile() && name.endsWith('.pug')) files.push(fp);
  }
})(TARGET_DIR);

let changedFiles = 0, changedLines = 0, skipped = 0;

function classesFromDotChain(dotChain){
  // ".a.b.c" => "a b c" (콜론/대괄호/소수점 포함 그대로)
  return dotChain.split('.').filter(Boolean).join(' ');
}

for (const fp of files) {
  const src = fs.readFileSync(fp, 'utf8');
  const lines = src.split(/\r?\n/);
  let touched = false;

  for (let i=0; i<lines.length; i++){
    const orig = lines[i];
    let line = orig;

    // 1) 클래스만 있는 줄:  "  .grid.md:grid-cols-3.gap-4"
    //   -> "  div(class="grid md:grid-cols-3 gap-4")"
    let m1 = line.match(/^(\s*)(\.(?:[\w:\-\.\[\]]+))+(\s*)$/);
    if (m1) {
      const indent = m1[1] || '';
      const clsChain = line.trim().replace(/^\./, '');
      const cls = classesFromDotChain('.' + clsChain);
      const repl = `${indent}div(class="${cls}")`;
      if (!DRY) lines[i] = repl;
      else console.log(`[DRY] ${fp}:${i+1}\n  - ${orig}\n  + ${repl}`);
      touched = true; changedLines++; continue;
    }

    // 2) 태그 + 축약 클래스: "  p.text-sm.mt-0.5= ..."
    //    기존 속성(...) 있으면 위험하니 SKIP
    let m2 = line.match(/^(\s*)([a-zA-Z][\w-]*)(\.(?:[\w:\-\.\[\]]+)+)(\s*(?:=.*|$))/);
    if (m2) {
      const indent = m2[1] || '';
      const tag    = m2[2];
      const dotCls = m2[3];
      const tail   = m2[4] || '';

      if (/\(\s*.*\)/.test(tail) || /^\s*\(/.test(tail)) {
        console.warn(`[SKIP:has-attrs] ${fp}:${i+1}  -> ${line.trim()}`);
        skipped++; continue;
      }

      const cls = classesFromDotChain(dotCls);
      const repl = `${indent}${tag}(class="${cls}")${tail}`;
      if (!DRY) lines[i] = repl;
      else console.log(`[DRY] ${fp}:${i+1}\n  - ${orig}\n  + ${repl}`);
      touched = true; changedLines++; continue;
    }
  }

  if (touched) {
    changedFiles++;
    if (!DRY) {
      const backup = fp + '.bak.autofix';
      if (!fs.existsSync(backup)) fs.writeFileSync(backup, src, 'utf8');
      fs.writeFileSync(fp, lines.join('\n'), 'utf8');
    }
  }
}

console.log(`\nDone. Files changed: ${changedFiles}, lines changed: ${changedLines}, skipped (has attrs): ${skipped}`);
if (DRY) console.log('DRY-RUN only; no files were written.');
