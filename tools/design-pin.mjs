import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/*
 * 설계 저장소(omf-mes) 클론의 어느 커밋을 계약 정본으로 쓸지 `.client-dev/state.json` 에 고정한다.
 * `pnpm mock`·`pnpm gen:api` 는 `tools/mock/resolve-spec.mjs` 를 거쳐 이 값을 읽는다.
 * 클론 HEAD 가 고정 커밋과 다르면 거기서 멈춘다 — 작업 도중 계약이 조용히 바뀌지 않게 하려는 것이다.
 */

const DEFAULT_STATE_PATH = '.client-dev/state.json';
const DEFAULT_DESIGN_REF = '.client-dev/design/omf-mes';
const DESIGN_REPOSITORY = 'CREFLEINC/omf-mes';

export function validateDesignBaseline(design) {
  const errors = [];
  if (!design || typeof design !== 'object') return ['designBaseline이 없습니다.'];
  if (!/^[0-9a-f]{40}$/i.test(String(design.commit ?? '')))
    errors.push('designBaseline.commit은 40자리 커밋 해시여야 합니다.');
  if (!design.source || typeof design.source !== 'string')
    errors.push('designBaseline.source가 없습니다.');
  return errors;
}

function parseArgs(argv) {
  const [command = 'check', ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const key = rest[index];
    if (!key.startsWith('--')) throw new Error(`알 수 없는 인자: ${key}`);
    const value = rest[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`${key} 값이 필요합니다.`);
    options[key.slice(2)] = value;
    index += 1;
  }
  return { command, options };
}

function readState(statePath) {
  if (!existsSync(statePath)) return {};
  try {
    return JSON.parse(readFileSync(statePath, 'utf8'));
  } catch (error) {
    throw new Error(`${statePath}을 읽을 수 없습니다: ${error.message}`);
  }
}

function designHead(root, source) {
  const directory = path.isAbsolute(source) ? source : path.resolve(root, source);
  if (!existsSync(directory)) throw new Error(`설계 참조 클론이 없습니다: ${directory}`);
  return execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: directory,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
    .trim()
    .toLowerCase();
}

function relativeSource(root, source) {
  const absolute = path.isAbsolute(source) ? source : path.resolve(root, source);
  const relative = path.relative(root, absolute);
  return relative && !relative.startsWith('..') ? relative : absolute;
}

/** 클론의 현재 HEAD 를 고정한다. 상태 파일의 다른 값(serverApiBaseline 등)은 그대로 둔다. */
export function pin(root, options = {}) {
  const statePath = path.resolve(root, options.state ?? DEFAULT_STATE_PATH);
  const state = readState(statePath);
  const source = relativeSource(
    root,
    options['design-ref'] ?? state.designBaseline?.source ?? DEFAULT_DESIGN_REF,
  );
  const head = designHead(root, source);
  if (options.commit !== undefined && options.commit.toLowerCase() !== head) {
    throw new Error(`설계 참조 HEAD(${head})가 지정한 커밋(${options.commit})과 다릅니다.`);
  }
  state.designBaseline = {
    repository: DESIGN_REPOSITORY,
    commit: head,
    source,
    pinnedAt: new Date().toISOString(),
  };
  mkdirSync(path.dirname(statePath), { recursive: true });
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
  return state.designBaseline;
}

export function check(root, options = {}) {
  const statePath = path.resolve(root, options.state ?? DEFAULT_STATE_PATH);
  if (!existsSync(statePath))
    throw new Error(`설계 고정 상태가 없습니다. pnpm design:pin을 먼저 실행하세요: ${statePath}`);
  const design = readState(statePath).designBaseline;
  const errors = validateDesignBaseline(design);
  if (errors.length === 0) {
    const head = designHead(root, design.source);
    if (head !== design.commit.toLowerCase())
      errors.push(`설계 참조 HEAD(${head})가 고정 커밋(${design.commit})과 다릅니다.`);
  }
  if (errors.length) throw new Error(errors.map((error) => `- ${error}`).join('\n'));
  return design;
}

function usage() {
  return `사용법:
  pnpm design:pin [--design-ref <경로>] [--commit <40자리해시>]   설계 클론의 현재 HEAD를 고정
  pnpm design:check                                              고정 커밋과 클론 HEAD 일치 확인\n`;
}

function main() {
  const root = process.cwd();
  const { command, options } = parseArgs(process.argv.slice(2));
  switch (command) {
    case 'pin': {
      const design = pin(root, options);
      process.stdout.write(`design pinned: ${design.commit} (${design.source})\n`);
      break;
    }
    case 'check': {
      const design = check(root, options);
      process.stdout.write(`design ok: ${design.commit}\n`);
      break;
    }
    case 'help':
    case '--help':
      process.stdout.write(usage());
      break;
    default:
      throw new Error(`알 수 없는 명령: ${command}\n${usage()}`);
  }
}

const isEntryPoint =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isEntryPoint) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`design-pin error:\n${error.message}\n`);
    process.exitCode = 1;
  }
}
