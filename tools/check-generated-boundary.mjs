import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// gen:api 가 타입을 쓰는 위치이자 이 검사의 기본 대상. gen-api.mjs 가 이 상수를 출력 경로로 쓴다.
export const GENERATED_TYPES_PATH = path.join(
  repoRoot,
  'packages',
  'api-client',
  'src',
  'generated',
  'api.d.ts',
);

// 실패 목록에 붙일 발췌의 최대 길이 — 위치를 짚을 만큼만 보여 주고 본문을 통째로 흘리지 않는다.
const MAX_EXCERPT_LENGTH = 80;

/**
 * 생성물에 실려서는 안 되는 패턴 목록.
 *
 * openapi-typescript 는 계약 정본의 `description` 을 JSDoc 주석으로 **그대로** 옮긴다.
 * 이 저장소는 공개(public)이고 계약 정본은 비공개 설계 저장소에 있으므로, 정본에 적힌
 * 내부 문서 경로·설계 규칙 요약·설계 진행 상태가 그대로 공개된 적이 있다(omf-mes#92).
 *
 * 정리된 뒤의 `description` 은 공개돼도 되는 API 설명이고 편집기에서 보이는 값이 있다.
 * 그래서 주석을 통째로 지우지 않고 아래 패턴만 잡는다.
 *
 * 패턴을 늘릴 때는 이 배열에만 추가한다. 각 항목에 왜 금지인지(`reason`)를 반드시 남긴다 —
 * 검사에 걸린 사람이 「무엇을 고쳐야 하는가」를 메시지만 보고 알 수 있어야 한다.
 */
const FORBIDDEN_PATTERNS = [
  {
    name: '비공개 저장소 경로',
    // 설계 저장소의 산출물 디렉터리. 정본이 어떤 구조로 놓여 있는지가 드러난다.
    pattern: /deliverables\//,
    reason: '비공개 설계 저장소의 산출물 디렉터리 구조가 드러난다',
  },
  {
    name: '비공개 저장소 경로',
    // 설계 문서 디렉터리. 어느 문서에 무엇이 적혀 있는지를 가리킨다.
    pattern: /docs\//,
    reason: '비공개 설계 문서의 위치가 드러난다',
  },
  {
    name: '비공개 저장소 경로',
    // 계약 정본이 지금 놓여 있는 디렉터리. 위 둘은 자료가 옮겨지기 전 구조라 여기를 덮지 못한다.
    pattern: /api-contracts\//,
    reason: '비공개 설계 저장소의 계약 디렉터리 구조가 드러난다',
  },
  {
    name: '공유계약 본문 요약',
    // 괄호가 붙으면 식별자 참조가 아니라 규약 본문의 요약이다.
    // 식별자 단독(「근거: W-06-07 §5-3 · 공유계약 B-1」)은 정상 참조라 잡지 않는다.
    pattern: /공유계약 [A-K]-\d+\(/,
    reason: '식별자 참조가 아니라 비공개 공유계약 본문의 요약이다 — 식별자만 남긴다',
  },
  {
    name: '설계 진행 상태',
    // 무엇이 아직 확정되지 않았는지는 설계팀의 내부 진행 상태다.
    pattern: /미결/,
    reason: '설계가 아직 확정하지 못한 항목이 드러난다',
  },
  {
    name: '설계 진행 상태',
    // 설계가 아직 닿지 않은 범위. 위와 같은 이유로 공개 대상이 아니다.
    pattern: /미착지/,
    reason: '설계가 아직 다루지 않은 범위가 드러난다',
  },
  {
    name: '설계 일정·작업 분해',
    // Work Breakdown Structure — 설계팀의 일정과 작업 분해 구조.
    pattern: /WBS/,
    reason: '설계 일정과 작업 분해 구조가 드러난다',
  },
  {
    name: '설계 저장소 내부 작업 체계',
    // 설계 저장소 안에서만 통하는 작업 주체 이름.
    pattern: /통합 Agent/,
    reason: '설계 저장소 내부의 작업 체계 이름이 드러난다',
  },
  {
    name: '비공개 스키마 줄 번호',
    // 정본 DDL 파일의 줄 번호 참조. 비공개 스키마 파일의 내부 위치를 가리킨다.
    pattern: /SQL \d+ 주석/,
    reason: '비공개 스키마 파일의 줄 번호를 가리킨다',
  },
];

// 저장소 밖 파일을 검사하면 상대 경로가 ../ 로 길어져 읽기 어렵다 — 그때는 절대 경로를 그대로 쓴다.
const displayPathOf = (filePath) => {
  const relativePath = path.relative(repoRoot, filePath);
  return relativePath.startsWith('..') ? filePath : relativePath;
};

const excerptFrom = (line, index) => {
  const tail = line.slice(index).trimEnd();
  return tail.length > MAX_EXCERPT_LENGTH ? `${tail.slice(0, MAX_EXCERPT_LENGTH)}…` : tail;
};

/**
 * 소스에서 금지 패턴에 걸리는 위치를 모두 찾는다.
 * 한 줄에 여러 패턴이 걸리면 패턴마다 한 건씩 보고한다.
 */
export const findBoundaryViolations = (source) => {
  const violations = [];
  source.split('\n').forEach((line, index) => {
    for (const { name, pattern, reason } of FORBIDDEN_PATTERNS) {
      const match = pattern.exec(line);
      if (match === null) continue;
      violations.push({
        lineNumber: index + 1,
        patternName: name,
        reason,
        excerpt: excerptFrom(line, match.index),
      });
    }
  });
  return violations;
};

const HOW_TO_FIX = [
  '고치는 방법 — 생성물을 직접 고치지 않는다. 다시 생성하면 그대로 돌아온다.',
  '  1. 설계 저장소(omf-mes)의 OpenAPI 정본에서 해당 description 을 고친다.',
  '     내부 내용은 x-internal-note 로 옮긴다 — 그 필드는 생성물에 실리지 않는다.',
  '  2. pnpm gen:api 로 다시 생성한다. 이 검사가 생성 직후 함께 돈다.',
  '  3. 정본을 고칠 수 없으면 설계 저장소에 [client→uiux] 질문 이슈를 올린다 (선례: omf-mes#92).',
  '',
  '이미 push 했다면 조용히 지우지 말고 즉시 알린다 — 공개 저장소는 올라간 순간 노출된 것으로 본다.',
];

/**
 * 생성물의 공개 저장소 경계를 검사하고 결과를 콘솔에 출력한다.
 * 위반이 없으면 true, 있으면 false 를 반환한다 — 종료 코드는 호출부가 정한다.
 */
export const checkGeneratedBoundary = (filePath = GENERATED_TYPES_PATH) => {
  if (!existsSync(filePath)) {
    throw new Error(
      [
        `검사 대상 파일을 찾을 수 없습니다: ${filePath}`,
        'pnpm gen:api 로 타입을 먼저 생성하세요.',
      ].join('\n'),
    );
  }

  const displayPath = displayPathOf(filePath);
  const violations = findBoundaryViolations(readFileSync(filePath, 'utf-8'));

  if (violations.length === 0) {
    console.log(`경계 검사 통과: ${displayPath} — 금지 패턴 ${FORBIDDEN_PATTERNS.length}종 0건`);
    return true;
  }

  console.error(
    `경계 검사 실패: ${displayPath} 에 공개하면 안 되는 내용이 ${violations.length}건 있다.`,
  );
  console.error('');
  for (const { lineNumber, patternName, reason, excerpt } of violations) {
    console.error(`  ${displayPath}:${lineNumber}  [${patternName}] ${reason}`);
    console.error(`    ${excerpt}`);
  }
  console.error('');
  console.error(HOW_TO_FIX.join('\n'));
  return false;
};

// 직접 실행됐을 때만 CLI 로 동작한다 — gen-api.mjs 가 import 할 때는 아무 일도 하지 않는다.
const isDirectRun =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const [targetPath] = process.argv.slice(2);
  const passed = checkGeneratedBoundary(
    targetPath === undefined ? GENERATED_TYPES_PATH : path.resolve(targetPath),
  );
  if (!passed) process.exitCode = 1;
}
