import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * 팀별로 고정한 설계 참조 클론의 계약 경로.
 *
 * 다른 로컬 설계 체크아웃을 자동 탐색하면 작업 도중 설계 버전이 조용히 바뀔 수 있다.
 * 기본값은 `.client-dev/state.json`과 함께 고정하는 격리 클론 하나뿐이다.
 */
const workflowStatePath = path.resolve(repoRoot, '.client-dev', 'state.json');

const pinnedSpecRoot = () => {
  if (!existsSync(workflowStatePath)) {
    throw new Error('설계 고정 상태가 없습니다. pnpm workflow init을 먼저 실행하세요.');
  }

  const state = JSON.parse(readFileSync(workflowStatePath, 'utf8'));
  const source = state.designBaseline?.source;
  const commit = state.designBaseline?.commit;
  if (typeof source !== 'string' || !/^[0-9a-f]{40}$/i.test(String(commit ?? ''))) {
    throw new Error('설계 고정 상태가 올바르지 않습니다. pnpm workflow:check를 실행하세요.');
  }

  const designRoot = path.isAbsolute(source) ? source : path.resolve(repoRoot, source);
  const head = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: designRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
    .trim()
    .toLowerCase();
  if (head !== commit.toLowerCase()) {
    throw new Error(
      `설계 참조 HEAD(${head})가 고정 커밋(${commit})과 다릅니다. 설계 변동 공지 없이 사용하지 마세요.`,
    );
  }

  return path.resolve(designRoot, 'design', 'wiki', 'api-contracts', 'openapi');
};

/**
 * 정본은 설계 저장소(omf-mes)에 있고 이 저장소로 복사하지 않는다.
 * 기본값은 팀 환경이 커밋으로 고정한 격리 클론 경로다.
 *
 * **순서가 의미를 갖는다.** 병합은 선행 우선이라 앞에 오는 계약이 이긴다(`tools/merge-spec.mjs`).
 * 기준정보를 먼저 두는 이유는 그것이 먼저 있던 계약이어서다 — 생성물의 블록 순서가 유지되어
 * 도메인이 늘 때마다 재생성 diff 가 「덧붙은 부분」으로만 읽힌다.
 *
 * 도메인 계약이 늘면 이 배열에 한 줄을 더한다. 그 이상을 고쳐야 한다면 병합기 설계가 잘못된 것이다.
 */
const DEFAULT_SPEC_FILES = [
  'mdm-기준정보.json',
  'logistics-01자재창고.json',
  'app-공통.json',
  'production-02생산실행.json',
  'quality-03품질.json',
  'shipment-04제품출하.json',
  'equipment-05설비툴.json',
];

/**
 * 병합할 OpenAPI 정본 경로를 순서대로 돌려준다.
 *
 * `OMF_SPEC_PATH` 는 격리된 도구 시험에서만 쓰는 명시적 재정의다. 실제 개발·생성 작업은
 * 기본 고정본을 사용한다. 쉼표로 나눈 다중 경로를 받으며 하나만 줘도 된다.
 *
 * @returns {string[]} 존재가 확인된 정본 경로. 앞에 올수록 우선한다
 */
export const resolveSpecPaths = () => {
  const configured = process.env.OMF_SPEC_PATH;
  const specPaths =
    configured === undefined || configured.trim() === ''
      ? DEFAULT_SPEC_FILES.map((fileName) => path.resolve(pinnedSpecRoot(), fileName))
      : configured
          .split(',')
          .map((specPath) => specPath.trim())
          .filter((specPath) => specPath !== '');

  if (specPaths.length === 0) {
    throw new Error('OMF_SPEC_PATH 에 경로가 하나도 없습니다. 쉼표로 나눈 경로 목록을 지정하세요.');
  }

  const missing = specPaths.filter((specPath) => !existsSync(specPath));
  if (missing.length > 0) {
    throw new Error(
      [
        `OpenAPI 정본을 찾을 수 없습니다 (${missing.length}건):`,
        ...missing.map((specPath) => `  ${specPath}`),
        '',
        '정본은 설계 저장소(omf-mes)의 design/wiki/api-contracts/openapi/ 아래에 있습니다.',
        'pnpm workflow:check 로 팀별 설계 고정 상태를 먼저 확인하세요.',
        '격리된 도구 시험에서만 OMF_SPEC_PATH 로 별도 경로를 명시할 수 있습니다.',
      ].join('\n'),
    );
  }

  return specPaths;
};
