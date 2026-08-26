import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const specPathOf = (fileName) =>
  path.resolve(repoRoot, '..', 'omf', 'design', 'wiki', 'api-contracts', 'openapi', fileName);

/**
 * 정본은 설계 저장소(omf-mes)에 있고 이 저장소로 복사하지 않는다 — 기본값은 형제 클론 경로.
 *
 * **순서가 의미를 갖는다.** 병합은 선행 우선이라 앞에 오는 계약이 이긴다(`tools/merge-spec.mjs`).
 * 기준정보를 먼저 두는 이유는 그것이 먼저 있던 계약이어서다 — 생성물의 블록 순서가 유지되어
 * 도메인이 늘 때마다 재생성 diff 가 「덧붙은 부분」으로만 읽힌다.
 *
 * 도메인 계약이 늘면 이 배열에 한 줄을 더한다. 그 이상을 고쳐야 한다면 병합기 설계가 잘못된 것이다.
 */
const DEFAULT_SPEC_PATHS = [
  specPathOf('mdm-기준정보.json'),
  specPathOf('logistics-01자재창고.json'),
  specPathOf('app-공통.json'),
  specPathOf('production-02생산실행.json'),
  specPathOf('quality-03품질.json'),
  specPathOf('shipment-04제품출하.json'),
  specPathOf('equipment-05설비툴.json'),
];

/**
 * 병합할 OpenAPI 정본 경로를 순서대로 돌려준다.
 *
 * `OMF_SPEC_PATH` 는 쉼표로 나눈 다중 경로를 받는다. 경로 하나만 준 예전 사용법도 그대로 동작한다.
 *
 * @returns {string[]} 존재가 확인된 정본 경로. 앞에 올수록 우선한다
 */
export const resolveSpecPaths = () => {
  const configured = process.env.OMF_SPEC_PATH;
  const specPaths =
    configured === undefined || configured.trim() === ''
      ? DEFAULT_SPEC_PATHS
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
        '설계 저장소 클론이 다른 위치에 있으면 OMF_SPEC_PATH 환경변수로 경로를 지정하세요.',
        '여러 벌을 쓸 때는 쉼표로 잇습니다 — 앞에 오는 계약이 우선합니다.',
      ].join('\n'),
    );
  }

  return specPaths;
};
