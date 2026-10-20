import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/*
 * API 계약 정본은 서버 저장소의 `contracts/` 다. 어느 서버 커밋의 계약을 쓸지
 * `.client-dev/state.json` 의 `serverContracts` 에 고정한다. `pnpm gen:api`·`pnpm mock` 은
 * `tools/mock/resolve-spec.mjs` 를 거쳐 그 커밋의 계약을 `git show` 로 읽는다 — 서버 클론이
 * 어느 브랜치에 있든 고정한 커밋의 계약만 쓴다.
 */

const DEFAULT_STATE_PATH = '.client-dev/state.json';
const DEFAULT_SERVER_REPO = '../omf-mes-server';
const DEFAULT_REF = 'origin/main';

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

function git(cwd, args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  });
}

function readState(statePath) {
  if (!existsSync(statePath)) return {};
  try {
    return JSON.parse(readFileSync(statePath, 'utf8'));
  } catch (error) {
    throw new Error(`${statePath}을 읽을 수 없습니다: ${error.message}`);
  }
}

function serverRepo(root, source) {
  const directory = path.isAbsolute(source) ? source : path.resolve(root, source);
  if (!existsSync(directory)) throw new Error(`서버 저장소 클론이 없습니다: ${directory}`);
  return directory;
}

function resolveCommit(repo, ref) {
  try {
    return git(repo, ['rev-parse', '--verify', `${ref}^{commit}`])
      .trim()
      .toLowerCase();
  } catch {
    throw new Error(
      `서버 저장소에서 커밋을 찾을 수 없습니다: ${ref} (git fetch가 필요할 수 있습니다)`,
    );
  }
}

export function validateServerContracts(pinned) {
  const errors = [];
  if (!pinned || typeof pinned !== 'object') return ['serverContracts가 없습니다.'];
  if (!/^[0-9a-f]{40}$/i.test(String(pinned.commit ?? '')))
    errors.push('serverContracts.commit은 40자리 커밋 해시여야 합니다.');
  if (!pinned.source || typeof pinned.source !== 'string')
    errors.push('serverContracts.source가 없습니다.');
  return errors;
}

/** 서버 커밋 하나를 고정한다. 기본은 서버 클론의 origin/main. 상태 파일의 다른 값은 그대로 둔다. */
export function pin(root, options = {}) {
  const statePath = path.resolve(root, options.state ?? DEFAULT_STATE_PATH);
  const state = readState(statePath);
  const source = options.server ?? state.serverContracts?.source ?? DEFAULT_SERVER_REPO;
  const repo = serverRepo(root, source);
  const commit = resolveCommit(repo, options.commit ?? DEFAULT_REF);
  try {
    git(repo, ['cat-file', '-e', `${commit}:contracts`]);
  } catch {
    throw new Error(`커밋 ${commit}에 contracts/ 가 없습니다.`);
  }
  state.serverContracts = { source, commit, pinnedAt: new Date().toISOString() };
  mkdirSync(path.dirname(statePath), { recursive: true });
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
  return state.serverContracts;
}

export function check(root, options = {}) {
  const statePath = path.resolve(root, options.state ?? DEFAULT_STATE_PATH);
  if (!existsSync(statePath))
    throw new Error(
      `계약 고정 상태가 없습니다. pnpm contracts:pin을 먼저 실행하세요: ${statePath}`,
    );
  const pinned = readState(statePath).serverContracts;
  const errors = validateServerContracts(pinned);
  if (errors.length === 0) {
    try {
      git(serverRepo(root, pinned.source), ['cat-file', '-e', `${pinned.commit}:contracts`]);
    } catch (error) {
      errors.push(
        error.message.startsWith('서버 저장소')
          ? error.message
          : `서버 저장소에 고정 커밋 ${pinned.commit}의 contracts/ 가 없습니다 (git fetch가 필요할 수 있습니다).`,
      );
    }
  }
  if (errors.length) throw new Error(errors.map((error) => `- ${error}`).join('\n'));
  return pinned;
}

/**
 * 고정 커밋의 계약 파일을 `.client-dev/contracts/<커밋>/` 에 풀어 그 폴더를 돌려준다.
 * 커밋이 같으면 내용도 같으므로 이미 풀린 파일은 다시 쓰지 않는다.
 */
export function materialize(root, fileNames, options = {}) {
  const pinned = check(root, options);
  const repo = serverRepo(root, pinned.source);
  const directory = path.resolve(root, '.client-dev', 'contracts', pinned.commit);
  mkdirSync(directory, { recursive: true });
  for (const fileName of fileNames) {
    const target = path.join(directory, fileName);
    if (existsSync(target)) continue;
    let content;
    try {
      content = git(repo, ['show', `${pinned.commit}:contracts/${fileName}`]);
    } catch {
      throw new Error(`고정 커밋 ${pinned.commit}에 contracts/${fileName} 이 없습니다.`);
    }
    writeFileSync(target, content);
  }
  return { directory, pinned };
}

function usage() {
  return `사용법:
  pnpm contracts:pin [--server <경로>] [--commit <커밋|브랜치>]   서버 계약 커밋 고정 (기본: 서버 클론의 origin/main)
  pnpm contracts:check                                          고정 커밋이 서버 클론에 있는지 확인\n`;
}

function main() {
  const root = process.cwd();
  const { command, options } = parseArgs(process.argv.slice(2));
  switch (command) {
    case 'pin': {
      const pinned = pin(root, options);
      process.stdout.write(`server contracts pinned: ${pinned.commit} (${pinned.source})\n`);
      break;
    }
    case 'check': {
      const pinned = check(root, options);
      process.stdout.write(`server contracts ok: ${pinned.commit}\n`);
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
    process.stderr.write(`contracts-pin error:\n${error.message}\n`);
    process.exitCode = 1;
  }
}
