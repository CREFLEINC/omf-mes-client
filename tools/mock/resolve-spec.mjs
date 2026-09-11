import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
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

const readWorkflowState = () => {
  if (!existsSync(workflowStatePath)) {
    throw new Error('설계 고정 상태가 없습니다. pnpm workflow init을 먼저 실행하세요.');
  }

  return JSON.parse(readFileSync(workflowStatePath, 'utf8'));
};

/**
 * 설계 확정본을 기다리는 동안 쓰는 **서버 구현 기준선**의 계약 경로.
 *
 * 정상 경로는 아래 `pinnedSpecRoot` 하나다. 이 갈래는 설계팀 공지가 오기 «전»에 백엔드
 * 개발팀이 서버 구현을 그대로 옮겨 적은 임시 전달본으로 먼저 작업해야 할 때만 쓴다.
 * 그런 상황이 실제로 있었고(프로젝트 기한), 그때 `OMF_SPEC_PATH`로 우회하면 어떤 계약으로
 * 무엇을 만들었는지가 셸 히스토리에만 남아 **설계 공지가 왔을 때 대조할 기준이 사라진다.**
 *
 * 그래서 우회를 막는 대신 상태 파일에 **적어 두게** 한다. 기준선은 다음을 만족해야 한다.
 *
 * - `manifest.json`의 `generatedSha256`과 실제 파일 해시가 전부 일치한다 — 받아 둔 사본이
 *   중간에 손대졌거나 일부만 갱신된 채로 타입이 생성되는 것을 막는다.
 * - 어떤 설계 커밋을 바탕으로 만들어졌는지(`designContractCommit`)가 드러난다 — 설계
 *   확정본이 왔을 때 **무엇과 무엇을 대조해야 하는지**가 이 값으로 정해진다.
 *
 * 매 실행마다 stderr로 경고한다. 조용히 동작하면 임시 기준선이 정상 기준선으로 굳는다.
 */
const serverBaselineSpecRoot = (baseline) => {
  const source = path.isAbsolute(baseline.source)
    ? baseline.source
    : path.resolve(repoRoot, baseline.source);
  const manifestPath = path.join(source, 'manifest.json');

  if (!existsSync(manifestPath)) {
    throw new Error(
      `서버 구현 기준선의 manifest.json이 없습니다: ${manifestPath}\n` +
        'serverApiBaseline.source가 전달본 폴더를 가리키는지 확인하세요.',
    );
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const mismatched = manifest.files.filter((entry) => {
    const filePath = path.join(source, entry.file);
    if (!existsSync(filePath)) return true;

    return createHash('sha256').update(readFileSync(filePath)).digest('hex') !== entry.generatedSha256;
  });

  if (mismatched.length > 0) {
    throw new Error(
      [
        `서버 구현 기준선이 manifest.json과 다릅니다 (${mismatched.length}건):`,
        ...mismatched.map((entry) => `  ${entry.file}`),
        '',
        '전달본을 다시 내려받으세요. 해시가 맞지 않는 계약으로 타입을 생성하면',
        '설계 확정본이 왔을 때 무엇과 대조해야 하는지가 사라집니다.',
      ].join('\n'),
    );
  }

  if (baseline.commit !== undefined && manifest.designContractCommit !== baseline.commit) {
    throw new Error(
      `서버 구현 기준선의 설계 커밋(${manifest.designContractCommit})이 ` +
        `serverApiBaseline.commit(${baseline.commit})과 다릅니다.`,
    );
  }

  process.stderr.write(
    [
      '',
      '⚠ 설계 확정본이 아니라 «서버 구현 기준선»으로 타입을 생성합니다.',
      `  전달본: ${baseline.source}`,
      `  서버: ${manifest.serverVersion} · ${manifest.serverCommit}`,
      `  바탕 설계 커밋: ${manifest.designContractCommit}`,
      `  근거: ${baseline.reason ?? '(없음)'}`,
      '  설계팀 확정본이 오면 이 기준선을 고치지 말고 확정본으로 «교체»한 뒤 차이를 다시 대조하세요.',
      '',
    ].join('\n'),
  );

  return path.resolve(source, 'openapi');
};

const pinnedSpecRoot = () => {
  const state = readWorkflowState();
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
 * 이번 생성이 바라볼 계약 폴더.
 *
 * 서버 구현 기준선이 상태 파일에 적혀 있으면 그쪽이 이긴다 — 적어 둔 사람이 «지금은 그것으로
 * 작업한다»고 정한 것이고, 그 사실이 상태 파일에 남아 있어야 설계 공지 대응 때 대조가 된다.
 */
const specRoot = () => {
  const baseline = readWorkflowState().serverApiBaseline;

  return baseline === undefined || baseline === null
    ? pinnedSpecRoot()
    : serverBaselineSpecRoot(baseline);
};

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
      ? DEFAULT_SPEC_FILES.map((fileName) => path.resolve(specRoot(), fileName))
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
