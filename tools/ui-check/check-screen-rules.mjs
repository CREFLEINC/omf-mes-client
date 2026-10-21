#!/usr/bin/env node
/**
 * 화면 구성 규범(docs/screen-composition.md) 정적 검사.
 *
 * 화면 코드에서 규범 위반 패턴을 찾아 규칙 번호와 위치로 보고한다. .ts, .tsx는 저장소의 typescript
 * 파서로 읽어 JSX 요소와 문자열 단위로 보고, .css는 줄 단위로 본다.
 * 이미 있는 위반은 기준선(baseline.json)에 위반 하나마다 지문(규칙, 파일, 정규화한 줄 글의 해시)으로
 * 기록한다. 줄 번호는 지문에 넣지 않으므로 위아래 줄이 바뀌어도 같은 위반으로 본다. 기준선에 없는
 * 지문이 하나라도 있으면 실패한다. 위반 하나를 고치고 다른 위반을 더해도 새 지문으로 잡힌다.
 * 기준선은 줄이기만 한다(--update-baseline은 사라진 지문만 지우고, 새 지문은 더하지 않는다).
 *
 * 사용:
 *   node tools/ui-check/check-screen-rules.mjs                 전체 검사, 새 위반이 있으면 종료 코드 1
 *   node tools/ui-check/check-screen-rules.mjs --list          위반 목록 전체 출력
 *   node tools/ui-check/check-screen-rules.mjs --init-baseline 현재 위반으로 기준선 생성(처음 한 번, 파일이 있으면 거부)
 *   node tools/ui-check/check-screen-rules.mjs --init-baseline --force  기준선을 새로 만든다(기존 파일을 덮어씀)
 *   node tools/ui-check/check-screen-rules.mjs --update-baseline 고친 위반의 지문만 기준선에서 지움
 *
 * 종료 코드: 0 새 위반 없음, 1 새 위반 있음, 2 검사를 할 수 없음(DS CSS 없음, 기준선 형식 오류 등).
 *
 * 패턴 검사라 오탐이 있을 수 있다. 의도한 예외는 해당 줄 끝에 `ui-check-ignore: <규칙 번호> <사유>` 주석을 단다.
 * 여러 줄에 걸친 JSX 요소는 요소가 걸친 줄이나 바로 위 주석 줄에 달면 된다.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const BASELINE = path.join(HERE, 'baseline.json');
const SCAN_DIRS = ['apps/web/src', 'apps/mobile/src', 'packages/ui/src'];
const I18N_DIR = 'packages/i18n/src/ko';

// 저장소에 이미 있는 typescript 패키지를 저장소 루트 기준으로 찾는다.
let ts;
try {
  ts = createRequire(path.join(ROOT, 'package.json'))('typescript');
} catch {
  console.error(
    '검사 불가: 저장소 루트에서 typescript 패키지를 찾지 못했습니다. pnpm install을 먼저 하세요.',
  );
  process.exit(2);
}

/** 화면 문구에 영어로 남겨도 되는 업무 용어와 고유 명칭(C-13). 설계 용어집에서 영어로 정한 것만 더한다. */
const BUSINESS_TERMS = [
  'W/O',
  'P/O',
  'G/R',
  'ERP',
  'MES',
  'BOM',
  'Routing',
  'LOT',
  'Lot',
  'Status',
  'IQC',
  'OQC',
  'PQC',
  '4M',
  'EA',
  'PDA',
  'POP',
  'ID',
  'QR',
  'Rev',
  'Import',
  'Location',
  'Release',
  'Hold',
  'Enter',
  'Zalo',
  'Electron',
];
const ENGLISH_WORD = new RegExp(
  String.raw`(^|[\s(])(?!(?:${BUSINESS_TERMS.map((t) => t.replace('/', '\/')).join('|')})\b)[A-Z][a-z]{3,}`,
);
/**
 * 화면에 노출되면 안 되는 개발 사정 표현(C-13, C-4 「준비 중」 버튼 금지). 오탐은 줄 끝 ui-check-ignore로 표시한다.
 * 업무 용어와 겹치는 낱말은 넣지 않는다. 「임시」는 「임시 위치 적재」, 「임시 적치」처럼 업무 이름이라 단독으로 넣지 않는다.
 */
const DEV_PHRASES = [
  '서버가 아직', // 서버 지원 여부를 알리는 문장(C-13 예시)
  '아직 확정되지 않은', // 계약 미확정을 알리는 문장(C-13 예시)
  '응답에 ', // 응답 구조를 설명하는 문장(C-13 예시)
  '해석하지 않고', // 화면 처리 방식을 설명하는 문장(C-13 예시)
  '규약', // 연동 규약 설명
  'API', // 내부 연동 이름
  '스키마', // 데이터 구조 설명
  '계약이 ', // 연동 계약 설명
  '개발 중', // 미완성 기능 안내
  '준비 중', // 「준비 중」 버튼과 칸(C-4에서 금지)
  '구현 예정', // 미완성 기능 안내
  '업데이트 예정', // 미완성 기능 안내(문구 리소스에 「업데이트 예정입니다」 사례가 있음)
  '미구현', // 미완성 기능 안내
  'TODO', // 개발 메모가 문구로 남은 것. 주석은 파서가 빼므로 문자열 안의 것만 잡는다
  '임시 목록', // 계약 미확정 목록 안내(C-13 예시 「아직 확정되지 않은 임시 목록」)
];
const SCREEN_DIRS = ['apps/web/src/screens', 'apps/mobile/src/screens'];
const SHARED_NAMES = new Set([
  'page-nav.tsx',
  'pagination.ts',
  'load-error-banner.tsx',
  'select-field.tsx',
]);
/** 화면에 보이는 글을 받는 속성(C-13 영어 낱말, 개발 사정 표현). children 글은 JSX 글로 따로 본다. */
const VISIBLE_PROPS = new Set(['label', 'title', 'placeholder', 'aria-label']);
/** 브라우저 기본 날짜, 일시, 시각 입력(C-12). */
const NATIVE_DATE_TYPES = new Set(['date', 'datetime-local', 'time']);
/** 행 선택 버튼 열로 보는 열 키(C-1). */
const SELECT_KEYS = new Set(['select', 'pick', 'choose']);
/** 직접 지정한 색(COLOR). var() 대체값 안의 색은 토큰 정의 쪽 문제라 뺀다. */
const RAW_COLOR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(\s*(?!var\()/;
const stripVarFallback = (s) => s.replace(/var\([^)]*\)/g, ' ');

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
// 규칙 번호를 정확히 맞춘다. `ui-check-ignore: C-12`가 C-1을 면제하지 않도록 뒤에 숫자가 이어지면 다른 번호로 본다.
const ignored = (line, rule) =>
  new RegExp(`ui-check-ignore:\\s*${rule.replace('-', '\\-')}(?![0-9A-Za-z])`).test(line);
const isCommentLine = (l) => /^\s*(\/\/|\*|\/\*)/.test(l);

/** DS와 앱이 정의한 CSS 사용자 정의 속성 이름. DS CSS를 찾지 못하면 검사를 멈춘다. */
const definedTokens = () => {
  const names = new Set();
  // DS 패키지는 앱 워크스페이스의 node_modules 링크로 찾는다(walk는 node_modules를 건너뛰므로 직접 연다).
  const dsDirs = ['apps/web', 'apps/mobile', 'packages/ui', '.']
    .map((d) => path.join(ROOT, d, 'node_modules', '@crefle', 'web-ui'))
    .filter((d) => existsSync(d));
  const walkAll = (dir) =>
    readdirSync(dir).flatMap((n) => {
      const full = path.join(dir, n);
      return statSync(full).isDirectory() ? walkAll(full) : [full];
    });
  const dsRoots = [...new Set(dsDirs.flatMap((d) => walkAll(d)).filter((f) => f.endsWith('.css')))];
  if (!dsRoots.length) {
    console.error(
      '검사 불가: @crefle/web-ui CSS를 찾지 못해 토큰 검사를 할 수 없습니다. pnpm install을 먼저 하세요.',
    );
    process.exit(2);
  }
  const appFiles = SCAN_DIRS.flatMap((d) => walk(path.join(ROOT, d)));
  for (const f of [...dsRoots, ...appFiles.filter((x) => x.endsWith('.css'))]) {
    for (const m of readFileSync(f, 'utf8').matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)) names.add(m[1]);
  }
  // 화면 코드가 style 객체로 정하는 사용자 정의 속성(예: style={{ '--pop-reg-scale': scale }}).
  for (const f of appFiles.filter((x) => /\.tsx?$/.test(x))) {
    for (const m of readFileSync(f, 'utf8').matchAll(/['"](--[a-zA-Z0-9-]+)['"]\s*[:,]/g))
      names.add(m[1]);
  }
  if (!names.size) {
    console.error('검사 불가: DS CSS에서 토큰 정의를 하나도 읽지 못했습니다.');
    process.exit(2);
  }
  return names;
};

const RULES = {
  'C-1': '선택 버튼 열(행 전체 클릭으로 바꾼다)',
  'C-12': '브라우저 기본 날짜, 일시, 시각 입력(DatePicker, DateTimeField를 쓴다)',
  'C-13': '화면 문구의 개발 사정 표현, 가운뎃점 나열, 영어 낱말',
  'C-8': '화면 폴더 안 공용 부품 복제본(patterns/ 공용 부품을 쓴다)',
  'C-4': '사유 연결 없는 비활성 주 동작(aria-describedby로 사유를 잇는다)',
  TOKEN: '정의되지 않은 CSS 토큰(대체값이 있어도 위반)',
  COLOR: '직접 지정한 색(DS 토큰을 쓴다)',
};

const findings = [];
const squash = (s) => s.replace(/\s+/g, ' ').trim();
/** key는 지문에 쓰는 글이다. 줄 번호를 넣지 않아 줄이 밀려도 같은 지문이 된다. */
const add = (rule, file, line, text, key = text) =>
  findings.push({
    rule,
    file: rel(file),
    line,
    text: squash(text).slice(0, 120),
    key: squash(key).slice(0, 400),
  });

const files = SCAN_DIRS.flatMap((d) => walk(path.join(ROOT, d))).filter((f) => !isTest(f));
const tokens = definedTokens();

// ── 파서 도우미 ─────────────────────────────────────────────
const parse = (f, src) =>
  ts.createSourceFile(
    f,
    src,
    ts.ScriptTarget.Latest,
    true,
    f.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
const lineOf = (sf, pos) => sf.getLineAndCharacterOfPosition(pos).line + 1;
const span = (sf, node) => [lineOf(sf, node.getStart(sf)), lineOf(sf, node.getEnd())];
/** 노드가 걸친 줄과 바로 위 주석 줄 중 하나에 예외 주석이 있는가. */
const ignoredNode = (sf, lines, node, rule) => {
  const [a, b] = span(sf, node);
  for (let i = a; i <= b; i++) if (ignored(lines[i - 1] ?? '', rule)) return true;
  const prev = lines[a - 2] ?? '';
  return isCommentLine(prev) && ignored(prev, rule);
};
const visit = (node, fn) => {
  fn(node);
  ts.forEachChild(node, (c) => visit(c, fn));
};
const tagName = (el) => el.tagName.getText();
const attrsOf = (el) => {
  const map = new Map();
  for (const p of el.attributes.properties) if (ts.isJsxAttribute(p)) map.set(p.name.getText(), p);
  return map;
};
const isStr = (n) => ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n);
/** 식 안의 문자열 조각(조건식의 갈래 포함). 템플릿의 ${...} 자리는 X로 둔다. */
const stringsIn = (expr) => {
  const out = [];
  if (!expr) return out;
  visit(expr, (n) => {
    if (isStr(n)) out.push(n.text);
    else if (ts.isTemplateExpression(n))
      out.push(n.head.text + n.templateSpans.map((s) => `X${s.literal.text}`).join(''));
  });
  return out;
};
/** 값으로 쓰이는 문자열(조건식 갈래, 문자열 잇기, ?? 포함). 함수 호출 인자나 비교 값은 넣지 않는다. */
const valueStrings = (e) => {
  if (!e) return [];
  if (ts.isParenthesizedExpression(e) || ts.isAsExpression(e)) return valueStrings(e.expression);
  if (isStr(e)) return [textOf(e)];
  // 템플릿의 ${...} 자리에 든 문자열(예: `${'Cancel'}`)도 화면에 그대로 보이므로 따로 꺼낸다.
  if (ts.isTemplateExpression(e))
    return [textOf(e), ...e.templateSpans.flatMap((s) => valueStrings(s.expression))];
  if (ts.isConditionalExpression(e))
    return [...valueStrings(e.whenTrue), ...valueStrings(e.whenFalse)];
  if (ts.isBinaryExpression(e) && /^(\+|\?\?|\|\||&&)$/.test(e.operatorToken.getText()))
    return [...valueStrings(e.left), ...valueStrings(e.right)];
  return [];
};
/** style 속성 안의 노드인가. */
const inStyleAttr = (n) => {
  for (let p = n.parent; p; p = p.parent)
    if (ts.isJsxAttribute(p)) return p.name.getText() === 'style';
  return false;
};
/** JSX 속성 값을 식으로 꺼낸다. 값이 없으면(예: disabled) null. */
const attrExpr = (a) => {
  if (!a?.initializer) return null;
  return ts.isJsxExpression(a.initializer) ? a.initializer.expression : a.initializer;
};
/** 문자열 노드의 글. 템플릿은 ${...} 자리를 X로 둔다. */
const textOf = (n) => {
  if (isStr(n)) return n.text;
  if (ts.isTemplateExpression(n))
    return n.head.text + n.templateSpans.map((s) => `X${s.literal.text}`).join('');
  return null;
};
/** 코드 쪽 문자열(가져오기 경로, 타입 위치, 속성 이름, 비교 값)은 화면 문구가 아니다. */
const isCodeString = (n) => {
  const p = n.parent;
  if (!p) return false;
  return (
    ts.isImportDeclaration(p) ||
    ts.isExportDeclaration(p) ||
    ts.isExternalModuleReference(p) ||
    ts.isLiteralTypeNode(p) ||
    (ts.isPropertyAssignment(p) && p.name === n) ||
    ts.isElementAccessExpression(p) ||
    ts.isCaseClause(p) ||
    (ts.isCallExpression(p) && /^(require|import)$/.test(p.expression.getText())) ||
    (ts.isBinaryExpression(p) && /^(===|!==|==|!=)$/.test(p.operatorToken.getText()))
  );
};
/** 화면 문구 검사(C-13): 개발 사정 표현, 영어 낱말. 가운뎃점은 모든 문자열에서 따로 본다. */
const wording = (s) => {
  if (DEV_PHRASES.some((ph) => s.includes(ph))) return '개발 사정 표현';
  if (ENGLISH_WORD.test(s.replace(/X/g, ' '))) return '영어 낱말';
  return null;
};

/** JSX 속성 값이 참일 수 있는가. disabled={false}는 거짓, 값 없음과 {true}는 참, 그 밖의 식은 참일 수 있음으로 본다. */
const maybeTrue = (a) => {
  if (!a) return false;
  const e = attrExpr(a);
  if (!e) return true;
  if (e.kind === ts.SyntaxKind.FalseKeyword) return false;
  return true;
};
/** variant가 채움일 수 있는가. 없음은 기본값 filled, 문자열 식은 갈래 중 filled가 있으면, 문자열이 없는 식은 알 수 없어 채움일 수 있음으로 본다. */
const maybeFilled = (a) => {
  if (!a) return true;
  const strs = valueStrings(attrExpr(a));
  return strs.length === 0 || strs.includes('filled');
};

const scanTs = (f, src, lines) => {
  const sf = parse(f, src);
  visit(sf, (n) => {
    // C-4: 채움(기본값 포함) 버튼이 비활성일 수 있는데 aria-describedby가 없으면 위반.
    if ((ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) && tagName(n) === 'Button') {
      const at = attrsOf(n);
      // 저장, 전송 중의 일시 비활성(loading과 함께 쓰는 경우)은 사유를 붙일 대상이 아니다.
      if (
        maybeTrue(at.get('disabled')) &&
        !at.has('aria-describedby') &&
        !at.has('loading') &&
        maybeFilled(at.get('variant')) &&
        !ignoredNode(sf, lines, n, 'C-4')
      ) {
        add('C-4', f, lineOf(sf, n.getStart(sf)), n.getText(sf).slice(0, 110), n.getText(sf));
      }
    }
    // C-12: type="date", type={'datetime-local'}, type={"time"}, 조건식 갈래 포함.
    if (
      ts.isJsxAttribute(n) &&
      n.name.getText() === 'type' &&
      valueStrings(attrExpr(n)).some((s) => NATIVE_DATE_TYPES.has(s)) &&
      !ignoredNode(sf, lines, n, 'C-12')
    )
      add(
        'C-12',
        f,
        lineOf(sf, n.getStart(sf)),
        lines[lineOf(sf, n.getStart(sf)) - 1],
        n.getText(sf),
      );
    // C-12: 객체 속성 type: 'date' 형태(입력 칸 설정 객체).
    if (
      ts.isPropertyAssignment(n) &&
      n.name.getText().replace(/['"]/g, '') === 'type' &&
      isStr(n.initializer) &&
      NATIVE_DATE_TYPES.has(n.initializer.text) &&
      !ignoredNode(sf, lines, n, 'C-12')
    )
      add('C-12', f, lineOf(sf, n.getStart(sf)), n.getText(sf));
    // C-1: 표 열 정의 객체 { key, render }에서 선택 버튼 열. 첫 열 체크박스(여러 건 선택)는 허용이라 Button이 있는 열만 본다.
    if (ts.isObjectLiteralExpression(n)) {
      const prop = (name) =>
        n.properties.find(
          (p) => ts.isPropertyAssignment(p) && p.name.getText().replace(/['"]/g, '') === name,
        );
      const key = prop('key');
      const render = n.properties.find((p) => p.name?.getText() === 'render');
      if (key && isStr(key.initializer) && render) {
        const buttons = [];
        visit(render, (x) => {
          if (
            (ts.isJsxOpeningElement(x) || ts.isJsxSelfClosingElement(x)) &&
            /^(Button|button)$/.test(tagName(x))
          )
            buttons.push(x);
        });
        // 버튼 글이 「선택」이거나, 글이나 접근 이름이 select, pick, choose 문구 키를 가리키는 버튼.
        const children = (b) =>
          ts.isJsxOpeningElement(b) ? b.parent.children.map((c) => c.getText(sf)).join(' ') : '';
        const selectText = (b) =>
          /(^|[\s{])선택($|[\s}])|\.(select|pick|choose)\b/.test(
            squash(`${children(b)} ${attrExpr(attrsOf(b).get('aria-label'))?.getText(sf) ?? ''}`),
          );
        const isLast = ts.isArrayLiteralExpression(n.parent) && n.parent.elements.at(-1) === n;
        const hit =
          (SELECT_KEYS.has(key.initializer.text) && buttons.length) ||
          (isLast && buttons.some(selectText));
        if (hit && !ignoredNode(sf, lines, key, 'C-1'))
          add(
            'C-1',
            f,
            lineOf(sf, key.getStart(sf)),
            `${key.getText(sf)} (선택 버튼 열)`,
            n.getText(sf),
          );
      }
    }
    // COLOR: style={...} 안의 문자열, 색 이름 속성(color, background 등)의 문자열에 직접 지정한 색.
    if (ts.isJsxAttribute(n) && n.name.getText() === 'style') {
      for (const s of stringsIn(attrExpr(n))) {
        if (RAW_COLOR.test(stripVarFallback(s)) && !ignoredNode(sf, lines, n, 'COLOR'))
          add('COLOR', f, lineOf(sf, n.getStart(sf)), `${s} (style)`, `${n.getText(sf)}|${s}`);
      }
    }
    if (
      ts.isPropertyAssignment(n) &&
      /color|background|border|fill|stroke|shadow|outline/i.test(n.name.getText()) &&
      !inStyleAttr(n)
    ) {
      const t = textOf(n.initializer);
      if (t !== null && RAW_COLOR.test(stripVarFallback(t)) && !ignoredNode(sf, lines, n, 'COLOR'))
        add('COLOR', f, lineOf(sf, n.getStart(sf)), n.getText(sf));
    }
    // C-13: 문자열을 가운뎃점으로 잇는 곳(예: `${code} · ${name}`, '계획 · 배포', join(' · ')).
    const t = isStr(n) || ts.isTemplateExpression(n) ? textOf(n) : ts.isJsxText(n) ? n.text : null;
    if (t !== null && t.includes('·') && !isCodeString(n) && !ignoredNode(sf, lines, n, 'C-13')) {
      add(
        'C-13',
        f,
        lineOf(sf, n.getStart(sf)),
        `가운뎃점: ${lines[lineOf(sf, n.getStart(sf)) - 1]}`,
        `·|${n.getText(sf)}`,
      );
      return;
    }
    // C-13: 화면에 보이는 글(JSX 글, {'…'} 자식, label, title, placeholder, aria-label 값)의 개발 사정 표현과 영어 낱말.
    let visible = [];
    if (ts.isJsxText(n) && n.text.trim()) visible = [n.text.trim()];
    else if (ts.isJsxExpression(n) && (ts.isJsxElement(n.parent) || ts.isJsxFragment(n.parent)))
      visible = valueStrings(n.expression);
    else if (ts.isJsxAttribute(n) && VISIBLE_PROPS.has(n.name.getText()))
      visible = valueStrings(attrExpr(n));
    else if (ts.isPropertyAssignment(n) && VISIBLE_PROPS.has(n.name.getText().replace(/['"]/g, '')))
      visible = valueStrings(n.initializer);
    for (const s of visible) {
      const why = wording(s);
      if (why && !ignoredNode(sf, lines, n, 'C-13')) {
        add('C-13', f, lineOf(sf, n.getStart(sf)), `${why}: ${s}`, `${why}|${n.getText(sf)}`);
        break;
      }
    }
  });
};

for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const lines = src.split('\n');
  const isTsx = f.endsWith('.tsx') || f.endsWith('.ts');
  const isCss = f.endsWith('.css');

  if (isTsx) scanTs(f, src, lines);

  if (
    SCREEN_DIRS.some((d) => f.startsWith(path.join(ROOT, d))) &&
    SHARED_NAMES.has(path.basename(f))
  ) {
    add('C-8', f, 1, path.basename(f));
  }

  if (isCss || isTsx) {
    lines.forEach((l, i) => {
      if (isCommentLine(l)) return;
      // 대체값이 있어도(var(--x, 8px)) 토큰이 정의되지 않았으면 위반이다. 대체값은 화면마다 값이 갈라지는 원인이다.
      for (const m of l.matchAll(/var\((--[a-zA-Z0-9-]+)/g)) {
        if (!tokens.has(m[1]) && !ignored(l, 'TOKEN')) add('TOKEN', f, i + 1, l, `${m[1]}|${l}`);
      }
      // 토큰 정의 줄은 제외하고, 선언 값 안의 16진 색과 rgb(), hsl()을 본다. var() 대체값 안의 색은 뺀다.
      const decl = l.match(/:\s*([^;{]*)/);
      if (
        isCss &&
        decl &&
        !/^\s*--/.test(l) &&
        RAW_COLOR.test(stripVarFallback(decl[1])) &&
        !ignored(l, 'COLOR')
      )
        add('COLOR', f, i + 1, l);
    });
  }
}

// C-13: 한국어 화면 문구 리소스. 문구 파일의 문자열 값은 모두 화면 문구다(주석은 파서가 뺀다).
for (const f of walk(path.join(ROOT, I18N_DIR)).filter((x) => x.endsWith('.ts') && !isTest(x))) {
  const src = readFileSync(f, 'utf8');
  const lines = src.split('\n');
  const sf = parse(f, src);
  visit(sf, (n) => {
    if (!(isStr(n) || ts.isTemplateExpression(n)) || isCodeString(n)) return;
    const s = textOf(n);
    const line = lineOf(sf, n.getStart(sf));
    if (ignoredNode(sf, lines, n, 'C-13')) return;
    // 문구 안의 가운뎃점 나열(라벨, 제목, 버튼, 화면 이름). 숫자 사이 곱셈 기호 등 오탐은 ui-check-ignore로 표시한다.
    const why = DEV_PHRASES.some((ph) => s.includes(ph))
      ? '개발 사정 표현'
      : /[가-힣A-Za-z0-9)X]\s*·\s*[가-힣A-Za-z0-9(X]/.test(s)
        ? '가운뎃점'
        : // 영어 낱말(업무 약어 제외). 값이 영어 낱말 하나로만 된 문구를 잡는다(예: 'Machine', 'Validation 다시 실행').
          ENGLISH_WORD.test(s.replace(/X/g, ' '))
          ? '영어 낱말'
          : null;
    if (why) add('C-13', f, line, `${why}: ${lines[line - 1]}`, `${why}|${n.getText(sf)}`);
  });
}

// ── 기준선: 위반 지문(규칙|파일|글 해시)별 개수 ─────────────────
const fp = (x) =>
  `${x.rule}|${x.file}|${createHash('sha1').update(x.key).digest('hex').slice(0, 12)}`;
const current = {};
for (const x of findings) {
  const k = fp(x);
  current[k] ??= { n: 0, text: x.text };
  current[k].n += 1;
}

const args = new Set(process.argv.slice(2));
const save = (obj) => {
  const sorted = Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(BASELINE, JSON.stringify({ version: 2, fingerprints: sorted }, null, 1) + '\n');
};
if (args.has('--init-baseline')) {
  if (existsSync(BASELINE) && !args.has('--force')) {
    console.error(
      `기준선이 이미 있습니다(${rel(BASELINE)}). 새 위반을 기준선에 넣지 않도록 덮어쓰기를 막습니다. 정말 새로 만들려면 --force를 함께 주세요.`,
    );
    process.exit(2);
  }
  save(current);
  console.log(`기준선 생성: 위반 ${findings.length}건, 지문 ${Object.keys(current).length}개`);
  process.exit(0);
}

let baseline = {};
if (existsSync(BASELINE)) {
  const raw = JSON.parse(readFileSync(BASELINE, 'utf8'));
  if (raw.version !== 2 || !raw.fingerprints) {
    console.error(
      '검사 불가: 기준선이 예전 형식(파일별 개수)입니다. 기준 커밋에서 --init-baseline --force로 다시 만드세요.',
    );
    process.exit(2);
  }
  baseline = raw.fingerprints;
}
const grown = Object.entries(current).filter(([k, v]) => v.n > (baseline[k]?.n ?? 0));
const shrunk = Object.entries(baseline).filter(([k, v]) => (current[k]?.n ?? 0) < v.n);

const summary = {};
for (const x of findings) summary[x.rule] = (summary[x.rule] ?? 0) + 1;
console.log('규칙별 위반 수:');
for (const [r, n] of Object.entries(summary))
  console.log(`  ${r.padEnd(6)} ${String(n).padStart(4)}  ${RULES[r]}`);

if (args.has('--list'))
  for (const x of findings) console.log(`${x.rule}\t${x.file}:${x.line}\t${x.text}`);

if (args.has('--update-baseline')) {
  // 고친 지문만 지우거나 개수를 낮춘다. 새 지문은 더하지 않는다.
  const next = { ...baseline };
  for (const [k] of shrunk) {
    if (current[k]) next[k] = { ...next[k], n: current[k].n };
    else delete next[k];
  }
  save(next);
  console.log(`기준선 갱신: 줄어든 지문 ${shrunk.length}개`);
}

if (grown.length) {
  const extra = grown.reduce((s, [k, v]) => s + v.n - (baseline[k]?.n ?? 0), 0);
  console.log(`\n새 위반이 있습니다(${extra}건). 규칙 번호는 docs/screen-composition.md를 보세요.`);
  for (const [k] of grown) {
    for (const x of findings.filter((y) => fp(y) === k))
      console.log(`  ${x.rule}\t${x.file}:${x.line}\t${x.text}`);
  }
  process.exit(1);
}
console.log(
  shrunk.length
    ? `\n새 위반 없음. 기준선보다 줄어든 지문 ${shrunk.length}개(--update-baseline으로 반영)`
    : '\n새 위반 없음.',
);
