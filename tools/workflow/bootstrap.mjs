import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const WORKFLOW_VERSION = 3;
export const WORKFLOW_SOURCE = 'docs/client-dev-workflow/multi-agent-team-workflow-v3.md';
const MANAGED_START = '<!-- BEGIN MANAGED WORKFLOW -->';
const MANAGED_END = '<!-- END MANAGED WORKFLOW -->';
const PERSONAL_HEADING = '## 개인별 AI 도구 설정';
const ADAPTERS = {
  codex: { file: 'AGENTS.md', title: 'Codex' },
  claude: { file: 'CLAUDE.md', title: 'Claude' },
};

function normalizeTeam(value) {
  const match = String(value ?? '').match(/^(?:Agent\s*:\s*)?T?(\d+)$/i);
  if (!match || Number(match[1]) < 1) {
    throw new Error('팀은 1 이상의 번호로 지정하세요. 예: --team 5');
  }
  return `Agent : T${Number(match[1])}`;
}

export function workflowHash(content) {
  return createHash('sha256').update(content).digest('hex');
}

function policy(root) {
  const file = path.join(root, WORKFLOW_SOURCE);
  if (!existsSync(file)) throw new Error(`워크플로 정본이 없습니다: ${WORKFLOW_SOURCE}`);
  const content = readFileSync(file, 'utf8');
  return { content, hash: workflowHash(content) };
}

function selectedTools(value) {
  if (value === 'both') return ['codex', 'claude'];
  if (ADAPTERS[value]) return [value];
  throw new Error('--tool은 codex, claude, both 중 하나여야 합니다.');
}

function personalTail(existing) {
  parseMetadata(existing);
  const end = existing.indexOf(MANAGED_END);
  if (end < 0) throw new Error('관리 워크플로 종료 표지가 없습니다.');
  return existing.slice(end + MANAGED_END.length).trim();
}

export function renderAdapter({ tool, team, policyContent, personalTail: personal = '' }) {
  const adapter = ADAPTERS[tool];
  if (!adapter) throw new Error(`지원하지 않는 AI 도구입니다: ${tool}`);
  const metadata = {
    schemaVersion: 1,
    workflowVersion: WORKFLOW_VERSION,
    workflowSource: WORKFLOW_SOURCE,
    workflowHash: workflowHash(policyContent),
    tool,
    team: normalizeTeam(team),
  };
  const personalContent =
    personal ||
    `${PERSONAL_HEADING}\n\n<!-- 공통 규칙을 무효화하지 않는 개인 노하우를 여기에 적습니다. -->`;
  return `# ${adapter.title} 로컬 개발환경\n\n<!-- workflow-bootstrap: ${JSON.stringify(metadata)} -->\n\n이 파일은 로컬 생성물이며 업무 규칙의 정본이 아닙니다. 아래 관리 블록은 직접 수정하지 말고 \`pnpm workflow:bootstrap\`으로 갱신하세요. 개인 설정은 공통 규칙을 무효화할 수 없습니다.\n\n현재 담당: **${metadata.team}**\n\n${MANAGED_START}\n${policyContent.trim()}\n${MANAGED_END}\n\n${personalContent}\n`;
}

function parseMetadata(content) {
  const match = content.match(/<!-- workflow-bootstrap: (\{[^\n]+\}) -->/);
  if (!match) throw new Error('workflow-bootstrap 메타데이터가 없습니다.');
  try {
    return JSON.parse(match[1]);
  } catch (error) {
    throw new Error(`workflow-bootstrap 메타데이터가 잘못되었습니다: ${error.message}`);
  }
}

export function bootstrapErrors(root, expectedTeam) {
  const errors = [];
  let currentPolicy;
  try {
    currentPolicy = policy(root);
  } catch (error) {
    return [error.message];
  }
  const existing = Object.entries(ADAPTERS).filter(([, adapter]) =>
    existsSync(path.join(root, adapter.file)),
  );
  if (!existing.length) {
    return ['로컬 AI 어댑터가 없습니다. pnpm workflow:bootstrap을 먼저 실행하세요.'];
  }
  for (const [tool, adapter] of existing) {
    const content = readFileSync(path.join(root, adapter.file), 'utf8');
    try {
      const metadata = parseMetadata(content);
      if (metadata.workflowVersion !== WORKFLOW_VERSION)
        errors.push(`${adapter.file}: 워크플로 버전이 ${WORKFLOW_VERSION}이 아닙니다.`);
      if (metadata.workflowSource !== WORKFLOW_SOURCE)
        errors.push(`${adapter.file}: 워크플로 정본 경로가 다릅니다.`);
      if (metadata.workflowHash !== currentPolicy.hash)
        errors.push(`${adapter.file}: 워크플로 정본 해시가 다릅니다. 부트스트랩을 갱신하세요.`);
      if (metadata.tool !== tool) errors.push(`${adapter.file}: AI 도구 식별자가 다릅니다.`);
      if (expectedTeam && metadata.team !== normalizeTeam(expectedTeam))
        errors.push(`${adapter.file}: 담당 팀(${metadata.team})이 로컬 상태와 다릅니다.`);
      const start = content.indexOf(MANAGED_START);
      const end = content.indexOf(MANAGED_END);
      const managed =
        start >= 0 && end > start ? content.slice(start + MANAGED_START.length, end).trim() : null;
      if (managed !== currentPolicy.content.trim())
        errors.push(`${adapter.file}: 관리 워크플로 블록이 정본과 다릅니다.`);
    } catch (error) {
      errors.push(`${adapter.file}: ${error.message}`);
    }
  }
  return errors;
}

export function bootstrap(root, options) {
  const currentPolicy = policy(root);
  const tools = selectedTools(options.tool);
  const team = normalizeTeam(options.team);
  const writes = [];
  for (const tool of tools) {
    const target = path.join(root, ADAPTERS[tool].file);
    let preservedTail = '';
    if (existsSync(target)) {
      const existing = readFileSync(target, 'utf8');
      try {
        preservedTail = personalTail(existing);
      } catch (error) {
        if (!options.force) {
          throw new Error(
            `${ADAPTERS[tool].file}은 검증된 부트스트랩 생성물이 아닙니다: ${error.message} 교체하려면 --force를 사용하세요.`,
          );
        }
      }
    }
    writes.push({
      target,
      file: ADAPTERS[tool].file,
      content: renderAdapter({
        tool,
        team,
        policyContent: currentPolicy.content,
        personalTail: preservedTail,
      }),
    });
  }
  for (const write of writes) {
    writeFileSync(write.target, write.content, { flag: 'w' });
    process.stdout.write(`workflow adapter ready: ${write.file} (${team})\n`);
  }
}

function usage() {
  return `사용법:
  pnpm workflow:bootstrap --tool <codex|claude|both> --team <번호>
  pnpm workflow:bootstrap --tool <codex|claude|both> --team <번호> --force

--force는 출처를 검증할 수 없는 기존 도구 파일을 의도적으로 교체할 때만 사용합니다.\n`;
}

function parseArgs(argv) {
  if (argv.includes('--help') || argv.includes('-h')) return { help: true };
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (key === '--force') {
      options.force = true;
      continue;
    }
    if (!key.startsWith('--')) throw new Error(`알 수 없는 인자: ${key}`);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`${key} 값이 필요합니다.`);
    options[key.slice(2)] = value;
    index += 1;
  }
  return options;
}

const isEntryPoint =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isEntryPoint) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(usage());
    } else {
      bootstrap(process.cwd(), options);
    }
  } catch (error) {
    process.stderr.write(`workflow bootstrap error:\n${error.message}\n\n${usage()}`);
    process.exitCode = 1;
  }
}
