import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// 정본은 설계 저장소(omf-mes)에 있고 이 저장소로 복사하지 않는다 — 기본값은 형제 클론 경로.
const DEFAULT_SPEC_PATH = path.resolve(
  repoRoot,
  '..',
  'omf',
  'deliverables',
  'openapi',
  'mdm-기준정보.json',
);

export const resolveSpecPath = () => {
  const specPath = process.env.OMF_SPEC_PATH ?? DEFAULT_SPEC_PATH;
  if (!existsSync(specPath)) {
    throw new Error(
      [
        `OpenAPI 정본을 찾을 수 없습니다: ${specPath}`,
        '정본은 설계 저장소(omf-mes)의 deliverables/openapi/mdm-기준정보.json 입니다.',
        '설계 저장소 클론이 다른 위치에 있으면 OMF_SPEC_PATH 환경변수로 경로를 지정하세요.',
      ].join('\n'),
    );
  }
  return specPath;
};
