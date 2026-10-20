import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { materialize } from '../contracts-pin.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * 정본은 서버 저장소의 `contracts/` 이고 이 저장소로 복사하지 않는다.
 * 기본값은 `pnpm contracts:pin` 으로 고정한 서버 커밋의 계약이다.
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
  const pinnedPaths = () => {
    const { directory } = materialize(repoRoot, DEFAULT_SPEC_FILES);
    return DEFAULT_SPEC_FILES.map((fileName) => path.resolve(directory, fileName));
  };
  const specPaths =
    configured === undefined || configured.trim() === ''
      ? pinnedPaths()
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
        '정본은 서버 저장소(omf-mes-server)의 contracts/ 아래에 있습니다.',
        'pnpm contracts:check 로 계약 고정 상태를 먼저 확인하세요.',
        '격리된 도구 시험에서만 OMF_SPEC_PATH 로 별도 경로를 명시할 수 있습니다.',
      ].join('\n'),
    );
  }

  return specPaths;
};
