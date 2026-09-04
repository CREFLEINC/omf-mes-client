import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * 병합본이 놓이는 자리.
 *
 * 저장소에 커밋하지 않는다 — 계약 정본은 비공개 설계 저장소에 있고 이 저장소는 공개다.
 * `node_modules/` 는 이미 .gitignore 에 있어 실수로 커밋될 경로가 아니고,
 * 매 실행마다 다시 쓰므로 낡을 수 없다. OS 임시 폴더 대신 여기를 쓰는 이유는
 * 병합 결과가 이상할 때 사람이 열어 볼 수 있어야 하기 때문이다.
 */
export const MERGED_SPEC_PATH = path.join(
  repoRoot,
  'node_modules',
  '.cache',
  'omf-mes',
  'openapi-merged.json',
);

/**
 * 구조 비교에서 걷어내는 주석성 필드.
 *
 * 같은 이름의 스키마가 두 계약에 있을 때, 설명과 예시만 다른 것은 「같은 것」으로 본다.
 * 타입 생성물에 실리는 형태가 같기 때문이다. 형태가 조금이라도 다르면 접지 않고 멈춘다.
 */
const ANNOTATION_KEYS = new Set(['description', 'example', 'examples']);

const isAnnotationKey = (key) => ANNOTATION_KEYS.has(key) || key.startsWith('x-');

/**
 * 키가 OpenAPI 필드 이름이 아니라 **사용자가 지은 이름**인 자리.
 *
 * 예컨대 `properties` 아래의 `description` 은 「설명」이 아니라 `description` 이라는 이름의 필드다.
 * 이 아래에서는 주석성 필드를 걷어내지 않는다 — 걷어내면 서로 다른 스키마가 같아 보인다.
 */
const NAME_KEYED_FIELDS = new Set([
  'properties',
  'patternProperties',
  'dependentSchemas',
  '$defs',
  'content',
  'headers',
  'encoding',
]);

/** 최상위 키 중 아래 규칙 함수가 따로 다루는 것. 나머지는 `mergeRemainingInto` 가 다룬다. */
const FIELDS_WITH_OWN_RULE = new Set(['paths', 'components', 'tags']);

/**
 * 계약마다 값이 다른 것이 **정상인** 최상위 키 — 선행 우선을 유지하고 멈추지 않는다.
 *
 * `info` 는 문서 메타(제목·설명)이고 `openapi-typescript` 의 생성물에 실리지 않는다.
 * 도메인마다 제목이 다른 것이 당연하므로 여기서 멈추면 병합이 아예 되지 않는다.
 * **이 집합에 키를 더하는 것은 「조용히 잃어도 되는 것」을 늘리는 일이다** — 생성물과
 * 서빙 동작에 영향이 없음을 확인하고 그 근거를 여기 적은 뒤에만 더한다.
 */
const FIELDS_ALLOWED_TO_DIFFER = new Set(['info']);

/** 주석성 필드를 걷어낸 사본을 만든다. 원본은 건드리지 않는다. */
const withoutAnnotations = (node, isNameKeyed = false) => {
  if (Array.isArray(node)) return node.map((item) => withoutAnnotations(item));
  if (node === null || typeof node !== 'object') return node;

  const stripped = {};
  for (const [key, value] of Object.entries(node)) {
    if (!isNameKeyed && isAnnotationKey(key)) continue;
    // 사용자 정의 이름 자리의 **값**은 다시 보통의 OpenAPI 객체다 — 한 단계만 켠다.
    stripped[key] = withoutAnnotations(value, !isNameKeyed && NAME_KEYED_FIELDS.has(key));
  }
  return stripped;
};

/** 설명·예시를 뺀 형태가 완전히 같은가. 같으면 뒤 정의를 접어도 타입이 바뀌지 않는다. */
const isSameShape = (left, right) =>
  isDeepStrictEqual(withoutAnnotations(left), withoutAnnotations(right));

const readDocument = (specPath) => {
  let raw;
  try {
    raw = readFileSync(specPath, 'utf-8');
  } catch (error) {
    throw new Error(`OpenAPI 문서를 읽을 수 없습니다: ${specPath}\n  ${error.message}`);
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`OpenAPI 문서가 올바른 JSON 이 아닙니다: ${specPath}\n  ${error.message}`);
  }
};

/**
 * 경로는 겹치면 멈춘다.
 *
 * 같은 경로를 두 계약이 각각 정의한 것은 계약끼리의 모순이며 설계 저장소가 풀 문제다.
 * 여기서 한쪽을 골라 접으면 어느 쪽이 살았는지 모르는 채로 타입이 만들어진다.
 */
const mergePathsInto = (merged, next, nextSpecPath) => {
  const nextPaths = next.paths ?? {};
  merged.paths ??= {};

  const collisions = Object.keys(nextPaths).filter((key) => Object.hasOwn(merged.paths, key));
  if (collisions.length > 0) {
    throw new Error(
      [
        `계약 병합 중단 — 경로가 겹칩니다 (${collisions.length}건): ${nextSpecPath}`,
        ...collisions.map((key) => `  ${key}`),
        '',
        '같은 경로를 두 계약이 각각 정의했습니다. 어느 쪽이 정본인지는 설계 저장소가 정합니다.',
        '정보 요청서를 만들어 사용자에게 전달을 부탁하세요.',
      ].join('\n'),
    );
  }

  Object.assign(merged.paths, nextPaths);
};

/**
 * 컴포넌트는 이름이 겹쳐도 **형태가 같으면** 선행 우선으로 접는다.
 * 형태가 다르면 멈춘다 — 조용히 덮으면 어느 계약의 타입이 살았는지 알 수 없다.
 */
const mergeComponentsInto = (merged, next, nextSpecPath, foldedKeys) => {
  const nextComponents = next.components ?? {};
  merged.components ??= {};

  const conflicts = [];
  for (const [field, definitions] of Object.entries(nextComponents)) {
    merged.components[field] ??= {};
    const target = merged.components[field];

    for (const [name, definition] of Object.entries(definitions)) {
      if (!Object.hasOwn(target, name)) {
        target[name] = definition;
        continue;
      }
      if (isSameShape(target[name], definition)) {
        foldedKeys.push(`components.${field}.${name}`);
        continue;
      }
      conflicts.push(`components.${field}.${name}`);
    }
  }

  if (conflicts.length > 0) {
    throw new Error(
      [
        `계약 병합 중단 — 같은 이름의 컴포넌트가 형태까지 다릅니다 (${conflicts.length}건): ${nextSpecPath}`,
        ...conflicts.map((key) => `  ${key}`),
        '',
        '설명·예시만 다른 것은 접지만, 형태가 다르면 어느 쪽을 골라도 다른 계약의 타입이 틀어집니다.',
        '정보 요청서를 만들어 사용자에게 전달을 부탁하세요.',
      ].join('\n'),
    );
  }
};

/** 태그는 이름 기준 선행 우선으로 합친다. 겹치는 이름은 앞 계약의 설명이 남는다. */
const mergeTagsInto = (merged, next) => {
  if (next.tags === undefined) return;
  merged.tags ??= [];

  const knownNames = new Set(merged.tags.map((tag) => tag.name));
  for (const tag of next.tags) {
    if (knownNames.has(tag.name)) continue;
    merged.tags.push(tag);
    knownNames.add(tag.name);
  }
};

/**
 * `openapi`·`servers`·`security`·`webhooks` 처럼 규칙을 따로 두지 않은 최상위 키.
 *
 * 앞 계약에 없으면 덧붙이고, 있으면 **형태를 비교해** 같으면 선행 유지·다르면 멈춘다.
 * `paths`·`components` 와 같은 원칙이다 — 이 자리만 조용히 덮으면 잃는 것이 가장 크다.
 *
 * - `servers` 가 다른 계약을 말없이 흡수하면 그 계약의 경로 수십 개가 잘못된 base 로
 *   서빙·타이핑되고, 증상이 드러나는 자리는 병합기가 아니라 화면이다.
 * - `openapi` 버전이 다르면 3.0 의 `nullable`·불리언형 `exclusiveMinimum` 이 3.1 로 읽혀
 *   생성 타입이 조용히 틀어진다. 버전이 섞인 병합은 정의되지 않은 동작이다.
 */
const mergeRemainingInto = (merged, next, nextSpecPath) => {
  const conflicts = [];

  for (const [key, value] of Object.entries(next)) {
    if (FIELDS_WITH_OWN_RULE.has(key)) continue;
    if (!Object.hasOwn(merged, key)) {
      merged[key] = value;
      continue;
    }
    if (FIELDS_ALLOWED_TO_DIFFER.has(key)) continue;
    if (isSameShape(merged[key], value)) continue;
    conflicts.push(key);
  }

  if (conflicts.length > 0) {
    throw new Error(
      [
        `계약 병합 중단 — 최상위 키의 값이 다릅니다 (${conflicts.length}건): ${nextSpecPath}`,
        ...conflicts.map((key) => `  ${key}`),
        '',
        '앞 계약의 값을 그대로 두면 뒤 계약의 값이 말없이 사라집니다.',
        'servers 가 다르면 그 계약의 경로 전부가 잘못된 base 로 서빙되고,',
        'openapi 버전이 다르면 생성 타입이 조용히 틀어집니다.',
        '정보 요청서를 만들어 사용자에게 전달을 부탁하세요.',
      ].join('\n'),
    );
  }
};

/**
 * 여러 OpenAPI 문서를 하나로 병합한다 — **순서 보존·선행 우선**.
 *
 * 먼저 온 계약이 이긴다. 뒤 계약은 앞에 없는 키만 덧붙이므로 생성물의 블록 순서가 유지되고
 * 재생성 diff 를 사람이 읽을 수 있다.
 *
 * @param {string[]} specPaths 병합할 문서 경로. 앞에 올수록 우선한다
 * @returns {{ document: object, foldedKeys: string[] }} 병합 문서와 접힌 컴포넌트 이름
 */
export const mergeSpecs = (specPaths) => {
  if (specPaths.length === 0) {
    throw new Error('병합할 OpenAPI 문서가 하나도 없습니다.');
  }

  const [firstSpecPath, ...restSpecPaths] = specPaths;
  // 선행 문서를 통째로 바탕으로 삼는다 — 키 순서가 그대로 남는다.
  const merged = readDocument(firstSpecPath);
  const foldedKeys = [];

  for (const specPath of restSpecPaths) {
    const next = readDocument(specPath);
    mergePathsInto(merged, next, specPath);
    mergeComponentsInto(merged, next, specPath, foldedKeys);
    mergeTagsInto(merged, next);
    mergeRemainingInto(merged, next, specPath);
  }

  return { document: merged, foldedKeys };
};

/**
 * 병합본을 캐시 경로에 쓰고 그 경로를 돌려준다. 접힌 키가 있으면 콘솔에 남긴다 —
 * 접힘은 조용히 일어나서는 안 되는 일이라 실행할 때마다 보이게 한다.
 *
 * @param {string[]} specPaths 병합할 문서 경로. 앞에 올수록 우선한다
 * @returns {string} 병합본 경로
 */
export const writeMergedSpec = (specPaths) => {
  const { document, foldedKeys } = mergeSpecs(specPaths);

  mkdirSync(path.dirname(MERGED_SPEC_PATH), { recursive: true });

  // 한 파일을 여러 진입점(gen:api · mock · mock:smoke · CLI)이 쓰고, 상주 목 서버가 그 사이 읽는다.
  // writeFileSync 는 자르고 쓰므로 읽는 쪽이 반쯤 쓰인 JSON 을 만날 수 있다 — 같은 디렉터리에
  // 쓴 뒤 rename 으로 바꾼다. 같은 파일시스템이라 교체가 원자적이다.
  const temporaryPath = `${MERGED_SPEC_PATH}.${process.pid}.tmp`;
  try {
    writeFileSync(temporaryPath, `${JSON.stringify(document, null, 2)}\n`, 'utf-8');
    renameSync(temporaryPath, MERGED_SPEC_PATH);
  } finally {
    // 교체에 성공했으면 이미 없다. 실패했을 때 반쯤 쓰인 임시 파일을 남기지 않는다.
    rmSync(temporaryPath, { force: true });
  }

  if (foldedKeys.length > 0) {
    console.log(`계약 병합: 같은 형태의 컴포넌트 ${foldedKeys.length}건을 선행 계약 쪽으로 접음`);
    for (const key of foldedKeys) console.log(`  ${key}`);
  }

  return MERGED_SPEC_PATH;
};

// 직접 실행됐을 때만 CLI 로 동작한다 — 다른 도구가 import 할 때는 아무 일도 하지 않는다.
const isDirectRun =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const specPaths = process.argv.slice(2);
  if (specPaths.length === 0) {
    console.error('사용법: node tools/merge-spec.mjs <openapi.json> [openapi.json ...]');
    console.error('  앞에 오는 문서가 우선합니다(선행 우선).');
    process.exitCode = 1;
  } else {
    try {
      console.log(writeMergedSpec(specPaths));
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    }
  }
}
