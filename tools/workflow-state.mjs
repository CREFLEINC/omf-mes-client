import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { bootstrapErrors, WORKFLOW_SOURCE } from './workflow/bootstrap.mjs';

const STATE_VERSION = 1;
const DEFAULT_STATE_PATH = '.client-dev/state.json';
const DEFAULT_DESIGN_REF = '.client-dev/design/omf-mes';
const DEFAULT_DESIGN_REPOSITORY = 'CREFLEINC/omf-mes';

export function normalizeTeam(value) {
  const match = String(value ?? '').match(/^(?:Agent\s*:\s*)?T?(\d+)$/i);
  if (!match || Number(match[1]) < 1) {
    throw new Error('팀은 1 이상의 번호로 지정하세요. 예: --team 5');
  }
  return `Agent : T${Number(match[1])}`;
}

export function inferBranchTeam(branch) {
  const match = String(branch).match(/(?:^|[-_/])team[-_]?([0-9]+)(?:$|[-_/])/i);
  return match ? `Agent : T${Number(match[1])}` : null;
}

export function normalizeNoticeReference(value, designRepository = DEFAULT_DESIGN_REPOSITORY) {
  const reference = String(value ?? '').trim();
  const shorthand = reference.match(/^([a-z0-9_.-]+)\/([a-z0-9_.-]+)#([1-9][0-9]*)$/i);
  const issueUrl = reference.match(
    /^https:\/\/github\.com\/([a-z0-9_.-]+)\/([a-z0-9_.-]+)\/issues\/([1-9][0-9]*)\/?(?:#issuecomment-[0-9]+)?$/i,
  );
  const match = shorthand ?? issueUrl;
  if (!match) {
    throw new Error(
      '--notice-ref에는 공통 공지의 GitHub 이슈 URL 또는 owner/repo#번호가 필요합니다.',
    );
  }
  const [, owner, repository, issue] = match;
  if (`${owner}/${repository}`.toLowerCase() !== designRepository.toLowerCase()) {
    throw new Error(
      `--notice-ref는 고정 설계 저장소(${designRepository})의 공통 공지를 가리켜야 합니다.`,
    );
  }
  return shorthand
    ? `${owner}/${repository}#${Number(issue)}`
    : `https://github.com/${owner}/${repository}/issues/${Number(issue)}`;
}

export function validateState(state) {
  const errors = [];
  if (!state || typeof state !== 'object') return ['상태 파일이 JSON 객체가 아닙니다.'];
  if (state.schemaVersion !== STATE_VERSION)
    errors.push(`schemaVersion은 ${STATE_VERSION}이어야 합니다.`);
  try {
    normalizeTeam(state.team);
  } catch (error) {
    errors.push(error.message);
  }
  if (
    state.activeIssue !== null &&
    (!Number.isInteger(state.activeIssue) || state.activeIssue < 1)
  ) {
    errors.push('activeIssue는 양의 이슈 번호 또는 null이어야 합니다.');
  }
  const design = state.designBaseline;
  if (!design || typeof design !== 'object') {
    errors.push('designBaseline이 없습니다.');
  } else {
    if (!design.repository || typeof design.repository !== 'string') {
      errors.push('designBaseline.repository가 없습니다.');
    }
    if (!/^[0-9a-f]{40}$/i.test(String(design.commit ?? ''))) {
      errors.push('designBaseline.commit은 40자리 커밋 해시여야 합니다.');
    }
    if (!design.source || typeof design.source !== 'string')
      errors.push('designBaseline.source가 없습니다.');
    if (!['initial', 'design-change-notice'].includes(design.reason)) {
      errors.push('designBaseline.reason은 initial 또는 design-change-notice여야 합니다.');
    }
    if (design.reason === 'design-change-notice') {
      if (design.noticeIssue !== undefined && design.noticeIssue !== null) {
        errors.push(
          '구 noticeIssue 상태의 이주가 필요합니다. 설계팀의 공통 공지를 확인한 뒤 pnpm workflow migrate-v3 --notice-ref <설계저장소-공통공지>를 실행하세요.',
        );
      } else {
        try {
          normalizeNoticeReference(design.noticeReference, design.repository);
        } catch (error) {
          errors.push(error.message);
        }
      }
    }
    if (Number.isNaN(Date.parse(String(design.pinnedAt ?? '')))) {
      errors.push('designBaseline.pinnedAt은 유효한 시각이어야 합니다.');
    }
  }
  return errors;
}

function parseArgs(argv) {
  const [command = 'check', ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const key = rest[index];
    if (!key.startsWith('--')) throw new Error(`알 수 없는 인자: ${key}`);
    const name = key.slice(2);
    const value = rest[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`${key} 값이 필요합니다.`);
    options[name] = value;
    index += 1;
  }
  return { command, options };
}

function git(args, cwd) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function readJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`${filePath}을 읽을 수 없습니다: ${error.message}`);
  }
}

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { flag: 'w' });
}

function positiveIssue(value, optionName) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1)
    throw new Error(`${optionName}에는 양의 이슈 번호가 필요합니다.`);
  return parsed;
}

function fullCommit(value) {
  if (!/^[0-9a-f]{40}$/i.test(String(value ?? ''))) {
    throw new Error('--commit에는 설계 변동 공지의 40자리 커밋 해시가 필요합니다.');
  }
  return value.toLowerCase();
}

function resolveDesignRef(root, source) {
  return path.isAbsolute(source) ? source : path.resolve(root, source);
}

function designHead(root, source) {
  const directory = resolveDesignRef(root, source);
  if (!existsSync(directory)) throw new Error(`설계 참조 클론이 없습니다: ${directory}`);
  return git(['rev-parse', 'HEAD'], directory).toLowerCase();
}

function relativeSource(root, source) {
  const absolute = resolveDesignRef(root, source);
  const relative = path.relative(root, absolute);
  return relative && !relative.startsWith('..') ? relative : absolute;
}

function requireState(root, statePath = DEFAULT_STATE_PATH) {
  const absolute = path.resolve(root, statePath);
  if (!existsSync(absolute)) {
    throw new Error(`로컬 업무 상태가 없습니다. workflow init을 먼저 실행하세요: ${absolute}`);
  }
  return { absolute, state: readJson(absolute) };
}

function check(root, statePath = DEFAULT_STATE_PATH) {
  const { state } = requireState(root, statePath);
  const errors = validateState(state);
  errors.push(...bootstrapErrors(root, state.team));
  const branch = git(['branch', '--show-current'], root);
  if (!branch || ['main', 'master'].includes(branch))
    errors.push('main/master가 아닌 팀 전용 브랜치에서 작업해야 합니다.');

  const branchTeam = inferBranchTeam(branch);
  if (!branchTeam) {
    errors.push('브랜치 이름에 team<번호>를 포함해 담당 팀이 드러나야 합니다.');
  } else if (branchTeam !== normalizeTeam(state.team)) {
    errors.push(`브랜치 담당(${branchTeam})과 로컬 상태(${state.team})가 다릅니다.`);
  }
  if (!Number.isInteger(state.activeIssue) || state.activeIssue < 1) {
    errors.push('진행 작업에는 activeIssue가 필요합니다. workflow set-issue로 기록하세요.');
  }

  if (
    state.designBaseline?.source &&
    /^[0-9a-f]{40}$/i.test(String(state.designBaseline.commit ?? ''))
  ) {
    try {
      const head = designHead(root, state.designBaseline.source);
      if (head !== state.designBaseline.commit.toLowerCase()) {
        errors.push(
          `설계 참조 HEAD(${head})가 고정 커밋(${state.designBaseline.commit})과 다릅니다. 설계 변동 공지 없이 갱신하지 마세요.`,
        );
      }
    } catch (error) {
      errors.push(error.message);
    }
  }

  if (errors.length) throw new Error(errors.map((error) => `- ${error}`).join('\n'));
  process.stdout.write(
    `workflow ok: ${state.team}, issue #${state.activeIssue}, design ${state.designBaseline.commit}\n`,
  );
}

function init(root, options) {
  const statePath = path.resolve(root, options.state ?? DEFAULT_STATE_PATH);
  if (existsSync(statePath)) throw new Error(`상태 파일이 이미 있습니다: ${statePath}`);
  const source = relativeSource(root, options['design-ref'] ?? DEFAULT_DESIGN_REF);
  const state = {
    schemaVersion: STATE_VERSION,
    team: normalizeTeam(options.team),
    activeIssue: positiveIssue(options.issue, '--issue'),
    designBaseline: {
      repository: DEFAULT_DESIGN_REPOSITORY,
      commit: designHead(root, source),
      source,
      pinnedAt: new Date().toISOString(),
      reason: 'initial',
      noticeReference: null,
    },
  };
  writeJson(statePath, state);
  process.stdout.write(`workflow initialized: ${statePath}\n`);
}

function setIssue(root, options) {
  const { absolute, state } = requireState(root, options.state ?? DEFAULT_STATE_PATH);
  state.activeIssue = positiveIssue(options.issue, '--issue');
  writeJson(absolute, state);
  process.stdout.write(`active issue: #${state.activeIssue}\n`);
}

function clearIssue(root, options) {
  const { absolute, state } = requireState(root, options.state ?? DEFAULT_STATE_PATH);
  state.activeIssue = null;
  writeJson(absolute, state);
  process.stdout.write('active issue cleared\n');
}

function acceptDesignChange(root, options) {
  const { absolute, state } = requireState(root, options.state ?? DEFAULT_STATE_PATH);
  const source = relativeSource(
    root,
    options['design-ref'] ?? state.designBaseline?.source ?? DEFAULT_DESIGN_REF,
  );
  const commit = fullCommit(options.commit);
  const head = designHead(root, source);
  if (head !== commit)
    throw new Error(`설계 참조 HEAD(${head})가 공지 커밋(${commit})과 다릅니다.`);

  const repository = state.designBaseline.repository ?? DEFAULT_DESIGN_REPOSITORY;
  state.designBaseline = {
    repository,
    commit,
    source,
    pinnedAt: new Date().toISOString(),
    reason: 'design-change-notice',
    noticeReference: normalizeNoticeReference(options['notice-ref'], repository),
  };
  writeJson(absolute, state);
  process.stdout.write(
    `design baseline accepted from ${state.designBaseline.noticeReference}: ${commit}\n`,
  );
}

export function migrateLegacyNoticeState(state, noticeReferenceInput) {
  const design = state.designBaseline;
  if (
    design?.reason !== 'design-change-notice' ||
    !Number.isInteger(design.noticeIssue) ||
    design.noticeIssue < 1
  ) {
    throw new Error('이 상태에는 이주할 구 noticeIssue가 없습니다.');
  }
  const repository = design.repository ?? DEFAULT_DESIGN_REPOSITORY;
  const noticeReference = normalizeNoticeReference(noticeReferenceInput, repository);
  const { noticeIssue: _retiredNoticeIssue, ...currentDesign } = design;
  return {
    ...state,
    designBaseline: { ...currentDesign, repository, noticeReference },
  };
}

function migrateV3(root, options) {
  const { absolute, state } = requireState(root, options.state ?? DEFAULT_STATE_PATH);
  const migrated = migrateLegacyNoticeState(state, options['notice-ref']);
  writeJson(absolute, migrated);
  process.stdout.write(
    `workflow state migrated from legacy noticeIssue to ${migrated.designBaseline.noticeReference}\n`,
  );
}

export function repositoryPolicyErrors(root) {
  const errors = [];
  const forbiddenPaths = [
    'multi-agent-team-workflow-v2.md',
    'docs/uiux-handoff.md',
    'docs/client-dev-workflow/references/design-reference.md',
    'docs/client-dev-workflow/references/issue-lifecycle.md',
    'docs/client-dev-workflow/references/merge-rules.md',
    'docs/client-dev-workflow/references/verification-levels.md',
    '.github/ISSUE_TEMPLATE/uiux-ready.yml',
    '.github/ISSUE_TEMPLATE/design-change-notice.yml',
    '.github/ISSUE_TEMPLATE/design-change-impact-review.yml',
    'docs/client-dev-workflow/references/review-request.md',
  ];
  for (const file of forbiddenPaths) {
    if (existsSync(path.join(root, file)))
      errors.push(`폐기된 하네스 파일이 남아 있습니다: ${file}`);
  }

  const requiredPaths = [
    WORKFLOW_SOURCE,
    'tools/workflow/bootstrap.mjs',
    'docs/client-dev-workflow/README.md',
    'docs/client-dev-workflow/references/design-request.md',
    '.github/ISSUE_TEMPLATE/design-request-tracking.yml',
  ];
  for (const file of requiredPaths) {
    if (!existsSync(path.join(root, file))) errors.push(`필수 하네스 파일이 없습니다: ${file}`);
  }

  const canonicalFiles = [
    WORKFLOW_SOURCE,
    'README.md',
    'docs/client-dev-workflow/README.md',
    'docs/client-dev-workflow/references/design-request.md',
    'docs/client-dev-workflow/templates/completion-report.md',
    'docs/client-dev-workflow/templates/design-request.md',
    'docs/client-dev-workflow/templates/plan.md',
    '.github/ISSUE_TEMPLATE/config.yml',
    'tools/check-generated-boundary.mjs',
    'tools/merge-spec.mjs',
    'tools/mock/README.md',
    'tools/mock/resolve-spec.mjs',
  ];
  const forbiddenText = [
    [/Agent\s*:\s*T\d+/, '특정 팀 번호 하드코딩'],
    [/\[uiux→client\]\s*착수 가능/, '폐기된 설계팀 착수 배정 채널'],
    [/crefle-agent-skills:/, '사용 가능성이 보장되지 않는 특정 스킬 의존'],
    [/gh issue create --repo CREFLEINC\/omf-mes/, '설계 저장소 직접 이슈 생성'],
    [/client→uiux/, '폐기된 설계팀 직접 질문 채널'],
    [/github\.com\/CREFLEINC\/omf-mes\/issues\/new/, '설계 저장소 직접 이슈 링크'],
    [/\.claude\/_designref/, '폐기된 설계 참조 경로'],
    [/설계팀이 이 저장소에 발행/, '클라이언트 전용 설계 변동 공지 채널'],
    [/클라이언트(?:저장소[- ]?)?\s*이슈\s*번호/, '클라이언트 전용 공지 번호'],
    [/--notice(?:\s|>)/, '폐기된 숫자형 공지 인자'],
  ];
  for (const file of canonicalFiles) {
    if (!existsSync(path.join(root, file))) continue;
    const content = readFileSync(path.join(root, file), 'utf8');
    for (const [pattern, description] of forbiddenText) {
      if (pattern.test(content)) errors.push(`${file}: ${description}`);
    }
  }
  let insideGitRepository = false;
  try {
    insideGitRepository = git(['rev-parse', '--is-inside-work-tree'], root) === 'true';
    if (!insideGitRepository) errors.push('Git 작업 트리에서 저장소 정책 검사를 실행해야 합니다.');
  } catch (error) {
    errors.push(`Git 작업 트리를 확인할 수 없습니다: ${error.message}`);
  }
  for (const file of insideGitRepository ? ['AGENTS.md', 'CLAUDE.md'] : []) {
    try {
      git(['ls-files', '--error-unmatch', '--', file], root);
      errors.push(`${file}: AI 도구별 로컬 어댑터는 Git에서 추적하면 안 됩니다.`);
    } catch (error) {
      if (error.status !== 1) {
        errors.push(`${file}: Git 추적 상태를 확인할 수 없습니다: ${error.message}`);
      }
    }
  }
  return errors;
}

function repoCheck(root) {
  const errors = repositoryPolicyErrors(root);
  if (errors.length) throw new Error(errors.map((error) => `- ${error}`).join('\n'));
  process.stdout.write('workflow repository policy ok\n');
}

function usage() {
  return `사용법:
  pnpm workflow:bootstrap --tool <codex|claude|both> --team <번호>
  pnpm workflow init --team <번호> --issue <번호> --design-ref <경로>
  pnpm workflow check
  pnpm workflow set-issue --issue <번호>
  pnpm workflow clear-issue
  pnpm workflow migrate-v3 --notice-ref <설계저장소-공통공지-URL|CREFLEINC/omf-mes#번호>
  pnpm workflow accept-design-change --notice-ref <설계저장소-공통공지-URL|CREFLEINC/omf-mes#번호> --commit <40자리해시> [--design-ref <경로>]
  pnpm workflow repo-check\n`;
}

function main() {
  const root = process.cwd();
  const { command, options } = parseArgs(process.argv.slice(2));
  switch (command) {
    case 'init':
      init(root, options);
      break;
    case 'check':
      check(root, options.state);
      break;
    case 'set-issue':
      setIssue(root, options);
      break;
    case 'clear-issue':
      clearIssue(root, options);
      break;
    case 'migrate-v3':
      migrateV3(root, options);
      break;
    case 'accept-design-change':
      acceptDesignChange(root, options);
      break;
    case 'repo-check':
      repoCheck(root);
      break;
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
    process.stderr.write(`workflow error:\n${error.message}\n`);
    process.exitCode = 1;
  }
}
