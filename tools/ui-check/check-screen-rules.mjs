#!/usr/bin/env node
/**
 * 화면 구성 규범(docs/screen-composition.md) 정적 검사.
 *
 * 화면 코드에서 규범 위반 패턴을 찾아 규칙 번호와 위치로 보고한다. 이미 있는 위반은 기준선
 * (baseline.json)에 파일별 개수로 기록하고, 기준선보다 늘어난 파일이 있으면 실패한다.
 * 기준선은 줄이기만 한다(--update-baseline은 개수가 줄었을 때만 기록을 낮춘다).
 *
 * 사용:
 *   node tools/ui-check/check-screen-rules.mjs                 전체 검사, 새 위반이 있으면 종료 코드 1
 *   node tools/ui-check/check-screen-rules.mjs --list          위반 목록 전체 출력
 *   node tools/ui-check/check-screen-rules.mjs --init-baseline 현재 위반으로 기준선 생성(처음 한 번)
 *   node tools/ui-check/check-screen-rules.mjs --update-baseline 줄어든 개수만 기준선에 반영
 *
 * 패턴 검사라 오탐이 있을 수 있다. 의도한 예외는 해당 줄 끝에 `ui-check-ignore: <규칙 번호> <사유>` 주석을 단다.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const BASELINE = path.join(HERE, 'baseline.json');
const SCAN_DIRS = ['apps/web/src', 'apps/mobile/src', 'packages/ui/src'];
const SCREEN_DIRS = ['apps/web/src/screens', 'apps/mobile/src/screens'];
const SHARED_NAMES = new Set(['page-nav.tsx', 'pagination.ts', 'load-error-banner.tsx', 'select-field.tsx']);

const walk = (dir) => {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
};

const rel = (f) => path.relative(ROOT, f);
const isTest = (f) => /\.(test|spec)\.[tj]sx?$/.test(f) || f.includes(`${path.sep}test${path.sep}`);
const ignored = (line, rule) => new RegExp(`ui-check-ignore:\\s*${rule.replace('-', '\\-')}`).test(line);

/** DS와 앱이 정의한 CSS 사용자 정의 속성 이름. */
const definedTokens = () => {
  const names = new Set();
  // DS 패키지는 앱 워크스페이스의 node_modules 링크로 찾는다(walk는 node_modules를 건너뛰므로 직접 연다).
  const dsDirs = ['apps/web', 'apps/mobile', 'packages/ui', '.']
    .map((d) => path.join(ROOT, d, 'node_modules', '@crefle', 'web-ui'))
    .filter((d) => existsSync(d));
  const walkAll = (dir) => readdirSync(dir).flatMap((n) => {
    const full = path.join(dir, n);
    return statSync(full).isDirectory() ? walkAll(full) : [full];
  });
  const dsRoots = dsDirs.length ? walkAll(dsDirs[0]).filter((f) => f.endsWith('.css')) : [];
  if (!dsRoots.length) console.warn('경고: @crefle/web-ui CSS를 찾지 못해 토큰 검사가 부정확합니다. pnpm install을 먼저 하세요.');
  const appCss = SCAN_DIRS.flatMap((d) => walk(path.join(ROOT, d))).filter((f) => f.endsWith('.css'));
  for (const f of [...dsRoots, ...appCss]) {
    for (const m of readFileSync(f, 'utf8').matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)) names.add(m[1]);
  }
  return names;
};

const RULES = {
  'C-1': '표 끝 열 선택 버튼(행 전체 클릭으로 바꾼다)',
  'C-12': '브라우저 기본 날짜 입력(DatePicker를 쓴다)',
  'C-8': '화면 폴더 안 공용 부품 복제본(patterns/ 공용 부품을 쓴다)',
  'C-4': '사유 연결 없는 비활성 주 동작(aria-describedby로 사유를 잇는다)',
  'TOKEN': '정의되지 않은 CSS 토큰',
  'COLOR': '직접 지정한 색(DS 토큰을 쓴다)',
};

const findings = [];
const add = (rule, file, line, text) => findings.push({ rule, file: rel(file), line, text: text.trim().slice(0, 120) });

const files = SCAN_DIRS.flatMap((d) => walk(path.join(ROOT, d))).filter((f) => !isTest(f));
const tokens = definedTokens();

for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const lines = src.split('\n');
  const isTsx = f.endsWith('.tsx') || f.endsWith('.ts');
  const isCss = f.endsWith('.css');

  if (isTsx) {
    lines.forEach((l, i) => {
      if (/key:\s*['"](select|pick|choose)['"]/.test(l) && !ignored(l, 'C-1')) add('C-1', f, i + 1, l);
      if (/type=["'](date|datetime-local)["']|type:\s*['"](date|datetime-local)['"]/.test(l) && !ignored(l, 'C-12')) add('C-12', f, i + 1, l);
    });
    // <Button ...> 요소 단위로 본다. 채움(기본값 포함) 버튼이 disabled인데 aria-describedby가 없으면 위반.
    for (const m of src.matchAll(/<Button\b([\s\S]*?)>/g)) {
      const attrs = m[1];
      if (!/\bdisabled\b/.test(attrs) || /aria-describedby/.test(attrs)) continue;
      // 저장, 전송 중의 일시 비활성(loading과 함께 쓰는 경우)은 사유를 붙일 대상이 아니다.
      if (/\bloading=/.test(attrs)) continue;
      const variant = attrs.match(/variant=["'{]+([a-z]+)/);
      if (variant && variant[1] !== 'filled') continue;
      const lineNo = src.slice(0, m.index).split('\n').length;
      if (ignored(lines[lineNo - 1] ?? '', 'C-4')) continue;
      add('C-4', f, lineNo, `<Button${attrs.replace(/\s+/g, ' ').slice(0, 100)}`);
    }
  }

  if (SCREEN_DIRS.some((d) => f.startsWith(path.join(ROOT, d))) && SHARED_NAMES.has(path.basename(f))) {
    add('C-8', f, 1, path.basename(f));
  }

  if (isCss || isTsx) {
    lines.forEach((l, i) => {
      for (const m of l.matchAll(/var\((--[a-zA-Z0-9-]+)\s*(,)?/g)) {
        if (!tokens.has(m[1]) && !m[2] && !ignored(l, 'TOKEN')) add('TOKEN', f, i + 1, l);
      }
      // 주석 줄과 토큰 정의 줄은 제외하고, 선언 값 안의 16진 색만 본다.
      const isComment = /^\s*(\/\*|\*|\/\/)/.test(l);
      if (isCss && !isComment && /:\s*[^;{]*#[0-9a-fA-F]{3,8}\b/.test(l) && !/^\s*--/.test(l) && !/var\(--[^)]*#/.test(l) && !ignored(l, 'COLOR')) add('COLOR', f, i + 1, l);
    });
  }
}

const countByFile = {};
for (const x of findings) {
  const k = `${x.rule}|${x.file}`;
  countByFile[k] = (countByFile[k] ?? 0) + 1;
}

const args = new Set(process.argv.slice(2));
if (args.has('--init-baseline')) {
  writeFileSync(BASELINE, JSON.stringify(countByFile, null, 1) + '\n');
  console.log(`기준선 생성: 위반 ${findings.length}건, 파일-규칙 ${Object.keys(countByFile).length}쌍`);
  process.exit(0);
}

const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {};
const grown = Object.entries(countByFile).filter(([k, n]) => n > (baseline[k] ?? 0));
const shrunk = Object.entries(baseline).filter(([k, n]) => (countByFile[k] ?? 0) < n);

const summary = {};
for (const x of findings) summary[x.rule] = (summary[x.rule] ?? 0) + 1;
console.log('규칙별 위반 수:');
for (const [r, n] of Object.entries(summary)) console.log(`  ${r.padEnd(6)} ${String(n).padStart(4)}  ${RULES[r]}`);

if (args.has('--list')) for (const x of findings) console.log(`${x.rule}\t${x.file}:${x.line}\t${x.text}`);

if (args.has('--update-baseline')) {
  const next = { ...baseline };
  for (const [k] of shrunk) {
    if (countByFile[k]) next[k] = countByFile[k];
    else delete next[k];
  }
  writeFileSync(BASELINE, JSON.stringify(next, null, 1) + '\n');
  console.log(`기준선 갱신: 줄어든 파일-규칙 ${shrunk.length}쌍`);
}

if (grown.length) {
  console.log(`\n새 위반이 있습니다(${grown.length}쌍). 규칙 번호는 docs/screen-composition.md를 보세요.`);
  for (const [k, n] of grown) {
    const [rule, file] = k.split('|');
    console.log(`  ${rule} ${file}: ${baseline[k] ?? 0} → ${n}`);
    for (const x of findings.filter((y) => y.rule === rule && y.file === file)) console.log(`    ${x.file}:${x.line}  ${x.text}`);
  }
  process.exit(1);
}
console.log(shrunk.length ? `\n새 위반 없음. 기준선보다 줄어든 곳 ${shrunk.length}쌍(--update-baseline으로 반영)` : '\n새 위반 없음.');
